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

ContentType = Literal["instagram", "blog", "naver_place", "menu_highlight"]

CONTENT_TYPE_LABELS = {
    "instagram":      "인스타그램 게시글",
    "blog":           "블로그 포스팅",
    "naver_place":    "네이버 플레이스",
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

⚠️ [핵심 프로모션]이 있다면 캡션에 자연스럽게 반드시 포함시켜야 해.

다음 형식으로 작성 (섹션 제목·레이블 없이 내용만 출력):
1. 캡션 본문 (감성적이고 자연스럽게, 3~5문장, 줄바꿈 포함 — 프로모션 내용 포함. "캡션", "본문" 등 제목 없이 바로 글만)
2. 빈 줄 2개
3. 해시태그 (총 25~30개, 한 줄에 나열 — "해시태그" 제목 없이 #으로 바로 시작)
   - 절반(12~15개)은 한국어: 마포구·카페·계절·메뉴명·동네명 위주
   - 절반(12~15개)은 영어: 외국인 여행자가 실제로 많이 검색하는 태그 위주
     예: #seoulcafe #koreanfood #coffeetime #cafehopping #traveltoseoul #hongdae #mapo #instacoffee #cafelife #seoultravel #koreanstyle #visitseoul 등
4. 빈 줄
5. 게시 최적 시간대 추천 1줄 (예: "💡 게시 추천 시간: 오후 2~4시 — 카페 피크타임 직전")
"""

_BLOG_PROMPT = """
아래 카페 정보를 바탕으로 네이버 블로그 포스팅을 작성해줘.

{cafe_context}

⚠️ [핵심 프로모션]이 있다면 제목과 본문에 반드시 포함시켜야 해.

반드시 아래 형식을 정확히 지켜서 출력해 (레이블·번호·설명 없이 내용만):

# [제목 — 클릭 유도, 25자 이내, 이모지 1개]

[도입 1~2문장 — 공감 또는 계절감으로 시작]

### [이모지] [소제목1 — 8자 이내]
[소제목 관련 내용 2~3문장. 핵심 정보 중심으로 간결하게.]

### [이모지] [소제목2 — 8자 이내]
[소제목 관련 내용 2~3문장. 메뉴나 분위기 묘사.]

### [이모지] [소제목3 — 8자 이내]
[마무리 2문장. 방문 유도 + 따뜻한 인사.]

#태그1 #태그2 #태그3 #태그4 #태그5 #태그6 #태그7 #태그8 #태그9 #태그10

작성 규칙:
- 한 단락은 2~3문장 이내로 짧고 읽기 쉽게
- 줄바꿈은 단락 사이에만 (단락 내 줄바꿈 없음)
- 소제목 바로 아래에 내용 (빈 줄 없이)
- 친근하고 자연스러운 구어체
"""

_NAVER_REVIEW_PROMPT = """
네이버 플레이스에 달린 고객 리뷰에 대한 사장님 답글을 작성해줘.

{cafe_context}

별점: {star_str} ({star_rating}점)
고객 리뷰 내용:
{review_content}

답글 원칙:
- 1인 카페 사장의 진정성 있는 목소리로 작성
- 별점별 톤:
  - 4~5점: 진심 어린 감사 + 재방문 유도 따뜻한 마무리
  - 3점: 감사 + 아쉬운 점 공감 + 더 나아지겠다는 의지 표현
  - 1~2점: 불편에 대한 진심 어린 사과 + 구체적 개선 의지 (감정적 대응 절대 금지)
- 100~150자 이내로 간결하게
- 제목·레이블 없이 답글 본문만 출력
"""

_NAVER_NOTICE_PROMPT = """
네이버 플레이스 공지사항 문구를 작성해줘.

{cafe_context}

공지 종류: {notice_type}

⚠️ [핵심 프로모션]이 있다면 공지 내용에 반드시 포함해야 해.

다음 형식으로 작성 (섹션 레이블 없이 내용만):
1. 공지 제목 (📢 이모지로 시작, 15자 이내)
2. 빈 줄
3. 공지 본문 (3~5줄, 핵심 정보 명확하게 — 날짜·시간이 있으면 구체적으로)
4. 빈 줄
5. 마무리 인사 1줄 (감사 + 양해 부탁)
"""

_MENU_HIGHLIGHT_PROMPT = """
아래 카페 정보를 바탕으로 메뉴 소개 게시글을 작성해줘.

{cafe_context}

⚠️ [핵심 프로모션]이 있다면 메뉴 소개에 자연스럽게 반드시 포함시켜야 해.

다음 형식으로 작성:
1. 인스타그램용 메뉴 소개 캡션 (감성적, 3~4문장 — 프로모션 내용 포함)
2. 메뉴 상세 설명 (재료·특징·추천 페어링, 5~7줄)
3. 가격 안내 문구 (자연스럽게)
4. 관련 해시태그 15개
"""

PROMPTS = {
    "instagram":      _INSTAGRAM_PROMPT,
    "blog":           _BLOG_PROMPT,
    "menu_highlight": _MENU_HIGHLIGHT_PROMPT,
}


class MarketingRequest(BaseModel):
    content_type: ContentType
    target_menu: str | None = None      # 강조할 메뉴명
    promotion: str | None = None        # 특별 내용 (할인·이벤트 등)
    year: int | None = None
    month: int | None = None
    # 네이버 플레이스 전용
    naver_place_type: Literal["review_reply", "notice"] | None = None
    star_rating: int | None = None      # 1~5점
    review_content: str | None = None   # 고객 리뷰 원문
    notice_type: str | None = None      # 임시휴무 | 영업시간변경 | 이벤트 | 신메뉴


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
    menu_list: list[str] | None = None,
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

    # 특별 내용은 가장 중요한 요소로 먼저 배치
    if promotion:
        lines.insert(0, f"[핵심 프로모션 — 반드시 콘텐츠에 반영]: {promotion}")

    if menu_list:
        lines.append(f"현재 메뉴 목록: {', '.join(menu_list)}")

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

    try:
        supabase_client = get_supabase()
        menus_data = (
            supabase_client.table("menus")
            .select("name, category")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
            .data or []
        )
        menu_list = [m["name"] for m in menus_data]
    except Exception:
        menu_list = []

    cafe_context = _build_cafe_context(
        cafe_info=cafe_info,
        top_menu=top_menu,
        target_menu=req.target_menu,
        promotion=req.promotion,
        year=year,
        month=month,
        sales_summary=sales_summary,
        expense_summary=expense_summary,
        menu_list=menu_list,
    )

    # 네이버 플레이스는 서브타입별 프롬프트 분기
    if req.content_type == "naver_place":
        if req.naver_place_type == "review_reply":
            star = req.star_rating or 5
            star_str = "★" * star + "☆" * (5 - star)
            user_message = _NAVER_REVIEW_PROMPT.format(
                cafe_context=cafe_context,
                star_str=star_str,
                star_rating=star,
                review_content=req.review_content or "(리뷰 내용 없음)",
            )
        else:
            user_message = _NAVER_NOTICE_PROMPT.format(
                cafe_context=cafe_context,
                notice_type=req.notice_type or "일반 공지",
            )
    else:
        prompt_template = PROMPTS[req.content_type]
        user_message = prompt_template.format(cafe_context=cafe_context)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=2048,
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


# ── 마케팅 전략 추천 ───────────────────────────────────────────────────────

_STRATEGY_SYSTEM = """당신은 서울 마포구 카페 1인 창업자를 위한 마케팅 전략가입니다.
카페 데이터를 분석해 지금 당장 실행 가능한 구체적 마케팅 전략을 추천합니다.
반드시 JSON만 응답하세요."""

_STRATEGY_PROMPT_PREFIX = "다음은 카페 현황 데이터입니다:\n"
_STRATEGY_PROMPT_SUFFIX = """
위 데이터를 바탕으로 지금 실행해야 할 마케팅 전략을 추천하고 JSON으로만 응답하세요.

{
  "overall_tip": "이번달 전체 마케팅 방향 2~3문장.",
  "strategies": [
    {
      "title": "전략 제목 (15자 이내)",
      "reason": "이 전략을 추천하는 근거 — 데이터 기반으로 구체적으로 2문장.",
      "action": "지금 당장 해야 할 구체적 행동 2~3문장.",
      "content_type": "instagram",
      "target_menu": "메뉴명 또는 null",
      "urgency": "high",
      "timing": "언제 하면 좋은지 (예: 이번 주말, 다음주 월요일)"
    }
  ]
}

기준:
- strategies는 3~5개
- content_type은 instagram / blog / event / menu_highlight 중 하나
- urgency는 high / medium / low 중 하나 (이번주 내 = high, 이번달 내 = medium, 장기 = low)
- target_menu는 추천 전략에서 강조할 메뉴명 (없으면 null)
- 매출이 낮은 달이면 이벤트/할인 중심, 매출이 높으면 SNS 인지도 확대 중심으로 추천
"""


@router.post("/strategy")
async def recommend_strategy(
    user_id: str = Depends(get_current_user_id),
):
    """매출·메뉴·공휴일 데이터 기반 이번달 마케팅 전략 3~5가지 추천"""
    settings = get_settings()
    today_date = date.today()
    year = today_date.year
    month = today_date.month

    cafe_info = _get_cafe_info(user_id)

    try:
        sales_summary = await get_sales_summary(user_id, year, month)
    except Exception:
        sales_summary = None

    # 메뉴 목록 조회
    supabase = get_supabase()
    try:
        menus_data = (
            supabase.table("menus")
            .select("name, category")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
            .data or []
        )
        menu_names = [m["name"] for m in menus_data]
    except Exception:
        menu_names = []

    holidays = get_month_holidays(year, month)
    holiday_str = (
        ", ".join(f"{d[-4:][:2]}일 {n}" for d, n in sorted(holidays.items()))
        if holidays else "없음"
    )

    context_lines = [
        f"카페명: {cafe_info.get('business_name', '우리 카페')}",
        f"위치: {cafe_info.get('address', '마포구')}",
        f"기준: {year}년 {month}월",
        f"계절: {_get_season_context(month)}",
        f"이번달 공휴일·기념일: {holiday_str}",
        f"현재 메뉴 목록: {', '.join(menu_names) if menu_names else '정보 없음'}",
    ]

    if sales_summary and sales_summary.get("current_total", 0) > 0:
        context_lines.append(f"이번달 매출: {sales_summary['current_total']:,}원")
        if sales_summary.get("change_pct") is not None:
            direction = "증가" if sales_summary["change_pct"] > 0 else "감소"
            context_lines.append(f"전달 대비: {abs(sales_summary['change_pct'])}% {direction}")
        cat_breakdown = sales_summary.get("category_breakdown", {})
        if cat_breakdown:
            top_cats = sorted(cat_breakdown.items(), key=lambda x: x[1], reverse=True)[:3]
            cat_str = " / ".join(f"{k} {v:,}원" for k, v in top_cats)
            context_lines.append(f"카테고리별 매출: {cat_str}")
    else:
        context_lines.append("매출 데이터: 아직 없음")

    context = "\n".join(context_lines)
    prompt = _STRATEGY_PROMPT_PREFIX + context + _STRATEGY_PROMPT_SUFFIX

    import json
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=3000,
        system=_STRATEGY_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        data = json.loads(raw.strip())
    except Exception:
        data = {"overall_tip": "", "strategies": []}

    return data


# ── 인스타그램 이미지 생성 (DALL-E 3) ────────────────────────────────────────

_IMAGE_PROMPT_SYSTEM = """You are a professional food photographer and DALL-E 3 prompt engineer.
Generate an optimized English prompt for DALL-E 3 to create an Instagram-worthy cafe photo.
Return ONLY the image prompt string, nothing else."""

_IMAGE_PROMPT_USER = """Create a DALL-E 3 prompt for an Instagram photo for a Korean cafe in Mapo-gu, Seoul.

Menu to feature: {menu}
Season/Month: {season}
Cafe area: {area}
Special context: {promotion}

Requirements:
- Professional food/cafe photography style
- Instagram-worthy aesthetic, warm and cozy atmosphere
- Natural lighting, shallow depth of field
- Korean indie cafe vibe (홍대/연남/망원 감성)
- Menu item should be the hero of the shot
- Include seasonal elements if relevant

Output ONLY the English DALL-E 3 prompt (2-3 sentences max)."""


class ImageRequest(BaseModel):
    target_menu: str | None = None
    promotion: str | None = None
    content_type: ContentType = "instagram"


@router.post("/image")
async def generate_image(
    req: ImageRequest,
    user_id: str = Depends(get_current_user_id),
):
    """DALL-E 3로 인스타그램용 카페 이미지 생성"""
    from openai import AsyncOpenAI

    settings = get_settings()
    if not settings.openai_api_key:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="OpenAI API 키가 설정되지 않았습니다. .env에 OPENAI_API_KEY를 추가해주세요.")

    today_date = date.today()
    month = today_date.month
    season = _get_season_context(month)

    cafe_info = _get_cafe_info(user_id)
    address = cafe_info.get("address", "마포구")
    area = next(
        (a for a in ["홍대", "합정", "연남", "망원", "공덕", "성산", "마포", "아현", "신수"]
         if a in (address or "")),
        "마포구"
    )

    menu = req.target_menu or "시그니처 음료"

    # Claude로 최적화된 DALL-E 프롬프트 생성
    anthropic_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt_msg = await anthropic_client.messages.create(
        model=settings.claude_model,
        max_tokens=300,
        system=_IMAGE_PROMPT_SYSTEM,
        messages=[{"role": "user", "content": _IMAGE_PROMPT_USER.format(
            menu=menu,
            season=season,
            area=area,
            promotion=req.promotion or "없음",
        )}],
    )
    dalle_prompt = prompt_msg.content[0].text.strip()

    # DALL-E 3 이미지 생성
    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await openai_client.images.generate(
        model="dall-e-3",
        prompt=dalle_prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )

    image_url = response.data[0].url
    revised_prompt = response.data[0].revised_prompt or dalle_prompt

    return {
        "image_url": image_url,
        "dalle_prompt": dalle_prompt,
        "revised_prompt": revised_prompt,
        "menu": menu,
    }
