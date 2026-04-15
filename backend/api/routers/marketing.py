"""
마케팅 AI API
- 매출·메뉴·상권 데이터 기반 SNS 콘텐츠 초안 자동 생성 (Claude API)
- 콘텐츠 타입: instagram | blog | event | menu_highlight
"""
import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Literal
from datetime import date

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.core.holidays import get_month_holidays
from backend.api.dependencies import get_current_user_id
from backend.api.routers.sales import get_sales_summary
from backend.api.routers.expenses import get_expense_summary
from backend.db.client import get_supabase

router = APIRouter()

ContentType = Literal["instagram", "blog", "event", "menu_highlight"]

CONTENT_TYPE_LABELS = {
    "instagram":      "인스타그램 게시글",
    "blog":           "블로그 포스팅",
    "event":          "이벤트·프로모션 문구",
    "menu_highlight": "메뉴 소개 게시글",
}

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 1인 창업자를 위한 마케팅 콘텐츠 전문가입니다.
카페 데이터(매출·인기 메뉴·상권·날씨·공휴일)를 바탕으로 SNS 콘텐츠를 작성합니다.

작성 원칙:
- 아래 [카페 정보] 컨텍스트에 제공된 수치와 사실만 사용한다. 컨텍스트에 없는 매출액·방문자수·수치는 절대 언급하거나 만들어내지 않는다.
- 마포구 지역 특성(홍대·연남·망원 등)을 반영한 감성적 표현
- 1인 카페 운영자의 진정성 있는 목소리로 작성
- 과장 없이 솔직하고 친근한 톤
"""

_INSTAGRAM_PROMPT = """
아래 카페 정보를 바탕으로 인스타그램 게시글을 작성해줘.

{cafe_context}

다음 형식으로 작성:
1. 캡션 (감성적이고 자연스럽게, 3~5문장, 줄바꿈 포함)
2. 빈 줄
3. 해시태그 (20~30개, 마포구·카페·계절·메뉴명 포함, 한 줄에 나열)
4. 빈 줄
5. 게시 최적 시간대 추천 1줄 (예: "💡 게시 추천 시간: 오후 2~4시 — 카페 피크타임 직전")
"""

_BLOG_PROMPT = """
아래 카페 정보를 바탕으로 네이버 블로그 포스팅 초안을 작성해줘.

{cafe_context}

다음 형식으로 작성:
1. 제목 (클릭 유도, 30자 이내)
2. 본문 (400~600자, 소제목 2~3개 포함, 방문 유도로 마무리)
3. 태그 추천 10개
"""

_EVENT_PROMPT = """
아래 카페 정보를 바탕으로 이벤트·프로모션 문구를 작성해줘.

{cafe_context}

다음 형식으로 작성:
1. 이벤트 제목 (임팩트 있게, 20자 이내)
2. 이벤트 내용 (구체적인 혜택, 기간, 조건 포함, 3~5줄)
3. SNS 공지용 짧은 버전 (2줄, 이모지 포함)
4. 오프라인 안내문 버전 (카페 입구 부착용, 간결하게)
"""

_MENU_HIGHLIGHT_PROMPT = """
아래 카페 정보를 바탕으로 메뉴 소개 게시글을 작성해줘.

{cafe_context}

다음 형식으로 작성:
1. 인스타그램용 메뉴 소개 캡션 (감성적, 3~4문장)
2. 메뉴 상세 설명 (재료·특징·추천 페어링, 5~7줄)
3. 가격 안내 문구 (자연스럽게)
4. 관련 해시태그 15개
"""

PROMPTS = {
    "instagram":      _INSTAGRAM_PROMPT,
    "blog":           _BLOG_PROMPT,
    "event":          _EVENT_PROMPT,
    "menu_highlight": _MENU_HIGHLIGHT_PROMPT,
}


class MarketingRequest(BaseModel):
    content_type: ContentType
    target_menu: str | None = None      # 강조할 메뉴명
    promotion: str | None = None        # 특별 내용 (할인·이벤트 등)
    year: int | None = None
    month: int | None = None


def _get_cafe_info(user_id: str) -> dict:
    """Supabase에서 카페 기본 정보 조회"""
    supabase = get_supabase()
    try:
        result = (
            supabase.table("founder_business_info")
            .select("business_name, address")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}


def _get_top_menu(user_id: str, year: int, month: int) -> str | None:
    """해당 월 가장 많이 팔린 카테고리 반환"""
    supabase = get_supabase()
    import calendar
    _, last_day = calendar.monthrange(year, month)
    try:
        rows = (
            supabase.table("sales")
            .select("category, amount")
            .eq("user_id", user_id)
            .gte("date", f"{year}-{month:02d}-01")
            .lte("date", f"{year}-{month:02d}-{last_day:02d}")
            .execute()
            .data
        )
        if not rows:
            return None
        totals: dict[str, int] = {}
        for r in rows:
            totals[r["category"]] = totals.get(r["category"], 0) + r["amount"]
        return max(totals, key=totals.get)
    except Exception:
        return None


def _get_season_context(month: int) -> str:
    """월 → 계절·날씨 컨텍스트"""
    if month in (3, 4, 5):
        return f"봄({month}월) — 꽃놀이·나들이 시즌, 야외 활동 증가"
    elif month in (6, 7, 8):
        return f"여름({month}월) — 무더위, 아이스 음료 수요 급증"
    elif month in (9, 10, 11):
        return f"가을({month}월) — 선선한 날씨, 따뜻한 음료 수요 증가"
    else:
        return f"겨울({month}월) — 추위, 따뜻한 음료·디저트 선호"


def _build_cafe_context(
    cafe_info: dict,
    top_menu: str | None,
    target_menu: str | None,
    promotion: str | None,
    year: int,
    month: int,
    sales_summary: dict | None = None,
    expense_summary: dict | None = None,
) -> str:
    holidays = get_month_holidays(year, month)
    holiday_str = (
        ", ".join(f"{d[-4:][:2]}일 {n}" for d, n in sorted(holidays.items()))
        if holidays else "없음"
    )

    menu_info = target_menu or top_menu or "시그니처 음료"
    address = cafe_info.get("address", "마포구")
    area = next(
        (a for a in ["홍대", "합정", "연남", "망원", "공덕", "성산", "마포", "아현", "신수"]
         if a in (address or "")),
        "마포구"
    )

    lines = [
        f"카페명: {cafe_info.get('business_name', '우리 카페')}",
        f"위치: {area} 상권",
        f"기준 월: {year}년 {month}월",
        f"계절·날씨: {_get_season_context(month)}",
        f"이번달 공휴일: {holiday_str}",
        f"강조할 메뉴: {menu_info}",
    ]

    # 실제 매출 데이터가 있을 때만 주입
    if sales_summary and sales_summary.get("current_total", 0) > 0:
        lines.append(f"이번달 총 매출: {sales_summary['current_total']:,}원")
        if sales_summary.get("change_pct") is not None:
            direction = "증가" if sales_summary["change_pct"] > 0 else "감소"
            lines.append(f"전달 대비: {abs(sales_summary['change_pct'])}% {direction}")
        # 카테고리별 매출 TOP 3 (수치 있는 항목만)
        cat_breakdown = sales_summary.get("category_breakdown", {})
        if cat_breakdown:
            top_cats = sorted(cat_breakdown.items(), key=lambda x: x[1], reverse=True)[:3]
            cat_str = " / ".join(f"{k} {v:,}원" for k, v in top_cats)
            lines.append(f"인기 카테고리(이번달): {cat_str}")

    # 실제 비용 데이터가 있을 때만 주입
    if expense_summary and expense_summary.get("total_expenses", 0) > 0:
        net = (sales_summary or {}).get("current_total", 0) - expense_summary["total_expenses"]
        lines.append(f"이번달 총 비용: {expense_summary['total_expenses']:,}원")
        if net >= 0:
            lines.append(f"이번달 순수익(추정): {net:,}원")

    if promotion:
        lines.append(f"특별 내용: {promotion}")

    return "\n".join(lines)


@router.post("/content")
async def generate_content(
    req: MarketingRequest,
    user_id: str = Depends(get_current_user_id),
):
    """매출·메뉴·상권 데이터 기반 마케팅 콘텐츠 초안 생성"""
    settings = get_settings()
    today = date.today()
    year = req.year or today.year
    month = req.month or today.month

    cafe_info = _get_cafe_info(user_id)
    top_menu = _get_top_menu(user_id, year, month)

    # 실데이터 조회 (실패해도 콘텐츠 생성은 계속)
    try:
        sales_summary = await get_sales_summary(user_id, year, month)
    except Exception:
        sales_summary = None
    try:
        expense_summary = await get_expense_summary(user_id, year, month)
    except Exception:
        expense_summary = None

    cafe_context = _build_cafe_context(
        cafe_info=cafe_info,
        top_menu=top_menu,
        target_menu=req.target_menu,
        promotion=req.promotion,
        year=year,
        month=month,
        sales_summary=sales_summary,
        expense_summary=expense_summary,
    )

    prompt_template = PROMPTS[req.content_type]
    user_message = prompt_template.format(cafe_context=cafe_context)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    content_text = message.content[0].text

    return {
        "content_type": req.content_type,
        "content_type_label": CONTENT_TYPE_LABELS[req.content_type],
        "content": content_text,
        "cafe_context": cafe_context,
        "menu_used": req.target_menu or top_menu,
    }
