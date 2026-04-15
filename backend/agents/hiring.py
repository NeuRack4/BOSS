"""
채용/서류 에이전트
- 채용공고 초안 생성 (플랫폼별: 당근마켓 / 알바천국 / 사람인)
- 근로계약서 초안 생성 (표준 양식 기반)
- 주휴수당 / 4대보험 / 월 인건비 계산
"""
from datetime import date

import anthropic

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER, DraftType, FounderSubStage
from backend.rag.retriever.pgvector_retriever import retrieve

# 2026년 최저임금 (시간급) — 연 1회 갱신
MIN_WAGE_2025 = 10_320  # 원/시간 (2026년 기준)

_POSTING_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 위한 채용공고 작성 AI 비서입니다.
마포구(홍대입구·합정·연남동·망원동) 상권에 특화된 현실적인 채용공고를 작성합니다.

규칙:
- 플랫폼별(당근마켓·알바천국·사람인) 포맷 차이를 반영하세요.
- 최저임금 이상의 시급을 명시하고 주휴수당 포함 여부를 명확히 하세요.
- 지나치게 요구사항이 많거나 허황된 표현은 사용하지 마세요.
- 면책 고지는 출력 마지막에 반드시 포함하세요.
"""

_CONTRACT_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 위한 노무 AI 비서입니다.
고용노동부 표준 근로계약서 양식을 기반으로 초안을 작성합니다.

규칙:
- 주 15시간 이상 근무 시 주휴수당·4대보험 가입 의무를 반드시 명시하세요.
- 빈칸([   ])은 창업자가 직접 채워야 할 항목으로 표시하세요.
- 법적 효력에 대한 최종 확인은 노무사에게 받도록 안내하세요.
- 면책 고지는 출력 마지막에 반드시 포함하세요.
"""


# ── 임금 계산 ──────────────────────────────────────────────────────────────

def calc_weekly_holiday_pay(hourly_wage: int, weekly_hours: float) -> int:
    """주휴수당 계산 (주 15시간 이상 근무 시 발생)"""
    if weekly_hours < 15:
        return 0
    daily_wage = hourly_wage * (weekly_hours / 5)
    return int(daily_wage)


def calc_total_labor_cost(hourly_wage: int, weekly_hours: float) -> dict:
    """
    월 총 인건비 시뮬레이션.

    반환:
    {
        "hourly_wage": int,
        "weekly_hours": float,
        "weekly_holiday_pay": int,       # 주당 주휴수당
        "monthly_base_pay": int,         # 월 기본급 (4.345주 기준)
        "monthly_holiday_pay": int,      # 월 주휴수당
        "monthly_total": int,            # 월 총 지급액
        "four_insurance_required": bool, # 4대보험 가입 의무 여부
        "note": str,
    }
    """
    weekly_holiday = calc_weekly_holiday_pay(hourly_wage, weekly_hours)
    monthly_base = int(hourly_wage * weekly_hours * 4.345)
    monthly_holiday = int(weekly_holiday * 4.345)
    monthly_total = monthly_base + monthly_holiday
    four_insurance = weekly_hours >= 15

    note_parts = []
    if four_insurance:
        note_parts.append("주 15시간 이상 → 4대보험 가입 의무")
    if weekly_hours < 15:
        note_parts.append("주 15시간 미만 → 주휴수당 미발생, 4대보험 미가입 가능")

    return {
        "hourly_wage": hourly_wage,
        "weekly_hours": weekly_hours,
        "weekly_holiday_pay": weekly_holiday,
        "monthly_base_pay": monthly_base,
        "monthly_holiday_pay": monthly_holiday,
        "monthly_total": monthly_total,
        "four_insurance_required": four_insurance,
        "note": " / ".join(note_parts) if note_parts else "",
    }


# ── 채용공고 초안 생성 ──────────────────────────────────────────────────────

async def generate_job_posting_draft(ctx, extra: dict | None = None) -> dict:
    """
    플랫폼별 채용공고 초안 생성.

    extra: 프론트에서 직접 입력한 추가 정보 (없어도 동작)
    {
        business_name, address, work_days, work_start, work_end,
        work_period, headcount, job_duties, preferred, benefits, extra_note,
        hourly_wage, weekly_hours
    }

    반환:
    {
        "draft_type": "job_posting",
        "platforms": { "karrot": str, "alba": str, "saramin": str },
        "wage_simulation": dict,
    }
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    docs = await retrieve(
        query="카페 아르바이트 채용공고 마포구 홍대 연남동",
        category="labor",
        match_count=3,
    )
    rag_context = "\n\n".join(d["content"] for d in docs)

    neighborhood = getattr(ctx, "region", "마포구")
    ex = extra or {}

    hourly_wage = ex.get("hourly_wage", MIN_WAGE_2025)
    weekly_hours = ex.get("weekly_hours", 20)
    business_name = ex.get("business_name") or f"서울 {neighborhood} 카페"
    address = ex.get("address") or f"서울 {neighborhood} (상세 주소 [   ])"

    # 근무 일정 문자열 조립
    work_days_str = "·".join(ex.get("work_days", [])) or "[   ]"
    work_time_str = (
        f"{ex['work_start']}~{ex['work_end']}"
        if ex.get("work_start") and ex.get("work_end")
        else "[   ]"
    )
    work_period_str = ex.get("work_period") or "협의"
    headcount = ex.get("headcount", 1)

    # 항목 리스트 문자열 조립
    duties_str = (
        ", ".join(ex["job_duties"]) if ex.get("job_duties")
        else "카운터 응대, 에스프레소 음료 제조, 홀 관리, 마감 청소"
    )
    preferred_str = (
        ", ".join(ex["preferred"]) if ex.get("preferred")
        else "바리스타 자격증 보유자, 마포구 거주자, 성실하고 밝은 분"
    )
    benefits_str = (
        ", ".join(ex["benefits"]) if ex.get("benefits")
        else "없음"
    )
    extra_note_str = ex.get("extra_note") or ""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=3000,
        system=_POSTING_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"서울 {neighborhood} 카페 알바 채용공고를 플랫폼별로 작성해주세요.\n\n"
                    "[작성 조건]\n"
                    f"- 사업장명: {business_name}\n"
                    f"- 근무지: {address}\n"
                    f"- 모집 인원: {headcount}명\n"
                    f"- 모집 직무: {duties_str}\n"
                    f"- 시급: {hourly_wage:,}원\n"
                    f"- 주 근무시간: {weekly_hours}시간\n"
                    f"- 근무 요일: {work_days_str}\n"
                    f"- 근무 시간대: {work_time_str}\n"
                    f"- 근무 기간: {work_period_str}\n"
                    f"- 우대 조건: {preferred_str}\n"
                    f"- 복리후생: {benefits_str}\n"
                    + (f"- 추가 안내: {extra_note_str}\n" if extra_note_str else "")
                    + "\n[플랫폼별 포맷]\n"
                    "1. 당근마켓: 간결·친근한 말투, 이모지 허용, 300자 이내 핵심만\n"
                    "2. 알바천국: 표준 구인 양식 (제목/모집내용/근무조건/급여/우대사항)\n"
                    "3. 사람인: 공식적인 말투, 회사 소개 포함, 지원 방법 명시\n\n"
                    f"[참고 자료]\n{rag_context}\n\n"
                    f"[참고] 2026년 최저임금: {MIN_WAGE_2025:,}원/시간\n\n"
                    "각 플랫폼 초안을 [당근마켓], [알바천국], [사람인] 헤더로 구분하여 출력하세요.\n"
                    f"\n---\n{LEGAL_DISCLAIMER}"
                ),
            }
        ],
    )

    raw = message.content[0].text
    platforms = _parse_platform_sections(raw)
    wage_sim = calc_total_labor_cost(hourly_wage, weekly_hours)

    return {
        "draft_type": DraftType.JOB_POSTING,
        "platforms": platforms,
        "wage_simulation": wage_sim,
        "raw_draft": raw,
        "calculated_at": str(date.today()),
    }


def _parse_platform_sections(text: str) -> dict:
    """LLM 출력에서 [당근마켓] / [알바천국] / [사람인] 섹션을 분리"""
    import re
    sections = {"karrot": "", "alba": "", "saramin": ""}
    markers = [
        (r"\[당근마켓\]", "karrot"),
        (r"\[알바천국\]", "alba"),
        (r"\[사람인\]", "saramin"),
    ]
    # 각 마커 위치를 찾아 다음 마커 직전까지 추출
    positions = []
    for pattern, key in markers:
        m = re.search(pattern, text)
        if m:
            positions.append((m.start(), m.end(), key))
    positions.sort()

    for i, (start, end, key) in enumerate(positions):
        next_start = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        sections[key] = text[end:next_start].strip()

    # 파싱 실패 시 전체 텍스트를 karrot에 저장
    if not any(sections.values()):
        sections["karrot"] = text

    return sections


# ── 근로계약서 초안 생성 ────────────────────────────────────────────────────

async def generate_labor_contract_draft(ctx, weekly_hours: float = 20.0) -> dict:
    """
    표준 근로계약서 초안 생성.

    반환:
    {
        "draft_type": "labor_contract",
        "draft": str,
        "wage_simulation": dict,
    }
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    docs = await retrieve(
        query="표준 근로계약서 카페 아르바이트 주휴수당 4대보험",
        category="labor",
        match_count=5,
    )
    context = "\n\n".join(d["content"] for d in docs)

    wage_sim = calc_total_labor_cost(MIN_WAGE_2025, weekly_hours)

    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=3000,
        system=_CONTRACT_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "마포구 카페 아르바이트 근로계약서 초안을 작성해주세요.\n\n"
                    "[근로 조건]\n"
                    "- 사업장명: [   ] 카페 (창업자 채울 항목)\n"
                    "- 근무지: 서울 마포구 [   ] (창업자 채울 항목)\n"
                    f"- 근로 형태: 단시간 근로자 (주 {weekly_hours}시간)\n"
                    f"- 시급: {MIN_WAGE_2025:,}원 (2026년 최저임금 기준)\n"
                    f"- 월 예상 급여: {wage_sim['monthly_total']:,}원 "
                    f"(기본급 {wage_sim['monthly_base_pay']:,}원 + "
                    f"주휴수당 {wage_sim['monthly_holiday_pay']:,}원)\n"
                    f"- 4대보험: {'가입 의무' if wage_sim['four_insurance_required'] else '미가입 가능 (주 15시간 미만)'}\n"
                    "- 근무 기간: [   ] ~ [   ] (창업자 채울 항목)\n"
                    "- 근무 시간: [   ] ~ [   ] (창업자 채울 항목)\n\n"
                    "[표준 근로계약서 참고 자료]\n"
                    f"{context}\n\n"
                    "빈칸([   ])은 창업자가 실제 상황에 맞게 채워야 하는 항목입니다.\n"
                    f"\n---\n{LEGAL_DISCLAIMER}"
                ),
            }
        ],
    )

    draft = message.content[0].text

    return {
        "draft_type": DraftType.LABOR_CONTRACT,
        "draft": draft,
        "wage_simulation": wage_sim,
        "calculated_at": str(date.today()),
    }


# ── 채용공고 HTML 디자인 생성 (Claude Haiku) ──────────────────────────────────

_VISUAL_SYSTEM_PROMPT = """
당신은 한국 카페 채용공고 디자인 전문가입니다.
주어진 채용 정보를 바탕으로 아름답고 인쇄 가능한 HTML 채용공고를 만들어주세요.

규칙:
- 완전한 standalone HTML (외부 CDN 없음, 모든 CSS 인라인 또는 <style> 블록)
- A4 기준 단일 페이지, 인쇄/PDF 저장에 최적화 (@media print 포함)
- 한국어 전용, 폰트는 system-ui 또는 'Apple SD Gothic Neo', sans-serif 사용
- 화려하되 실용적인 디자인 — 실제 카페 채용공고처럼 보여야 함
- HTML 코드만 출력 (설명 텍스트 없이, ```html 블록 없이 순수 HTML만)
"""


async def generate_job_posting_visual(job_data: dict, style_prompt: str = "") -> dict:
    """
    Claude Haiku로 채용공고 HTML 디자인 생성.

    job_data: JobPostingRequest 필드 전체
    style_prompt: 사용자 디자인 지시 (예: "밝고 트렌디한 핑크 톤")

    반환: {"html": str, "calculated_at": str}
    """
    import re
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    ex = job_data
    hourly_wage = ex.get("hourly_wage", MIN_WAGE_2025)
    weekly_hours = ex.get("weekly_hours", 20)
    wage_sim = calc_total_labor_cost(hourly_wage, weekly_hours)

    work_days_str = "·".join(ex.get("work_days", [])) or "협의"
    work_time_str = (
        f"{ex['work_start']} ~ {ex['work_end']}"
        if ex.get("work_start") and ex.get("work_end") else "협의"
    )

    duties_str = "\n".join(f"• {d}" for d in ex.get("job_duties", [])) or "• 음료 제조 및 카운터 응대"
    preferred_str = "\n".join(f"• {p}" for p in ex.get("preferred", [])) or "• 성실하고 밝은 분"
    benefits_str = "\n".join(f"• {b}" for b in ex.get("benefits", [])) or "• 음료 무료 제공"

    user_content = f"""다음 정보로 채용공고 HTML을 만들어주세요.

[디자인 스타일 요청]
{style_prompt if style_prompt else "깔끔하고 모던한 카페 느낌, 따뜻한 브라운 계열 색상"}

[채용 정보]
카페명: {ex.get('business_name') or '○○ 카페'}
주소: {ex.get('address') or '서울 마포구'}
모집 인원: {ex.get('headcount', 1)}명
시급: {hourly_wage:,}원
주 근무시간: {weekly_hours}시간
월 예상 급여: {wage_sim['monthly_total']:,}원 (주휴수당 포함)
4대보험: {'가입' if wage_sim['four_insurance_required'] else '미가입 (주 15시간 미만)'}
근무 요일: {work_days_str}
근무 시간: {work_time_str}
근무 기간: {ex.get('work_period') or '협의'}

[주요 업무]
{duties_str}

[우대 조건]
{preferred_str}

[복리후생]
{benefits_str}

[추가 안내]
{ex.get('extra_note') or '없음'}
"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=_VISUAL_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = message.content[0].text.strip()

    # ```html ... ``` 블록이 있으면 내용만 추출
    match = re.search(r"```html\s*([\s\S]*?)```", raw)
    html = match.group(1).strip() if match else raw

    return {"html": html, "calculated_at": str(date.today())}


# ── 오케스트레이터 진입점 ──────────────────────────────────────────────────

async def run(ctx) -> dict:
    """
    채용 에이전트 메인 진입점.
    서브스테이지에 따라 공고 초안 또는 계약서 초안을 생성.
    """
    sub_stage = getattr(ctx, "sub_stage", None)

    if sub_stage == FounderSubStage.HIRING_CONTRACT:
        # 면접 완료 → 근로계약서 초안 자동 생성
        result = await generate_labor_contract_draft(ctx)
        return {
            "agent": "hiring",
            "action": "labor_contract",
            **result,
        }

    # HIRING_PREPARATION / HIRING_IN_PROGRESS / 기타 → 채용공고 초안
    posting = await generate_job_posting_draft(ctx)
    return {
        "agent": "hiring",
        "action": "job_posting",
        **posting,
    }
