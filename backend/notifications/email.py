"""
이메일 알림 채널 (Supabase SMTP 설정 활용)
SMTP 환경변수 미설정 시 로그만 출력하고 스킵.
"""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from backend.core.config import get_settings
from backend.db.client import get_supabase
from backend.notifications.base import NotificationChannel

logger = logging.getLogger(__name__)


def _build_html(message: str, draft_url: str | None) -> str:
    draft_section = ""
    if draft_url:
        draft_section = f'<p><a href="{draft_url}">📄 초안 보기</a></p>'
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#2563eb">BOSS 세금 알림</h2>
      <p>{message}</p>
      {draft_section}
      <hr/>
      <small style="color:#6b7280">
        본 내용은 참고용이며 실제 신고 전 전문가 확인을 권장합니다.
      </small>
    </div>
    """


async def _get_user_email(user_id: str) -> str | None:
    try:
        rows = (
            get_supabase()
            .table("users")
            .select("email")
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
        )
        return rows[0]["email"] if rows else None
    except Exception as e:
        logger.warning("Failed to fetch email for user=%s: %s", user_id, e)
        return None


class EmailChannel(NotificationChannel):
    async def send(
        self,
        user_id: str,
        message: str,
        draft_url: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        settings = get_settings()

        if not settings.smtp_host or not settings.smtp_user:
            logger.warning(
                "SMTP not configured. Skipping email for user=%s", user_id
            )
            return

        to_email = await _get_user_email(user_id)
        if not to_email:
            logger.warning("No email found for user=%s", user_id)
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "BOSS 세금 알림"
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to_email
        msg.attach(MIMEText(message, "plain", "utf-8"))
        msg.attach(MIMEText(_build_html(message, draft_url), "html", "utf-8"))

        try:
            # 포트 465: SSL 직접 연결 / 포트 587: STARTTLS
            use_tls = settings.smtp_port == 465
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                use_tls=use_tls,
                start_tls=not use_tls,
            )
            logger.info("Email sent to user=%s (%s)", user_id, to_email)
        except Exception as e:
            logger.error("Email send failed user=%s: %s", user_id, e)
