"""
카카오 알림톡 채널 (스텁 — 카카오 비즈니스 API 미구현)
채널 인터페이스만 정의. 실제 연동은 추후 구현.
"""
import logging
from backend.notifications.base import NotificationChannel

logger = logging.getLogger(__name__)


class KakaoChannel(NotificationChannel):
    async def send(
        self,
        user_id: str,
        message: str,
        draft_url: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        # TODO: 카카오 알림톡 API 연동 후 구현
        logger.warning(
            "KakaoChannel not configured. Skipping kakao for user=%s", user_id
        )
