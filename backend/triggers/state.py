"""
상태 전이 트리거 + 시간 기반 트리거 실행 함수

- 사업자등록 완료 → 인허가 신청 단계 진행 알림
- 세금 기한 D-30/14/7/3 알림 (중복 방지 포함)
- D-14 시점에 신고서 초안 자동 생성
- 지원사업 마감 D-7 알림
"""
import logging
from datetime import date, datetime, timezone

from backend.db.client import get_supabase
from backend.core.constants import FounderSubStage
from backend.notifications.base import NotificationChannel
from backend.notifications.email import EmailChannel
from backend.notifications.realtime import RealtimeChannel

logger = logging.getLogger(__name__)

# 알림 발송 D-day 기준 (내림차순 — 30일 전이 가장 먼저)
_NOTIFY_D_DAYS: tuple[int, ...] = (30, 14, 7, 3)
# 이 D-day에 신고서 초안을 자동 생성
_DRAFT_TRIGGER_D_DAY = 14


def _get_channels() -> list[NotificationChannel]:
    """활성화된 알림 채널 목록 반환 — 채널 추가 시 여기만 수정"""
    return [RealtimeChannel(), EmailChannel()]


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

    for ch in _get_channels():
        await ch.send(user_id=user_id, message=msg)


async def fire_tax_deadline_triggers() -> None:
    """
    세금 기한 D-30/14/7/3에 모든 사용자에게 알림.
    - tax_notifications 테이블로 중복 발송 방지
    - D-14 시점에 신고서 초안 자동 생성
    """
    from backend.agents.tax import get_upcoming_deadlines, generate_tax_draft

    upcoming = await get_upcoming_deadlines(days_ahead=30)
    if not upcoming:
        return

    supabase = get_supabase()
    users = supabase.table("users").select("id").execute().data
    channels = _get_channels()

    for deadline in upcoming:
        d_day = deadline["d_day"]
        if d_day not in _NOTIFY_D_DAYS:
            continue

        for user in users:
            uid = user["id"]
            deadline_id = deadline.get("id")

            # 시드 fallback(음수 id)이거나 id 없으면 중복 체크 불가 → 그냥 발송
            if deadline_id and deadline_id > 0 and _already_notified(uid, deadline_id, d_day):
                continue

            msg = (
                f"[세금 기한 D-{d_day}] {deadline['title']} 마감이 {d_day}일 남았습니다. "
                f"신고 기한: {deadline['deadline_date']}"
            )
            draft_url: str | None = None

            # D-14: 신고서 초안 자동 생성
            if d_day == _DRAFT_TRIGGER_D_DAY:
                try:
                    draft_url = await generate_tax_draft(uid, deadline)
                    msg += " 신고서 초안을 준비했습니다."
                except Exception as e:
                    logger.error("Draft generation failed user=%s deadline=%s: %s", uid, deadline["title"], e)

            for ch in channels:
                await ch.send(user_id=uid, message=msg, draft_url=draft_url)

            # 발송 완료 기록 (DB id가 있는 경우만)
            if deadline_id and deadline_id > 0:
                _mark_notified(uid, deadline_id, d_day)


async def fire_subsidy_deadline_triggers() -> None:
    """지원사업 마감 D-7 알림"""
    supabase = get_supabase()
    today = date.today()
    channels = _get_channels()

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
        d_day = (date.fromisoformat(match["deadline"]) - today).days
        if d_day == 7:
            for ch in channels:
                await ch.send(
                    user_id=match["user_id"],
                    message=(
                        f"[지원사업 마감 D-7] '{match['program_id']}' 마감이 "
                        "7일 남았습니다. 신청서를 확인해 주세요."
                    ),
                )


# ── 중복 방지 헬퍼 ────────────────────────────────────────────────────────────

def _already_notified(user_id: str, tax_deadline_id: int, d_day: int) -> bool:
    """해당 D-day 알림이 이미 발송됐는지 확인"""
    col = f"notified_at_d{d_day}"
    row = (
        get_supabase()
        .table("tax_notifications")
        .select(col)
        .eq("user_id", user_id)
        .eq("tax_deadline_id", tax_deadline_id)
        .maybe_single()
        .execute()
        .data
    )
    return bool(row and row.get(col))


def _mark_notified(user_id: str, tax_deadline_id: int, d_day: int) -> None:
    """D-day 알림 발송 완료 기록 (upsert)"""
    col = f"notified_at_d{d_day}"
    now = datetime.now(timezone.utc).isoformat()
    get_supabase().table("tax_notifications").upsert(
        {
            "user_id": user_id,
            "tax_deadline_id": tax_deadline_id,
            col: now,
        },
        on_conflict="user_id,tax_deadline_id",
    ).execute()
