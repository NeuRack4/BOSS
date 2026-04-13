"""
상태 전이 트리거 + 시간 기반 트리거 실행 함수

- 사업자등록 완료 → 인허가 신청 단계 진행 알림
- 세금 기한 D-14/7/3 알림
- 지원사업 마감 D-7 알림
"""
from datetime import date
from backend.db.client import get_supabase
from backend.core.constants import TriggerType, FounderSubStage
from backend.agents.tax import get_upcoming_deadlines


async def on_state_transition(user_id: str, new_sub_stage: FounderSubStage) -> None:
    """상태 전이 시 호출 — 다음 액션 알림"""
    messages = {
        FounderSubStage.LICENSE_APPLICATION: (
            "사업자등록이 완료되었습니다! 이제 식품위생 영업신고(인허가)를 진행할 차례입니다. "
            "신청서 초안을 준비했습니다."
        ),
        FounderSubStage.HIRING: (
            "오픈 준비가 거의 다 됐네요! 알바 채용 공고와 근로계약서 초안을 만들어 드릴까요?"
        ),
        FounderSubStage.SUBSIDY_ACTIVE: (
            "초기 운영 3개월이 지났습니다. 지금 신청 가능한 지원사업을 찾아 초안을 준비했습니다."
        ),
    }

    msg = messages.get(new_sub_stage)
    if not msg:
        return

    _insert_trigger_log(
        user_id=user_id,
        trigger_type=TriggerType.STATE_TRANSITION,
        message=msg,
    )


async def fire_tax_deadline_triggers() -> None:
    """세금 기한 D-14/7/3에 모든 사용자에게 알림"""
    upcoming = get_upcoming_deadlines(days_ahead=14)
    if not upcoming:
        return

    supabase = get_supabase()
    users = supabase.table("users").select("id").execute().data

    for deadline in upcoming:
        d_day = deadline["d_day"]
        if d_day not in (14, 7, 3):
            continue

        msg = (
            f"[세금 기한 D-{d_day}] {deadline['name']} 마감이 {d_day}일 남았습니다. "
            f"신고서 초안을 준비해 드릴까요?"
        )
        for user in users:
            _insert_trigger_log(
                user_id=user["id"],
                trigger_type=TriggerType.TIME_BASED,
                message=msg,
            )


async def fire_subsidy_deadline_triggers() -> None:
    """지원사업 마감 D-7 알림"""
    supabase = get_supabase()
    today = date.today()

    matches = (
        supabase.table("subsidy_matches")
        .select("user_id, program_id, deadline")
        .eq("status", "pending")
        .execute()
        .data
    )

    for match in matches:
        if not match["deadline"]:
            continue
        deadline_date = date.fromisoformat(match["deadline"])
        d_day = (deadline_date - today).days
        if d_day == 7:
            _insert_trigger_log(
                user_id=match["user_id"],
                trigger_type=TriggerType.TIME_BASED,
                message=(
                    f"[지원사업 마감 D-7] 지원사업 '{match['program_id']}' 마감이 "
                    "7일 남았습니다. 신청서를 확인해 주세요."
                ),
            )


def _insert_trigger_log(user_id: str, trigger_type: TriggerType, message: str) -> None:
    supabase = get_supabase()
    supabase.table("trigger_log").insert(
        {"user_id": user_id, "trigger_type": trigger_type, "message": message}
    ).execute()
