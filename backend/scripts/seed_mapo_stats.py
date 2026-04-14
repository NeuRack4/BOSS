"""
마포구 카페 상권 실데이터를 RAG(documents 테이블)에 삽입하는 스크립트.

서울 열린데이터광장 API에서 실데이터를 수집 후 텍스트 청크로 변환하여 ingest.

실행 방법 (프로젝트 루트에서):
    python -m backend.scripts.seed_mapo_stats [QUARTER]

    QUARTER 예시: 20244 (2024년 4분기, 기본값)

중복 실행 방지: category='mapo_stats' 문서를 삭제 후 재삽입.
API 오류 또는 데이터 없음: 즉시 오류 출력 후 종료 (fallback 없음).
"""
import asyncio
import sys
from datetime import datetime

from backend.core.constants import DocumentCategory
from backend.db.client import get_supabase
from backend.rag.ingest import ingest_documents


# ── 텍스트 변환 함수 ─────────────────────────────────────────────────────────

def _sales_to_docs(rows: list[dict], quarter: str) -> list[dict]:
    """추정매출 API 행 → RAG 텍스트 청크"""
    docs = []
    source = f"서울 열린데이터광장 골목상권 추정매출 {quarter} (VwsmTrdarSelngQq)"
    for i, r in enumerate(rows):
        area = r.get("TRDAR_CD_NM", "")
        induty = r.get("SVC_INDUTY_CD_NM", "카페")
        stdr_quarter = r.get("STDR_YYQU_CD", quarter)
        # 실제 API 필드명: THSMON_SELNG_AMT (월 매출), THSMON_SELNG_CO (월 매출건수)
        sales_amt = r.get("THSMON_SELNG_AMT", 0)
        sales_cnt = r.get("THSMON_SELNG_CO", 0)
        mon_sales = r.get("MON_SELNG_AMT", 0)
        tue_sales = r.get("TUES_SELNG_AMT", 0)
        wed_sales = r.get("WED_SELNG_AMT", 0)
        thu_sales = r.get("THUR_SELNG_AMT", 0)
        fri_sales = r.get("FRI_SELNG_AMT", 0)
        sat_sales = r.get("SAT_SELNG_AMT", 0)
        sun_sales = r.get("SUN_SELNG_AMT", 0)

        lines = [
            f"[마포구 카페 상권 추정매출] 상권: {area} | 업종: {induty} | 기준분기: {stdr_quarter}",
            f"월 매출금액: {int(sales_amt):,}원 | 월 매출건수: {int(sales_cnt):,}건",
        ]
        if any([mon_sales, tue_sales, wed_sales, thu_sales, fri_sales, sat_sales, sun_sales]):
            lines.append(
                f"요일별 매출 — 월:{int(mon_sales):,} 화:{int(tue_sales):,} 수:{int(wed_sales):,} "
                f"목:{int(thu_sales):,} 금:{int(fri_sales):,} 토:{int(sat_sales):,} 일:{int(sun_sales):,}원"
            )

        # 시간대별 매출 (실제 필드명: TMZON_ 접두사)
        time_fields = [
            ("TMZON_00_06_SELNG_AMT", "새벽(0~6시)"),
            ("TMZON_06_11_SELNG_AMT", "오전(6~11시)"),
            ("TMZON_11_14_SELNG_AMT", "점심(11~14시)"),
            ("TMZON_14_17_SELNG_AMT", "오후(14~17시)"),
            ("TMZON_17_21_SELNG_AMT", "저녁(17~21시)"),
            ("TMZON_21_24_SELNG_AMT", "야간(21~24시)"),
        ]
        time_parts = [f"{label}:{int(r.get(field, 0)):,}원" for field, label in time_fields if r.get(field)]
        if time_parts:
            lines.append("시간대별 매출 — " + " | ".join(time_parts))

        docs.append({
            "source": source,
            "chunk_index": i,
            "content": "\n".join(lines),
            "metadata": {
                "area": area,
                "induty": induty,
                "quarter": stdr_quarter,
                "data_type": "sales",
            },
        })
    return docs


def _stores_to_docs(rows: list[dict], quarter: str) -> list[dict]:
    """점포현황 API 행 → RAG 텍스트 청크"""
    docs = []
    source = f"서울 열린데이터광장 골목상권 점포현황 {quarter} (VwsmTrdarStorQq)"
    for i, r in enumerate(rows):
        area = r.get("TRDAR_CD_NM", "")
        induty = r.get("SVC_INDUTY_CD_NM", "카페")
        stdr_quarter = r.get("STDR_YYQU_CD", quarter)
        stor_co = r.get("STOR_CO", 0)
        opbiz_rt = r.get("OPBIZ_RT", 0)
        clsbiz_rt = r.get("CLSBIZ_RT", 0)
        # 실제 API 필드명: FRC_STOR_CO, SIMILR_INDUTY_STOR_CO
        frchs_co = r.get("FRC_STOR_CO", 0)
        sim_stor_co = r.get("SIMILR_INDUTY_STOR_CO", 0)

        lines = [
            f"[마포구 카페 점포현황] 상권: {area} | 업종: {induty} | 기준분기: {stdr_quarter}",
            f"점포수: {int(stor_co):,}개 | 개업률: {float(opbiz_rt):.1f}% | 폐업률: {float(clsbiz_rt):.1f}%",
        ]
        if frchs_co:
            lines.append(f"프랜차이즈 점포수: {int(frchs_co):,}개")
        if sim_stor_co:
            lines.append(f"유사업종(카페류) 점포수: {int(sim_stor_co):,}개")

        survival = 100 - float(clsbiz_rt) if clsbiz_rt else None
        if survival is not None:
            lines.append(f"추정 생존율: {survival:.1f}% (100 - 폐업률)")

        docs.append({
            "source": source,
            "chunk_index": i,
            "content": "\n".join(lines),
            "metadata": {
                "area": area,
                "induty": induty,
                "quarter": stdr_quarter,
                "data_type": "stores",
            },
        })
    return docs


def _change_to_docs(rows: list[dict], quarter: str) -> list[dict]:
    """상권변화지표 API 행 → RAG 텍스트 청크"""
    # HH/HL/LH/LL 코드 설명
    CHANGE_LABELS = {
        "HH": "정체 (매출 높음 + 점포수 증가)",
        "HL": "상권축소 (매출 높음 + 점포수 감소)",
        "LH": "상권확장 (매출 낮음 + 점포수 증가)",
        "LL": "다이나믹 (매출 낮음 + 점포수 감소)",
    }
    docs = []
    source = f"서울 열린데이터광장 골목상권 변화지표 {quarter} (VwsmTrdarlxQq)"
    for i, r in enumerate(rows):
        area = r.get("TRDAR_CD_NM", "")
        quarter = r.get("STDR_YYQU_CD", "")
        code = r.get("TRDAR_XCNTU_CD", "")
        code_nm = r.get("TRDAR_XCNTU_CD_NM", "")
        label = CHANGE_LABELS.get(code, code_nm)

        lines = [
            f"[마포구 상권변화지표] 상권: {area} | 기준분기: {quarter}",
            f"상권 변화 유형: {code} ({label})",
        ]

        docs.append({
            "source": source,
            "chunk_index": i,
            "content": "\n".join(lines),
            "metadata": {
                "area": area,
                "quarter": quarter,
                "change_code": code,
                "data_type": "change_index",
            },
        })
    return docs


# ── 메인 ─────────────────────────────────────────────────────────────────────

async def _seed_quarter(quarter: str, *, debug: bool = False) -> int:
    """단일 분기 수집 → 삭제 → 삽입. 저장된 청크 수 반환."""
    from backend.data.crawlers.seoul_alley import (
        fetch_mapo_cafe_sales,
        fetch_mapo_cafe_stores,
        fetch_mapo_change_index,
    )
    try:
        sales_rows, store_rows, change_rows = await asyncio.gather(
            fetch_mapo_cafe_sales(quarter, debug=debug),
            fetch_mapo_cafe_stores(quarter, debug=debug),
            fetch_mapo_change_index(quarter, debug=debug),
        )
    except Exception as e:
        print(f"  [{quarter}] FAIL API 크롤링 실패: {e}")
        return 0

    if not (sales_rows or store_rows or change_rows):
        print(f"  [{quarter}] FAIL 데이터 없음 - API 키 또는 분기 코드 확인")
        return 0

    print(f"  [{quarter}] 수집 - 매출:{len(sales_rows)} / 점포:{len(store_rows)} / 변화지표:{len(change_rows)}")

    all_docs = (
        _sales_to_docs(sales_rows, quarter)
        + _stores_to_docs(store_rows, quarter)
        + _change_to_docs(change_rows, quarter)
    )

    # 해당 분기 기존 문서 삭제 (다른 분기 보존)
    supabase = get_supabase()
    for source in {doc["source"] for doc in all_docs}:
        supabase.table("documents") \
            .delete() \
            .eq("category", DocumentCategory.MAPO_STATS) \
            .eq("source", source) \
            .execute()

    count = await ingest_documents(all_docs, DocumentCategory.MAPO_STATS)
    print(f"  [{quarter}] OK {count}개 청크 저장")
    return count


async def main() -> None:
    # 인수: 분기 코드 1개 이상 (예: 20231 20232 20233) / --debug 플래그 허용
    args = sys.argv[1:]
    debug = "--debug" in args
    quarters = [a for a in args if not a.startswith("--")]

    if not quarters:
        now = datetime.now()
        q = (now.month - 1) // 3
        quarters = [f"{now.year - 1}4" if q == 0 else f"{now.year}{q}"]

    print(f"[seed] 처리할 분기: {', '.join(quarters)}{' (debug=on)' if debug else ''}")
    total = 0
    for quarter in quarters:
        total += await _seed_quarter(quarter, debug=debug)

    print(f"\n[seed] 완료 - 총 {total}개 청크 저장 ({len(quarters)}개 분기)")


if __name__ == "__main__":
    asyncio.run(main())
