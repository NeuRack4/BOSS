"""
AI 인사이트 API
- 매출 데이터 + RAG(마포구 카페 통계) + Claude API → 근거 기반 원인 분석 및 액션 제안
- 매출 변화 감지 시 trigger_log 자동 생성 (Proactive 트리거)
"""
import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from backend.core.config import get_settings
from backend.core.constants import DocumentCategory, LEGAL_DISCLAIMER, TriggerType
from backend.api.routers.sales import get_sales_summary
from backend.db.client import get_supabase
from backend.rag.retriever.pgvector_retriever import retrieve

router = APIRouter()

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 1인 창업자 전담 AI 비서입니다.
창업자의 매출 데이터와 아래 [마포구 상권 참고 데이터]를 바탕으로 분석합니다.

분석 시 아래 기준으로 답변하세요:
- [마포구 상권 참고 데이터]에 있는 수치를 인용해 근거를 구체적으로 제시
- 계절성·요일·시간대 패턴을 반드시 고려
- 1인 운영 특성 (체력·시간 한계) 감안
- 실행 가능한 액션 2~3가지 구체적으로 제시
- 답변은 한국어, 친근하고 간결하게

답변 구조:
1. 핵심 요약 (1~2문장, 마포구 평균 대비 위치 포함)
2. 원인 분석 (2~3줄, 참고 데이터 수치 인용)
3. 추천 액션 (번호 목록)
"""


class InsightRequest(BaseModel):
    user_id: str
    year: int
    month: int


def _build_rag_queries(month: int, change_pct: float | None) -> list[str]:
    """상황에 맞는 RAG 검색 쿼리 목록 생성"""
    queries = [f"마포구 카페 {month}월 매출 계절 패턴"]

    if change_pct is None:
        queries.append("마포구 카페 월평균 매출 권역별 통계")
    elif change_pct <= -10:
        queries.append("카페 매출 하락 원인 회복 전략")
        queries.append("마포구 카페 비수기 대응")
    elif change_pct >= 10:
        queries.append("카페 매출 상승 유지 전략")
        queries.append("마포구 카페 성수기 매출 확대")
    else:
        queries.append("마포구 카페 매출 안정 유지 전략")

    return queries


async def _retrieve_rag_context(month: int, change_pct: float | None) -> str:
    """RAG에서 관련 마포구 카페 통계를 검색해 컨텍스트 문자열로 반환"""
    queries = _build_rag_queries(month, change_pct)

    seen_ids: set = set()
    chunks: list[str] = []

    for query in queries:
        try:
            docs = await retrieve(
                query=query,
                category=DocumentCategory.MAPO_STATS,
                match_count=3,
                match_threshold=0.5,
            )
            for doc in docs:
                doc_id = doc.get("id")
                if doc_id not in seen_ids:
                    seen_ids.add(doc_id)
                    chunks.append(doc["content"])
        except Exception as e:
            print(f"[insights] RAG 검색 실패 (query={query}): {e}")

    if not chunks:
        return ""

    return "\n\n".join(f"• {c}" for c in chunks)


@router.post("/analyze")
async def analyze_sales(req: InsightRequest):
    """매출 데이터 기반 RAG + LLM 인사이트 생성"""
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

    change_pct = summary["change_pct"]
    yoy_change_pct = summary["yoy_change_pct"]

    # RAG 검색 — 마포구 카페 통계 컨텍스트 수집
    rag_context = await _retrieve_rag_context(req.month, change_pct)

    # LLM에 넘길 컨텍스트 구성
    change_text = (
        f"전달 대비 {abs(change_pct)}% {'증가' if change_pct > 0 else '감소'}"
        if change_pct is not None
        else "전달 데이터 없음"
    )
    yoy_text = (
        f"전년 동월 대비 {abs(yoy_change_pct)}% {'증가' if yoy_change_pct > 0 else '감소'}"
        if yoy_change_pct is not None
        else "전년 데이터 없음"
    )

    rag_section = (
        f"\n[마포구 상권 참고 데이터]\n{rag_context}\n"
        if rag_context
        else ""
    )

    user_message = f"""
[{req.year}년 {req.month}월 매출 현황]
- 이번달 총 매출: {summary['current_total']:,}원
- 전달 총 매출: {summary['prev_total']:,}원
- 전달 대비: {change_text}
- 전년 동월 총 매출: {summary['yoy_total']:,}원
- 전년 동월 대비: {yoy_text}
- 거래 건수: {summary['transaction_count']}건
- 일 평균 매출: {summary['daily_average']:,}원

[카테고리별 매출]
{chr(10).join(f"- {k}: {v:,}원" for k, v in summary['category_breakdown'].items())}

[시간대별 매출]
{chr(10).join(f"- {k}: {v:,}원" for k, v in summary['timeslot_breakdown'].items())}
{rag_section}
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

    # Proactive 트리거 — 매출 변화 감지 시 trigger_log 자동 생성
    triggered = False
    if change_pct is not None:
        try:
            _insert_sales_change_trigger(
                user_id=req.user_id,
                change_pct=change_pct,
                year=req.year,
                month=req.month,
            )
            triggered = True
        except Exception as e:
            print(f"[insights] trigger_log insert 실패: {e}")

    return {
        "insight": insight_text,
        "summary": summary,
        "triggered": triggered,
        "rag_used": bool(rag_context),
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
