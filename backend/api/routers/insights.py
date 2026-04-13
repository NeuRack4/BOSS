"""
AI 인사이트 API
- 매출 데이터 + Claude API → 원인 분석 및 액션 제안
- 매출 하락 감지 시 trigger_log 자동 생성 (Proactive 트리거)
"""
from datetime import date
import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER, TriggerType
from backend.api.routers.sales import get_sales_summary
from backend.db.client import get_supabase

router = APIRouter()

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 1인 창업자 전담 AI 비서입니다.
창업자의 매출 데이터를 분석해 실질적인 인사이트와 액션을 제안합니다.

분석 시 아래 기준으로 답변하세요:
- 마포구 카페 평균(홍대·합정·연남·망원 권역) 맥락에서 해석
- 계절성·요일·시간대 패턴 고려
- 1인 운영 특성 (체력·시간 한계) 감안
- 실행 가능한 액션 2~3가지 구체적으로 제시
- 답변은 한국어, 친근하고 간결하게

답변 구조:
1. 핵심 요약 (1~2문장)
2. 원인 분석 (2~3줄)
3. 추천 액션 (번호 목록)
"""


class InsightRequest(BaseModel):
    user_id: str
    year: int
    month: int


@router.post("/analyze")
async def analyze_sales(req: InsightRequest):
    """매출 데이터 기반 LLM 인사이트 생성"""
    settings = get_settings()

    # 매출 요약 데이터 조회
    summary = await get_sales_summary(
        user_id=req.user_id,
        year=req.year,
        month=req.month,
    )

    # 데이터 없으면 안내 반환
    if summary["current_total"] == 0:
        return {
            "insight": "아직 이번달 매출 데이터가 없습니다. 매출을 입력하면 AI 분석을 시작합니다.",
            "summary": summary,
        }

    # LLM에 넘길 컨텍스트 구성
    change_text = (
        f"전달 대비 {abs(summary['change_pct'])}% {'증가' if summary['change_pct'] > 0 else '감소'}"
        if summary["change_pct"] is not None
        else "전달 데이터 없음"
    )

    user_message = f"""
[{req.year}년 {req.month}월 매출 현황]
- 이번달 총 매출: {summary['current_total']:,}원
- 전달 총 매출: {summary['prev_total']:,}원
- 변화율: {change_text}
- 거래 건수: {summary['transaction_count']}건
- 일 평균 매출: {summary['daily_average']:,}원

[카테고리별 매출]
{chr(10).join(f"- {k}: {v:,}원" for k, v in summary['category_breakdown'].items())}

[시간대별 매출]
{chr(10).join(f"- {k}: {v:,}원" for k, v in summary['timeslot_breakdown'].items())}

위 데이터를 바탕으로 마포구 카페 창업자에게 실질적인 인사이트와 액션을 제안해주세요.
""".strip()

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    insight_text = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"

    # Proactive 트리거 — 매출 10% 이상 하락 시 자동 알림 생성
    triggered = False
    print(f"[insights] 트리거 조건 확인: change_pct={summary['change_pct']}")
    if summary["change_pct"] is not None:
        print(f"[insights] 조건 충족 → trigger_log insert 시도")
        try:
            _insert_sales_change_trigger(
                user_id=req.user_id,
                change_pct=summary["change_pct"],
                year=req.year,
                month=req.month,
            )
            triggered = True
            print(f"[insights] trigger_log insert 성공")
        except Exception as e:
            print(f"[insights] trigger_log insert 실패: {e}")
    else:
        print(f"[insights] 조건 미충족 → 트리거 생성 안 함")

    return {
        "insight": insight_text,
        "summary": summary,
        "triggered": triggered,
    }


def _insert_sales_change_trigger(user_id: str, change_pct: float, year: int, month: int) -> None:
    """매출 변화 감지 → trigger_log 자동 삽입 (상승/하락 모두)"""
    supabase = get_supabase()
    if change_pct > 0:
        message = (
            f"[매출 상승 감지] {year}년 {month}월 매출이 전달 대비 "
            f"{change_pct:.1f}% 증가했습니다. "
            "AI 인사이트에서 상승 원인과 유지 전략을 확인해보세요."
        )
    else:
        message = (
            f"[매출 하락 감지] {year}년 {month}월 매출이 전달 대비 "
            f"{abs(change_pct):.1f}% 하락했습니다. "
            "AI 인사이트에서 원인 분석과 회복 전략을 확인해보세요."
        )
    supabase.table("trigger_log").insert({
        "user_id": user_id,
        "trigger_type": TriggerType.INFERENCE,
        "message": message,
    }).execute()
