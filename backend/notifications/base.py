"""알림 채널 추상 기반 클래스"""
from abc import ABC, abstractmethod


class NotificationChannel(ABC):
    @abstractmethod
    async def send(
        self,
        user_id: str,
        message: str,
        draft_url: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """알림 발송. 실패 시 예외를 raise하지 않고 로깅만 한다."""
        ...
