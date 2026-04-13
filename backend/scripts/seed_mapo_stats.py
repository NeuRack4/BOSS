"""
마포구 카페 상권 실데이터를 RAG(documents 테이블)에 삽입하는 스크립트.

서울 열린데이터광장 API에서 실데이터를 수집 후 텍스트 청크로 변환하여 ingest.

실행 방법 (프로젝트 루트에서):
    python -m backend.scripts.seed_mapo_stats [QUARTER]

    QUARTER 예시: 20244 (2024년 4분기, 기본값)

중복 실행 방지: category='mapo_stats' 문서를 삭제 후 재삽입.
API 오류 시: 하드코딩 fallback 데이터(mapo_cafe_stats.py)로 대체.
"""
import asyncio
import sys
from datetime import datetime

from backend.core.constants import DocumentCategory
from backend.db.client import get_supabase
from backend.rag.ingest import ingest_documents


# ── 텍스트 변환 함수 ─────────────────────────────────────────────────────────

def _sales_to_docs(rows: list[dict]) -> list[dict]:
    """추정매출 API 행 → RAG 텍스트 청크"""
    docs = []
    source = "서울 열린데이터광장 골목상권 추정매출 (VwsmTrdarSelngQq)"
    for i, r in enumerate(rows):
        area = r.get("TRDAR_CD_NM", "")
        induty = r.get("INDUTY_SMALL_CL_CD_NM", r.get("INDUTY_MIDDLE_CL_CD_NM", "카페"))
        quarter = r.get("STDR_YYQU_CD", "")
        sales_amt = r.get("SELNG_AMT", 0)
        sales_cnt = r.get("SELNG_CO", 0)
        mon_sales = r.get("MON_SELNG_AMT", 0)
        tue_sales = r.get("TUE_SELNG_AMT", 0)
        wed_sales = r.get("WED_SELNG_AMT", 0)
        thu_sales = r.get("THU_SELNG_AMT", 0)
        fri_sales = r.get("FRI_SELNG_AMT", 0)
        sat_sales = r.get("SAT_SELNG_AMT", 0)
        sun_sales = r.get("SUN_SELNG_AMT", 0)

        lines = [
            f"[마포구 카페 상권 추정매출] 상권: {area} | 업종: {induty} | 기준분기: {quarter}",
            f"분기 매출금액: {int(sales_amt):,}원 | 분기 매출건수: {int(sales_cnt):,}건",
        ]
        if any([mon_sales, tue_sales, wed_sales, thu_sales, fri_sales, sat_sales, sun_sales]):
            lines.append(
                f"요일별 매출 — 월:{int(mon_sales):,} 화:{int(tue_sales):,} 수:{int(wed_sales):,} "
                f"목:{int(thu_sales):,} 금:{int(fri_sales):,} 토:{int(sat_sales):,} 일:{int(sun_sales):,}원"
            )

        # 시간대별 매출
        time_fields = [
            ("00_06_SELNG_AMT", "새벽(0~6시)"),
            ("06_11_SELNG_AMT", "오전(6~11시)"),
            ("11_14_SELNG_AMT", "점심(11~14시)"),
            ("14_17_SELNG_AMT", "오후(14~17시)"),
            ("17_21_SELNG_AMT", "저녁(17~21시)"),
            ("21_24_SELNG_AMT", "야간(21~24시)"),
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
                "quarter": quarter,
                "data_type": "sales",
            },
        })
    return docs


def _stores_to_docs(rows: list[dict]) -> list[dict]:
    """점포현황 API 행 → RAG 텍스트 청크"""
    docs = []
    source = "서울 열린데이터광장 골목상권 점포현황 (VwsmTrdarStorQq)"
    for i, r in enumerate(rows):
        area = r.get("TRDAR_CD_NM", "")
        induty = r.get("INDUTY_SMALL_CL_CD_NM", r.get("INDUTY_MIDDLE_CL_CD_NM", "카페"))
        quarter = r.get("STDR_YYQU_CD", "")
        stor_co = r.get("STOR_CO", 0)          # 점포수
        opbiz_rt = r.get("OPBIZ_RT", 0)        # 개업률 (%)
        clsbiz_rt = r.get("CLSBIZ_RT", 0)      # 폐업률 (%)
        frchs_co = r.get("FRCHS_CO", 0)        # 프랜차이즈 점포수
        sim_stor_co = r.get("SML_STOR_CO", 0)  # 유사업종 점포수

        lines = [
            f"[마포구 카페 점포현황] 상권: {area} | 업종: {induty} | 기준분기: {quarter}",
            f"점포수: {int(stor_co):,}개 | 개업률: {float(opbiz_rt):.1f}% | 폐업률: {float(clsbiz_rt):.1f}%",
        ]
        if frchs_co:
            lines.append(f"프랜차이즈 점포수: {int(frchs_co):,}개")
        if sim_stor_co:
            lines.append(f"유사업종(카페류) 점포수: {int(sim_stor_co):,}개")

        # 생존율 계산 (1 - 폐업률)
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
                "quarter": quarter,
                "data_type": "stores",
            },
        })
    return docs


def _change_to_docs(rows: list[dict]) -> list[dict]:
    """상권변화지표 API 행 → RAG 텍스트 청크"""
    # HH/HL/LH/LL 코드 설명
    CHANGE_LABELS = {
        "HH": "지속성장 (유동인구↑ + 점포수↑)",
        "HL": "성장둔화 (유동인구↑ + 점포수↓)",
        "LH": "잠재성장 (유동인구↓ + 점포수↑)",
        "LL": "침체 (유동인구↓ + 점포수↓)",
    }
    docs = []
    source = "서울 열린데이터광장 골목상권 변화지표 (VwsmTrdarlxQq)"
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

async def main() -> None:
    # 분기 코드 결정 (인수 없으면 직전 분기 자동 계산)
    if len(sys.argv) > 1:
        quarter = sys.argv[1]
    else:
        now = datetime.now()
        q = (now.month - 1) // 3  # 현재 분기 (0-based)
        if q == 0:
            quarter = f"{now.year - 1}4"
        else:
            quarter = f"{now.year}{q}"
    print(f"[seed] 기준 분기: {quarter}")

    # API 크롤링
    try:
        from backend.data.crawlers.seoul_alley import (
            fetch_mapo_cafe_sales,
            fetch_mapo_cafe_stores,
            fetch_mapo_change_index,
        )
        sales_rows, store_rows, change_rows = await asyncio.gather(
            fetch_mapo_cafe_sales(quarter),
            fetch_mapo_cafe_stores(quarter),
            fetch_mapo_change_index(quarter),
        )
        use_fallback = not (sales_rows or store_rows or change_rows)
    except Exception as e:
        print(f"[seed] API 크롤링 실패: {e}")
        use_fallback = True

    if use_fallback:
        print("[seed] ⚠ API 데이터 없음 → fallback 하드코딩 데이터 사용")
        from backend.data.seeds.mapo_cafe_stats import MAPO_CAFE_STATS_DOCS
        all_docs = MAPO_CAFE_STATS_DOCS
    else:
        print(f"[seed] 수집 완료 — 매출:{len(sales_rows)}건 / 점포:{len(store_rows)}건 / 변화지표:{len(change_rows)}건")
        sales_docs = _sales_to_docs(sales_rows)
        store_docs = _stores_to_docs(store_rows)
        change_docs = _change_to_docs(change_rows)

        # chunk_index 재정렬 (소스별로 독립 인덱스이므로 OK)
        all_docs = sales_docs + store_docs + change_docs

    if not all_docs:
        print("[seed] 삽입할 문서가 없습니다. 종료.")
        return

    # 기존 mapo_stats 전체 삭제
    supabase = get_supabase()
    supabase.table("documents") \
        .delete() \
        .eq("category", DocumentCategory.MAPO_STATS) \
        .execute()
    print("[seed] 기존 mapo_stats 문서 전체 삭제 완료")

    # 신규 삽입
    count = await ingest_documents(all_docs, DocumentCategory.MAPO_STATS)
    print(f"[seed] ✓ 마포구 카페 상권 데이터 {count}개 청크 삽입 완료")


if __name__ == "__main__":
    asyncio.run(main())
