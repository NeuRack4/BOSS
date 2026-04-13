"""
시간 기반 트리거 (APScheduler)
- 세금 기한 D-14, D-7, D-3 알림
- 지원사업 마감 D-7 알림
- 매일 06:00 KST 실행
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.triggers.state import fire_tax_deadline_triggers
from backend.triggers.state import fire_subsidy_deadline_triggers

_scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


def start_scheduler() -> None:
    _scheduler.add_job(
        fire_tax_deadline_triggers,
        CronTrigger(hour=6, minute=0),
        id="tax_deadline",
        replace_existing=True,
    )
    _scheduler.add_job(
        fire_subsidy_deadline_triggers,
        CronTrigger(hour=6, minute=30),
        id="subsidy_deadline",
        replace_existing=True,
    )
    _scheduler.start()


def stop_scheduler() -> None:
    _scheduler.shutdown(wait=False)
