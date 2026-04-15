"""
채용 시점 추론 트리거 (채용 전용)
범용 inference.py 와 별도로 채용 신호에 특화된 추론 로직.

추론 신호 3종:
  ① 운영 기간   months_since_open >= 2 → 반복 작업 위임 시점
  ② 계절 패턴   3/9월 개강 D-30, 12월 연말 대목 D-45
  ③ 이벤트      메뉴 품목 수 증가 → 제조 복잡도 상승
"""
import json
from datetime import date

import anthropic

from backend.core.config import get_settings
from backend.core.constants import FounderStage, TriggerType
from backend.db.client import get_supabase
from backend.triggers.state import _insert_trigger_log

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자의 상황을 분석하여 알바 채용 적정 시점을 판단하는 AI입니다.

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "should_trigger": true/false,
  "message": "창업자에게 전달할 채용 관련 알림 메시지 (1-2문장)",
  "reason": "트리거 판단 근거",
  "suggested_hire_type": "파트타임" 또는 "풀타임",
  "suggested_weekly_hours": 정수 (예: 20)
}

판단 기준:
- 운영 2개월 이상 + 직원 없음 → 트리거 가능성 높음
- 주 15시간 이상 혼자 운영 중 → 인력 분산 필요 신호
- 메뉴 품목 증가(5개 이상) → 제조 복잡도 상승 신호
- 홍대·연남동·망원동 위치 + 개강시즌(3/9월) → 유동인구 급증 대비 필요
"""


async def _get_sales_context(user_id: str) -> dict:
    """최근 30일 매출 요약을 DB에서 조회하여 채용 추론 신호로 사용"""
    from datetime import timedelta
    supabase = get_supabase()
    from_date = str(date.today() - timedelta(days=30))

    rows = (
        supabase.table("sales")
        .select("amount, category, time_slot")
        .eq("user_id", user_id)
        .gte("date", from_date)
        .execute()
        .data
    )
    if not rows:
        return {}

    by_slot: dict[str, int] = {}
    total = 0
    for row in rows:
        total += row["amount"]
        by_slot[row["time_slot"]] = by_slot.get(row["time_slot"], 0) + row["amount"]

    peak_slot = max(by_slot, key=by_slot.get) if by_slot else None
    return {
        "recent_30d_revenue": total,
        "peak_time_slot": peak_slot,
        "revenue_by_slot": by_slot,
        "sale_record_count": len(rows),
    }


async def run_hiring_inference_trigger(user_id: str, context: dict) -> dict:
    """
    LLM이 창업자 컨텍스트를 분석하여 채용 트리거 여부를 판단.

    context 예시:
    {
        "months_since_open": 3,
        "has_staff": false,
        "self_weekly_hours": 60,
        "menu_count": 8,
        "neighborhood": "연남동",
        "current_month": 3
    }

    반환:
    {
        "triggered": bool,
        "reason": str,
        "suggested_hire_type": str | None,
        "suggested_weekly_hours": int | None,
    }
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # DB 매출 데이터 병합
    sales_ctx = await _get_sales_context(user_id)
    full_context = {**context, **sales_ctx}

    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "다음 카페 창업자 현황을 보고 지금 알바 채용이 필요한지 판단해주세요.\n\n"
                    f"[창업자 현황]\n{json.dumps(full_context, ensure_ascii=False, indent=2)}"
                ),
            }
        ],
    )

    try:
        result = json.loads(message.content[0].text)
    except (json.JSONDecodeError, IndexError):
        return {"triggered": False, "reason": "LLM 응답 파싱 실패"}

    if result.get("should_trigger"):
        _insert_trigger_log(
            user_id=user_id,
            trigger_type=TriggerType.INFERENCE,
            message=result.get("message", ""),
        )
        return {
            "triggered": True,
            "reason": result.get("reason", ""),
            "suggested_hire_type": result.get("suggested_hire_type"),
            "suggested_weekly_hours": result.get("suggested_weekly_hours"),
        }

    return {"triggered": False, "reason": result.get("reason", "")}


async def fire_hiring_season_trigger() -> None:
    """
    개강시즌 D-30 전 알바 채용 추천 (2/8월 15일 실행).
    홍대·연남동·망원동 특화: 대학생 유동인구 급증 대비.
    """
    today = date.today()
    # 3월 개강 → 2월 15일 실행 / 9월 개강 → 8월 15일 실행
    if today.month == 2:
        season_name = "3월 개강시즌"
        tip = "홍대·연남동 대학생 유동인구가 급증합니다."
    elif today.month == 8:
        season_name = "9월 개강시즌"
        tip = "2학기 개강으로 상권이 다시 살아납니다."
    else:
        return

    supabase = get_supabase()
    users = (
        supabase.table("users")
        .select("id")
        .in_("stage", [FounderStage.EARLY_OPS, FounderStage.GROWTH])
        .execute()
        .data
    )

    msg = (
        f"[채용 추천] {season_name}까지 30일 남았습니다. {tip} "
        "알바 채용 공고를 지금 올리면 좋은 인재를 확보할 수 있어요. "
        "채용공고 초안을 준비해 드릴까요?"
    )
    for user in users:
        _insert_trigger_log(
            user_id=user["id"],
            trigger_type=TriggerType.TIME_BASED,
            message=msg,
        )


async def fire_year_end_hiring_trigger() -> None:
    """
    연말 대목 D-45 전 알바 채용 추천 (11월 1일 실행).
    12월 연말 파티·모임 시즌 카페 성수기 대비.
    """
    today = date.today()
    if today.month != 11:
        return

    supabase = get_supabase()
    users = (
        supabase.table("users")
        .select("id")
        .in_("stage", [FounderStage.EARLY_OPS, FounderStage.GROWTH])
        .execute()
        .data
    )

    msg = (
        "[채용 추천] 연말 성수기(12월)까지 45일 남았습니다. "
        "마포구 카페는 연말 모임·파티 수요로 매출이 급증하는 시기입니다. "
        "지금 알바를 채용하면 적응 기간까지 여유 있게 준비할 수 있어요. "
        "채용공고 초안을 만들어 드릴까요?"
    )
    for user in users:
        _insert_trigger_log(
            user_id=user["id"],
            trigger_type=TriggerType.TIME_BASED,
            message=msg,
        )
