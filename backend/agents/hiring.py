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

# 2025년 최저임금 (시간급) — 연 1회 갱신
MIN_WAGE_2025 = 10_030  # 원/시간

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

async def generate_job_posting_draft(ctx) -> dict:
    """
    플랫폼별 채용공고 초안 생성.

    반환:
    {
        "draft_type": "job_posting",
        "platforms": {
            "karrot": str,    # 당근마켓 포맷
            "alba": str,      # 알바천국 포맷
            "saramin": str,   # 사람인 포맷
        },
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
    context = "\n\n".join(d["content"] for d in docs)

    neighborhood = getattr(ctx, "region", "마포구")

    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=3000,
        system=_POSTING_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"서울 {neighborhood} 카페 알바 채용공고를 플랫폼별로 작성해주세요.\n\n"
                    "[작성 조건]\n"
                    f"- 근무지: 서울 {neighborhood} 카페 (주소는 [   ]로 표시)\n"
                    "- 모집 직무: 카운터 응대, 에스프레소 음료 제조, 홀 관리, 마감 청소\n"
                    f"- 시급: {MIN_WAGE_2025:,}원 이상 (협의 가능)\n"
                    "- 근무 시간: 주 [   ]시간 (창업자가 채울 항목)\n"
                    "- 우대: 바리스타 자격증 보유자, 마포구 거주자, 성실하고 밝은 분\n\n"
                    "[플랫폼별 포맷]\n"
                    "1. 당근마켓: 간결·친근한 말투, 이모지 허용, 300자 이내 핵심만\n"
                    "2. 알바천국: 표준 구인 양식 (제목/모집내용/근무조건/급여/우대사항)\n"
                    "3. 사람인: 공식적인 말투, 회사 소개 포함, 지원 방법 명시\n\n"
                    f"[참고 자료]\n{context}\n\n"
                    f"[참고] 2025년 최저임금: {MIN_WAGE_2025:,}원/시간\n\n"
                    "각 플랫폼 초안을 [당근마켓], [알바천국], [사람인] 헤더로 구분하여 출력하세요.\n"
                    f"\n---\n{LEGAL_DISCLAIMER}"
                ),
            }
        ],
    )

    raw = message.content[0].text

    # 플랫폼별 섹션 파싱
    platforms = _parse_platform_sections(raw)
    wage_sim = calc_total_labor_cost(MIN_WAGE_2025, 20)  # 주 20시간 기준 예시

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
                    f"- 시급: {MIN_WAGE_2025:,}원 (2025년 최저임금 기준)\n"
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
