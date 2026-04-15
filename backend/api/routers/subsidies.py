import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.data.sync.subsidy_sync import sync_daily_if_needed
from backend.rag.embeddings.bge_embeddings import embed_single
from backend.data.crawlers.bizinfo import fetch_attachments, download_attachment
from backend.rag.hwp_parser import extract_hwp_text
from backend.agents.subsidy_draft import build_draft_cards, apply_profile_prefill

router = APIRouter()

_BASE_COLS = (
    "id, external_id, title, organization, region, program_kind, sub_kind, "
    "target, start_date, end_date, period_raw, is_ongoing, description, "
    "detail_url, external_url, hashtags"
)


@router.get("/matches")
async def get_matches(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("subsidy_matches")
        .select("*")
        .eq("user_id", user_id)
        .order("score", desc=True)
        .execute()
    )
    return result.data


@router.post("/matches/{match_id}/apply")
async def mark_applied(
    match_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("subsidy_matches")
        .update({"status": "applied"})
        .eq("id", match_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0]


# ------------------------------------------------------------
# 지원사업 캘린더 — Feature 3
# ------------------------------------------------------------

@router.get("/calendar")
async def get_calendar(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    region: Optional[str] = Query(None),
    supabase: Client = Depends(db),
):
    """
    기간 내 공고 목록 (is_ongoing=false 만).
    start_date ≤ to AND end_date ≥ from 으로 겹치는 행 반환.
    """
    query = (
        supabase.table("subsidy_programs")
        .select(_BASE_COLS)
        .eq("is_ongoing", False)
        .lte("start_date", to_date.isoformat())
        .gte("end_date", from_date.isoformat())
        .order("start_date", desc=False)
        .limit(500)
    )
    if region:
        query = query.eq("region", region)

    result = query.execute()
    return result.data or []


@router.get("/ongoing")
async def get_ongoing(
    region: Optional[str] = Query(None),
    supabase: Client = Depends(db),
):
    """상시 모집 공고 리스트 (기간 파싱 불가 — '예산 소진시까지' 등)."""
    query = (
        supabase.table("subsidy_programs")
        .select(_BASE_COLS)
        .eq("is_ongoing", True)
        .order("fetched_at", desc=True)
        .limit(200)
    )
    if region:
        query = query.eq("region", region)

    result = query.execute()
    return result.data or []


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    match_count: int = Field(10, ge=1, le=30)


@router.post("/search")
async def search_subsidies(
    request: SearchRequest,
    supabase: Client = Depends(db),
):
    """하이브리드 검색 (벡터 + FTS + trigram → RRF) on subsidy_programs."""
    embedding = await embed_single(request.query)
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

    result = supabase.rpc(
        "search_subsidies",
        {
            "query_text": request.query,
            "query_embedding": embedding_str,
            "match_count": request.match_count,
        },
    ).execute()

    return result.data or []


@router.post("/sync-today")
async def sync_today():
    """
    페이지 진입 시 호출. 오늘 자 동기화 로그가 없으면 스냅샷 수집.
    동시 호출은 subsidy_fetch_log.fetch_date PK 로 보호.
    """
    executed, count = await sync_daily_if_needed()
    return {"executed": executed, "count": count}


# ------------------------------------------------------------
# 신청서 초안 — Feature 4
# ------------------------------------------------------------

@router.post("/{program_id}/draft")
async def generate_draft(
    program_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """
    지원사업 신청서 초안 카드 목록 생성.

    플로우:
    1. 공고 조회
    2. 기업마당 상세 페이지 → HWP 첨부파일 URL 수집
    3. HWP 다운로드 → Supabase Storage 저장 → 텍스트 추출
    4. Claude: 카드 구조화 + 창업자 프로파일 pre-fill
    5. 카드 JSON 반환

    첨부파일 없으면 has_attachment=false, cards=[] 반환 → 프론트에서 직접 입력.
    """
    # 1. 공고 조회
    prog_res = (
        supabase.table("subsidy_programs")
        .select("id, external_id, title, organization, target, description, detail_url")
        .eq("id", program_id)
        .single()
        .execute()
    )
    if not prog_res.data:
        raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
    program = prog_res.data

    # 2. 캐시 확인 (cards_json 우선, 없으면 raw_text)
    cached = (
        supabase.table("subsidy_attachments")
        .select("raw_text, filename, file_type, parse_status, cards_json")
        .eq("program_id", program_id)
        .eq("parse_status", "ok")
        .limit(1)
        .execute()
    )

    cached_cards: list | None = None
    hwp_text = ""
    attachment_info = None

    if cached.data:
        row = cached.data[0]
        cached_cards = row.get("cards_json")  # 이미 파싱된 카드 구조
        hwp_text = row.get("raw_text") or ""
        attachment_info = {
            "filename": row["filename"],
            "file_type": row["file_type"],
            "cached": True,
        }
    else:
        hwp_text, attachment_info = await _fetch_and_parse_attachment(
            program, supabase
        )

    # 3. 창업자 프로파일 조회 (users 테이블)
    profile_res = (
        supabase.table("users")
        .select("id, email, name, phone, business_type, region, stage, profile")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    founder_profile = profile_res.data[0] if profile_res.data else None

    # founder_state 에서 세부 단계 보강
    state_res = (
        supabase.table("founder_state")
        .select("stage, sub_stage")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if state_res.data:
        if founder_profile:
            founder_profile["stage"] = state_res.data[0].get("stage")
            founder_profile["sub_stage"] = state_res.data[0].get("sub_stage")
        else:
            founder_profile = state_res.data[0]

    # 4. 카드 생성 (cards_json 캐시 있으면 Claude 스킵)
    result = await build_draft_cards(
        program=program,
        hwp_text=hwp_text,
        founder_profile=founder_profile,
        cached_cards=cached_cards,
    )

    # 4a. cards_json 캐싱 (최초 1회만)
    if not cached_cards and result.get("cards"):
        _save_cards_json(supabase, program_id, result["cards"])

    # 4b. 캐시된 카드라면 현재 프로파일로 value 갱신 (stale pre-fill 방지)
    if cached_cards and result.get("cards"):
        result["cards"] = apply_profile_prefill(result["cards"], founder_profile)

    # 4c. 저장된 사용자 답변 로드 → 프로파일 pre-fill보다 우선 적용
    if result.get("cards"):
        saved_res = (
            supabase.table("subsidy_draft_answers")
            .select("cards_json")
            .eq("user_id", user_id)
            .eq("program_id", program_id)
            .limit(1)
            .execute()
        )
        if saved_res.data and saved_res.data[0].get("cards_json"):
            saved_map = {
                c["id"]: c["value"]
                for c in saved_res.data[0]["cards_json"]
                if isinstance(c, dict) and "id" in c
            }
            result["cards"] = [
                {**c, "value": saved_map.get(c["id"], c.get("value", ""))}
                for c in result["cards"]
            ]
    result["program"] = {
        "id": program["id"],
        "title": program["title"],
        "organization": program["organization"],
    }
    result["attachment"] = attachment_info

    return result


class SaveAnswersRequest(BaseModel):
    cards: list


@router.put("/{program_id}/draft/answers")
async def save_draft_answers(
    program_id: int,
    request: SaveAnswersRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """사용자가 입력한 카드 답변을 저장한다 (upsert)."""
    supabase.table("subsidy_draft_answers").upsert(
        {
            "user_id": user_id,
            "program_id": program_id,
            "cards_json": request.cards,
        },
        on_conflict="user_id,program_id",
    ).execute()
    return {"ok": True}


def _save_cards_json(supabase: Client, program_id: int, cards: list):
    """파싱된 카드 구조를 subsidy_attachments.cards_json 에 저장."""
    try:
        supabase.table("subsidy_attachments").update(
            {"cards_json": cards}
        ).eq("program_id", program_id).eq("parse_status", "ok").execute()
        logger.info(f"[attachment] cards_json saved program_id={program_id} ({len(cards)} cards)")
    except Exception as e:
        logger.error(f"[attachment] cards_json save failed program_id={program_id}: {e}")


async def _fetch_and_parse_attachment(program: dict, supabase: Client):
    """상세 페이지 스크래핑 → HWP 다운로드 → 텍스트 추출 → DB 저장."""
    detail_url = program.get("detail_url")
    if not detail_url:
        return "", None

    attachments = await fetch_attachments(detail_url)
    hwp_items = [a for a in attachments if a["file_type"] == "hwp"]

    if not hwp_items:
        return "", None

    # 첫 번째 HWP만 처리
    item = hwp_items[0]
    raw_bytes = await download_attachment(item["download_url"])

    if not raw_bytes:
        _save_attachment_record(supabase, program["id"], item, None, "failed")
        return "", item

    # Supabase Storage 업로드
    ext_id = program["external_id"]
    storage_path = f"{ext_id}/{item['filename']}"
    try:
        supabase.storage.from_("subsidy-attachments").upload(
            storage_path,
            raw_bytes,
            {"content-type": "application/octet-stream", "upsert": "true"},
        )
    except Exception:
        pass  # 스토리지 실패해도 텍스트 추출은 진행

    # HWP 텍스트 추출 (null 바이트 제거 — PostgreSQL text 컬럼 저장 요건)
    hwp_text = extract_hwp_text(raw_bytes) if item["file_type"] == "hwp" else ""
    hwp_text = hwp_text.replace("\x00", "") if hwp_text else ""
    parse_status = "ok" if hwp_text else "failed"

    _save_attachment_record(supabase, program["id"], item, hwp_text, parse_status, storage_path)
    return hwp_text, item


def _save_attachment_record(
    supabase: Client,
    program_id: int,
    item: dict,
    raw_text: Optional[str],
    parse_status: str,
    storage_path: str = None,
    cards_json: list = None,
):
    payload = {
        "program_id": program_id,
        "filename": item["filename"],
        "file_type": item["file_type"],
        "download_url": item["download_url"],
        "storage_path": storage_path,
        "raw_text": raw_text,
        "parse_status": parse_status,
    }
    if cards_json is not None:
        payload["cards_json"] = cards_json
    try:
        supabase.table("subsidy_attachments").upsert(
            payload,
            on_conflict="program_id,filename",
        ).execute()
        logger.info(f"[attachment] saved program_id={program_id} parse_status={parse_status} cards={len(cards_json) if cards_json else 0}")
    except Exception as e:
        logger.error(f"[attachment] upsert failed program_id={program_id}: {e}")
