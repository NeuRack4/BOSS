"""
마포구 행정동 유동인구 데이터를 RAG(documents 테이블)에 삽입하는 스크립트.

서울 열린데이터광장 VwsmAdstrdFlpopW API에서 실데이터를 수집 후
텍스트 청크로 변환하여 ingest.

실행 방법 (프로젝트 루트에서):
    # 특정 분기 1개
    python -m backend.scripts.seed_mapo_population 20241

    # 여러 분기
    python -m backend.scripts.seed_mapo_population 20241 20242 20243

    # 전체 분기 일괄 (2021Q4 ~ 2024Q4, 기본값)
    python -m backend.scripts.seed_mapo_population --all

    # 디버그 출력 포함
    python -m backend.scripts.seed_mapo_population --all --debug

category: 'mapo_population'
중복 실행 방지: 동일 source 문서를 삭제 후 재삽입.
"""
import asyncio
import sys

from backend.core.constants import DocumentCategory
from backend.db.client import get_supabase
from backend.rag.ingest import ingest_documents

_CATEGORY = DocumentCategory.MAPO_POPULATION

# 수집 대상 전체 분기 (2021Q4 ~ 2024Q4)
_ALL_QUARTERS = [
    "20214",
    "20221", "20222", "20223", "20224",
    "20231", "20232", "20233", "20234",
    "20241", "20242", "20243", "20244",
]


# ── 텍스트 변환 ───────────────────────────────────────────────────────────────

def _population_to_docs(rows: list[dict], quarter: str) -> list[dict]:
    """
    VwsmAdstrdFlpopW API 행 → RAG 텍스트 청크

    chunk 구조:
      [마포구 유동인구] 상권: {area} | 행정동: {dong} | 기준분기: {quarter}
      총 유동인구: {tot}명 | 남성: {ml}명 | 여성: {fml}명
      시간대별 — 새벽(0~6시):{t1}명 | 오전(6~11시):{t2}명 | ...
      요일별 — 월:{mon}명 화:{tue}명 ... 일:{sun}명
      연령대별 — 10대:{a10}명 | 20대:{a20}명 | ...
    """
    docs = []
    source = f"서울 열린데이터광장 골목상권 행정동 유동인구 {quarter} (VwsmAdstrdFlpopW)"

    for i, r in enumerate(rows):
        dong_nm  = r.get("ADSTRD_CD_NM", "")
        dong_cd  = str(r.get("ADSTRD_CD", ""))
        area     = r.get("resolved_area", dong_nm)
        stdr_q   = r.get("STDR_YYQU_CD", quarter)

        tot  = r.get("TOT_FLPOP_CO", 0)
        ml   = r.get("ML_FLPOP_CO", 0)
        fml  = r.get("FML_FLPOP_CO", 0)

        # 시간대별
        time_fields = [
            ("TMZON_00_06_FLPOP_CO", "새벽(0~6시)"),
            ("TMZON_06_11_FLPOP_CO", "오전(6~11시)"),
            ("TMZON_11_14_FLPOP_CO", "점심(11~14시)"),
            ("TMZON_14_17_FLPOP_CO", "오후(14~17시)"),
            ("TMZON_17_21_FLPOP_CO", "저녁(17~21시)"),
            ("TMZON_21_24_FLPOP_CO", "야간(21~24시)"),
        ]

        # 요일별
        day_fields = [
            ("MON_FLPOP_CO",  "월"),
            ("TUES_FLPOP_CO", "화"),
            ("WED_FLPOP_CO",  "수"),
            ("THUR_FLPOP_CO", "목"),
            ("FRI_FLPOP_CO",  "금"),
            ("SAT_FLPOP_CO",  "토"),
            ("SUN_FLPOP_CO",  "일"),
        ]

        # 연령대별
        age_fields = [
            ("AGRDE_10_FLPOP_CO",       "10대"),
            ("AGRDE_20_FLPOP_CO",       "20대"),
            ("AGRDE_30_FLPOP_CO",       "30대"),
            ("AGRDE_40_FLPOP_CO",       "40대"),
            ("AGRDE_50_FLPOP_CO",       "50대"),
            ("AGRDE_60_ABOVE_FLPOP_CO", "60대 이상"),
        ]

        lines = [
            f"[마포구 유동인구] 상권: {area} | 행정동: {dong_nm} | 기준분기: {stdr_q}",
            f"총 유동인구: {int(tot):,}명 | 남성: {int(ml):,}명 | 여성: {int(fml):,}명",
        ]

        time_parts = [
            f"{label}:{int(r.get(field, 0)):,}명"
            for field, label in time_fields
            if r.get(field)
        ]
        if time_parts:
            lines.append("시간대별 — " + " | ".join(time_parts))

        day_parts = [
            f"{label}:{int(r.get(field, 0)):,}"
            for field, label in day_fields
            if r.get(field)
        ]
        if day_parts:
            lines.append("요일별 — " + " ".join(day_parts) + "명")

        age_parts = [
            f"{label}:{int(r.get(field, 0)):,}명"
            for field, label in age_fields
            if r.get(field)
        ]
        if age_parts:
            lines.append("연령대별 — " + " | ".join(age_parts))

        docs.append({
            "source":      source,
            "chunk_index": i,
            "content":     "\n".join(lines),
            "metadata": {
                "area":     area,
                "dong":     dong_nm,
                "dong_cd":  dong_cd,
                "quarter":  stdr_q,
                "data_type": "population",
            },
        })

    return docs


# ── 시드 로직 ────────────────────────────────────────────────────────────────

async def _seed_quarter(quarter: str, *, debug: bool = False) -> int:
    """단일 분기 수집 → 기존 삭제 → 삽입. 저장된 청크 수 반환."""
    from backend.data.crawlers.mapo_population_crawler import fetch_mapo_population

    try:
        rows = await fetch_mapo_population(quarter, debug=debug)
    except Exception as e:
        print(f"  [{quarter}] FAIL API 크롤링 실패: {e}")
        return 0

    if not rows:
        print(f"  [{quarter}] FAIL 데이터 없음 — API 키 또는 분기 코드 확인")
        return 0

    print(f"  [{quarter}] 수집 - 행정동 유동인구: {len(rows)}건")

    docs = _population_to_docs(rows, quarter)

    # 해당 분기 source 기준으로 기존 문서 삭제 (다른 분기 보존)
    supabase = get_supabase()
    sources_to_delete = {doc["source"] for doc in docs}
    for source in sources_to_delete:
        supabase.table("documents") \
            .delete() \
            .eq("category", _CATEGORY) \
            .eq("source", source) \
            .execute()

    count = await ingest_documents(docs, _CATEGORY)  # type: ignore[arg-type]
    print(f"  [{quarter}] OK {count}개 청크 저장")
    return count


# ── 메인 ────────────────────────────────────────────────────────────────────

async def main() -> None:
    args = sys.argv[1:]
    debug = "--debug" in args
    use_all = "--all" in args
    quarter_args = [a for a in args if not a.startswith("--")]

    if use_all:
        quarters = _ALL_QUARTERS
    elif quarter_args:
        quarters = quarter_args
    else:
        # 기본값: 전체 분기
        quarters = _ALL_QUARTERS

    print(f"[seed_pop] 처리할 분기 ({len(quarters)}개): {', '.join(quarters)}"
          f"{' (debug=on)' if debug else ''}")

    total = 0
    for quarter in quarters:
        total += await _seed_quarter(quarter, debug=debug)

    print(f"\n[seed_pop] 완료 - 총 {total}개 청크 저장 ({len(quarters)}개 분기)")


if __name__ == "__main__":
    asyncio.run(main())
