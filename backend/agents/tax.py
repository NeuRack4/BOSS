"""
세금/일정 에이전트
- 부가세 / 종합소득세 기한 관리 (Supabase DB 기반)
- 사업자등록 · 식품위생 인허가 절차 안내
- 세금 신고서 초안 생성 + Supabase Storage 저장
"""
from datetime import date, timedelta
import anthropic
from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER, DraftType
from backend.rag.retriever.pgvector_retriever import retrieve
from backend.db.client import get_supabase


_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 위한 세금·행정 AI 비서입니다.
관련 법령과 절차를 정확하게 안내하되, 모든 답변 하단에 면책 고지를 포함합니다.
"""

_DRAFT_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 창업자를 위한 세금 신고 준비를 돕는 AI입니다.
주어진 세금 정보를 바탕으로 신고 체크리스트와 준비 사항 초안을 작성합니다.
모든 내용은 참고용이며, 실제 신고 전 세무사 확인이 필요합니다.
"""


async def run(ctx) -> dict:
    """세금/인허가 에이전트 메인 실행"""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    docs = await retrieve(
        query="카페 식품위생 인허가 사업자등록 절차",
        category="license",
        match_count=5,
    )
    context = "\n\n".join(d["content"] for d in docs)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"마포구 카페 창업자의 현재 단계(sub_stage={ctx.sub_stage})에 맞는 "
                    f"세금·인허가 안내와 초안을 작성해주세요.\n\n"
                    f"[관련 법령 정보]\n{context}"
                ),
            }
        ],
    )

    draft = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"
    upcoming = await get_upcoming_deadlines()
    return {"agent": "tax", "draft": draft, "upcoming_deadlines": upcoming}


async def get_upcoming_deadlines(days_ahead: int = 30) -> list[dict]:
    """
    Supabase tax_deadlines 테이블에서 D-days 기준 다가오는 세금 기한 반환.
    DB가 비어 있으면 시드 데이터로 fallback.
    """
    today = date.today()
    until = today + timedelta(days=days_ahead)
    supabase = get_supabase()

    rows = (
        supabase.table("tax_deadlines")
        .select("id, tax_type, title, deadline_date, description, source_url")
        .gte("deadline_date", str(today))
        .lte("deadline_date", str(until))
        .order("deadline_date")
        .execute()
        .data
    )

    # DB 비어 있으면 시드 데이터 fallback
    if not rows:
        from backend.data.seeds.tax_deadlines_seed import get_seed_deadlines
        seed = get_seed_deadlines(today.year)
        rows = [
            r for r in seed
            if today <= date.fromisoformat(r["deadline_date"]) <= until
        ]
        # id 없는 시드 항목에 임시 id 부여
        for i, r in enumerate(rows):
            r.setdefault("id", -(i + 1))

    result = []
    for row in rows:
        d_day = (date.fromisoformat(row["deadline_date"]) - today).days
        result.append({**row, "d_day": d_day})
    return result


async def generate_tax_draft(user_id: str, deadline: dict) -> str:
    """
    세금 신고서 초안 생성 (Claude API) + Supabase Storage 저장.
    반환: storage_path
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    docs = await retrieve(
        query=f"{deadline['title']} 신고 방법 절차 준비사항",
        category="tax",
        match_count=3,
    )
    context = "\n\n".join(d["content"] for d in docs)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_DRAFT_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"세금 신고 정보:\n"
                    f"- 종류: {deadline['title']}\n"
                    f"- 기한: {deadline['deadline_date']}\n"
                    f"- 설명: {deadline.get('description', '')}\n\n"
                    f"[관련 법령 정보]\n{context}\n\n"
                    "위 세금 신고를 위한 체크리스트와 준비사항 초안을 작성해주세요."
                ),
            }
        ],
    )

    draft_content = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"
    storage_path = (
        f"tax-drafts/{user_id}/"
        f"{deadline['tax_type']}_{deadline['deadline_date']}.md"
    )

    supabase = get_supabase()

    # Supabase Storage 업로드
    supabase.storage.from_("drafts").upload(
        path=storage_path,
        file=draft_content.encode("utf-8"),
        file_options={"content-type": "text/markdown; charset=utf-8", "upsert": "true"},
    )

    # drafts 테이블 레코드 삽입
    insert_result = supabase.table("drafts").insert({
        "user_id": user_id,
        "type": DraftType.TAX_RETURN,
        "storage_path": storage_path,
        "tax_deadline_id": deadline.get("id") if (deadline.get("id") or 0) > 0 else None,
        "metadata": {
            "tax_type": deadline["tax_type"],
            "title": deadline["title"],
            "deadline_date": deadline["deadline_date"],
        },
    }).execute()

    draft_id: int = insert_result.data[0]["id"]
    return storage_path, draft_id
