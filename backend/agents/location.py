"""
입지분석 에이전트 (마포구 한정)
- 골목상권 서울 데이터 기반 카페 입지 분석
- 생존율 시뮬레이션
- 추천 상권 리포트 초안 생성
"""
import anthropic
from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.data.crawlers.alley import fetch_alley_data


_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 입지를 분석하는 AI 비서입니다.
골목상권 데이터를 바탕으로 객관적인 입지 분석과 생존율 시뮬레이션을 제공합니다.
추천은 항상 데이터 기반으로 이루어져야 하며, 최종 결정은 창업자가 합니다.
"""

# 마포구 주요 상권 목록
MAPO_DISTRICTS = [
    "홍대입구", "합정", "망원동", "연남동", "성산동",
    "마포대로", "공덕", "아현동", "신수동",
]


async def run(ctx) -> dict:
    """입지분석 에이전트 메인 실행"""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # 골목상권 데이터 수집
    alley_data = await fetch_alley_data(region="마포구", business_type="카페")
    summary = _summarize_alley_data(alley_data)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "마포구에서 카페 창업을 위한 최적 입지를 분석해주세요.\n\n"
                    f"[골목상권 데이터 요약]\n{summary}\n\n"
                    "다음을 포함해주세요:\n"
                    "1. 상권별 카페 밀도 및 생존율\n"
                    "2. 추천 상권 TOP 3 (근거 포함)\n"
                    "3. 주의해야 할 포화 상권\n"
                    "4. 예상 초기 고객 확보 전략"
                ),
            }
        ],
    )

    report = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"
    return {"agent": "location", "report": report, "alley_data": alley_data}


def _summarize_alley_data(data: list[dict]) -> str:
    if not data:
        return "데이터를 가져오지 못했습니다."
    lines = []
    for item in data[:10]:  # 상위 10개 상권
        lines.append(
            f"- {item.get('name', '알 수 없음')}: "
            f"카페 수 {item.get('cafe_count', 0)}개, "
            f"생존율 {item.get('survival_rate', 0):.0%}"
        )
    return "\n".join(lines)
