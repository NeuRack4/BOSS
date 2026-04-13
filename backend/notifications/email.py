"""
이메일 알림 채널 (스텁 — SendGrid / AWS SES 미구현)
채널 인터페이스만 정의. 실제 연동은 추후 구현.
"""
import logging
from backend.notifications.base import NotificationChannel

logger = logging.getLogger(__name__)


class EmailChannel(NotificationChannel):
    async def send(
        self,
        user_id: str,
        message: str,
        draft_url: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        # TODO: SendGrid / AWS SES 연동 후 구현
        logger.warning(
            "EmailChannel not configured. Skipping email for user=%s", user_id
        )
