"""
입지분석 에이전트 (마포구 한정)
- 서울 열린데이터 API (VwsmAdstrdStorW + VwsmAdstrdFlpopW) 수집
- 시뮬레이션 엔진으로 5개 지표 계산
- Claude가 결과를 해석한 리포트 생성
"""
import anthropic
from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.data.crawlers.seoul_open import fetch_all_mapo_enriched, _MAPO_DONG_MAP
from backend.analysis.simulator import simulate_districts, to_json_scores

# 마포구 분석 가능 상권 목록 (라우터에서도 참조)
MAPO_DISTRICTS: list[str] = list(_MAPO_DONG_MAP.keys())

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 입지를 분석하는 AI 비서입니다.
수치 시뮬레이션 결과를 바탕으로 창업자가 이해하기 쉬운 해석과 전략을 제공합니다.
추천은 항상 데이터 근거를 명시하고, 최종 결정은 창업자가 내린다는 점을 강조하세요.
"""


async def run(ctx: dict | None = None, districts: list[str] | None = None) -> dict:
    """
    입지분석 에이전트 메인 실행.

    Args:
        ctx: 오케스트레이터 컨텍스트 (선택)
        districts: 분석할 상권 목록. None이면 마포구 전체.

    Returns:
        {
            agent, top_pick, scores, llm_report, raw_data
        }
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # 1. 데이터 수집 (서울 열린데이터 단일 소스)
    enriched_map = await fetch_all_mapo_enriched()

    # 2. 시뮬레이터 입력 형식으로 변환
    merged = [{"name": k, **v} for k, v in enriched_map.items()]

    # 요청된 상권 필터링
    if districts:
        merged = [d for d in merged if d.get("name") in districts] or merged

    # 3. 시뮬레이션
    scores = simulate_districts(merged)

    if not scores:
        return {"agent": "location", "error": "분석할 상권 데이터가 없습니다."}

    top_pick = scores[0].district

    # 4. Claude 해석 생성
    sim_summary = _format_scores_for_llm(scores[:5])  # 상위 5개만 전달
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "마포구 카페 창업을 위한 입지 시뮬레이션 결과를 해석해주세요.\n\n"
                    f"[시뮬레이션 결과 (종합 스코어 순)]\n{sim_summary}\n\n"
                    "다음 항목을 포함해 창업자에게 친절하게 설명해주세요:\n"
                    "1. 추천 상권 TOP 3와 각 상권의 핵심 강점\n"
                    "2. 주의가 필요한 상권과 구체적인 이유\n"
                    "3. 추천 1위 상권에서의 초기 고객 확보 전략 (3가지 이상)\n"
                    "4. 공통적으로 고려해야 할 창업 리스크"
                ),
            }
        ],
    )

    llm_report = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"

    return {
        "agent": "location",
        "top_pick": top_pick,
        "scores": [
            {**to_json_scores(s), "district": s.district, "risk_level": s.risk_level}
            for s in scores
        ],
        "llm_report": llm_report,
        "raw_data": merged,
    }


def _format_scores_for_llm(scores) -> str:
    lines = []
    for i, s in enumerate(scores, 1):
        lines.append(
            f"{i}. {s.district} — 종합 {s.total_score}점 ({s.risk_level})\n"
            f"   · 생존율 {s.survival_score:.0f}점 | 포화도지수 {s.saturation_index:.2f}\n"
            f"   · 예상 월매출 {s.estimated_monthly_revenue:,}원 | BEP {s.bep_months:.1f}개월\n"
            f"   · 성장 잠재력 {s.growth_score:.0f}점"
        )
    return "\n".join(lines)
