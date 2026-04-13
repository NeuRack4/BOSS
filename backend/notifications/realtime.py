"""
Supabase Realtime 알림 채널
trigger_log INSERT → Supabase Realtime 브로드캐스트로 프론트엔드에 실시간 전달
"""
import logging
from backend.db.client import get_supabase
from backend.notifications.base import NotificationChannel

logger = logging.getLogger(__name__)


class RealtimeChannel(NotificationChannel):
    async def send(
        self,
        user_id: str,
        message: str,
        draft_url: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        payload: dict = {
            "user_id": user_id,
            "trigger_type": "time_based",
            "message": message,
        }
        if draft_url:
            payload["draft_url"] = draft_url

        try:
            get_supabase().table("trigger_log").insert(payload).execute()
        except Exception as e:
            logger.error("RealtimeChannel.send failed for user=%s: %s", user_id, e)
