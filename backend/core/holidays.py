"""
공휴일 유틸리티

holidays.json 을 로드하여 날짜가 공휴일인지 확인합니다.
인사이트 분석 시 Claude 프롬프트에 컨텍스트로 주입합니다.

사용 예:
    from backend.core.holidays import is_holiday, get_holiday_name, get_holiday_context

    is_holiday("2024-01-01")      # True
    get_holiday_name("2024-01-01") # "신정"
    get_holiday_context("2024-01-01")  # "신정 (공휴일)"
"""
import json
from functools import lru_cache
from pathlib import Path

_HOLIDAYS_PATH = Path(__file__).parent.parent / "data" / "seeds" / "holidays.json"


@lru_cache(maxsize=1)
def _load_holidays() -> dict[str, str]:
    """
    holidays.json 전체를 {날짜문자열: 공휴일명} 플랫 딕셔너리로 로드.
    날짜 형식: "20240101" (YYYYMMDD)
    """
    if not _HOLIDAYS_PATH.exists():
        return {}

    with open(_HOLIDAYS_PATH, encoding="utf-8") as f:
        data: dict[str, dict[str, str]] = json.load(f)

    flat: dict[str, str] = {}
    for year_data in data.values():
        flat.update(year_data)
    return flat


def _normalize_date(date: str) -> str:
    """
    다양한 날짜 형식을 YYYYMMDD로 통일합니다.
    지원 형식: "2024-01-01", "20240101", "2024.01.01"
    """
    return date.replace("-", "").replace(".", "")[:8]


def is_holiday(date: str) -> bool:
    """날짜가 공휴일이면 True를 반환합니다."""
    return _normalize_date(date) in _load_holidays()


def get_holiday_name(date: str) -> str | None:
    """공휴일이면 명칭을 반환하고, 아니면 None을 반환합니다."""
    return _load_holidays().get(_normalize_date(date))


def get_holiday_context(date: str) -> str:
    """
    인사이트 프롬프트에 주입할 공휴일 컨텍스트 문자열을 반환합니다.

    공휴일:  "신정 (공휴일)"
    평일:    "" (빈 문자열)
    """
    name = get_holiday_name(date)
    return f"{name} (공휴일)" if name else ""


def get_month_holidays(year: int, month: int) -> dict[str, str]:
    """
    특정 연월의 공휴일 목록을 반환합니다.

    반환 형식: {"20240101": "신정", ...}
    """
    prefix = f"{year}{month:02d}"
    return {k: v for k, v in _load_holidays().items() if k.startswith(prefix)}
