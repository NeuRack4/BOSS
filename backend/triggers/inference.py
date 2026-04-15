"""
추론 기반 트리거 (LLM 판단)
- 오픈 N개월 경과 → "알바 필요 시점" 추론
- 매출 패턴 → "마케팅 필요" 추론
"""
import anthropic
from backend.core.config import get_settings
from backend.core.constants import TriggerType
from backend.triggers.state import _insert_trigger_log

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자의 상황을 분석하여,
지금 이 창업자에게 어떤 도움이 필요한지 판단하는 AI입니다.

다음 JSON 형식으로만 응답하세요:
{
  "should_trigger": true/false,
  "message": "창업자에게 전달할 알림 메시지",
  "reason": "트리거 판단 근거"
}
"""


async def run_inference_trigger(user_id: str, context: dict) -> bool:
    """
    LLM이 창업자 컨텍스트를 분석하여 트리거 여부를 판단.
    context 예시: {"months_since_open": 3, "weekly_revenue": 1500000, "has_staff": false}
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "다음 창업자 현황을 보고 지금 어떤 도움이 필요한지 판단해주세요.\n\n"
                    f"[창업자 현황]\n{context}"
                ),
            }
        ],
    )

    import json

    try:
        result = json.loads(message.content[0].text)
    except (json.JSONDecodeError, IndexError):
        return False

    if result.get("should_trigger"):
        _insert_trigger_log(
            user_id=user_id,
            trigger_type=TriggerType.INFERENCE,
            message=result.get("message", ""),
        )
        return True

    return False
