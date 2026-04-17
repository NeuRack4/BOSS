"""서류 검토 API — 계약서/제안서/기타 문서 분석"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, UploadFile
from supabase import Client

from backend.agents import doc_review_agent
from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.doc_review import (
    DocReviewCreate,
    DocReviewListItem,
    DocReviewResponse,
)
from backend.db.client import get_supabase
from backend.parsers.doc_parser import parse_file

router = APIRouter()

_TABLE = "doc_reviews"

DISCLAIMER = (
    "\n\n---\n"
    "본 내용은 참고용이며 실제 계약 체결 전 법률 전문가 확인을 권장합니다."
)


_STORAGE_BUCKET = "doc-reviews"


def _upload_file(user_id: str, review_id: str, file_bytes: bytes, filename: str) -> str | None:
    """원본 파일을 Supabase Storage에 업로드하고 경로를 반환. 실패 시 None."""
    try:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        path = f"{user_id}/{review_id}.{ext}"
        supabase = get_supabase()
        supabase.storage.from_(_STORAGE_BUCKET).upload(
            path,
            file_bytes,
            {"content-type": "application/octet-stream", "upsert": "true"},
        )
        return path
    except Exception:
        return None


def _save_review(
    user_id: str,
    title: str,
    doc_type: str,
    user_role: str,
    content: str,
    review_result: dict,
    file_path: str | None = None,
    review_id: str | None = None,
) -> dict:
    supabase = get_supabase()
    row = {
        "id": review_id or str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "doc_type": doc_type,
        "user_role": user_role,
        "content": content,
        "review_result": review_result,
        "file_path": file_path,
    }
    result = supabase.table(_TABLE).insert(row).execute()
    return result.data[0]


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=DocReviewResponse, status_code=201)
async def analyze_text(
    body: DocReviewCreate,
    user_id: str = Depends(get_current_user_id),
):
    """텍스트 붙여넣기 방식 서류 분석"""
    if not body.content.strip():
        raise HTTPException(status_code=422, detail="문서 내용이 비어있습니다.")

    try:
        result = await doc_review_agent.analyze(body.content, body.user_role, body.doc_type)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    result_dict = result.model_dump()
    row = _save_review(
        user_id=user_id,
        title=body.title,
        doc_type=body.doc_type,
        user_role=body.user_role,
        content=body.content,
        review_result=result_dict,
    )

    return DocReviewResponse(
        id=row["id"],
        title=row["title"],
        doc_type=row["doc_type"],
        user_role=row["user_role"],
        review_result=result,
        created_at=row["created_at"],
    )


@router.post("/analyze/file", response_model=DocReviewResponse, status_code=201)
async def analyze_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form("기타"),
    user_role: str = Form("미지정"),
    user_id: str = Depends(get_current_user_id),
):
    """파일 업로드 방식 서류 분석 (PDF / DOCX / 이미지)"""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=422, detail="업로드된 파일이 비어있습니다.")

    filename = file.filename or ""
    content = parse_file(file_bytes, filename)

    try:
        result = await doc_review_agent.analyze(content, user_role, doc_type)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    result_dict = result.model_dump()
    review_id = str(uuid.uuid4())
    file_path = _upload_file(user_id, review_id, file_bytes, filename)

    row = _save_review(
        user_id=user_id,
        title=title,
        doc_type=doc_type,
        user_role=user_role,
        content=content,
        review_result=result_dict,
        file_path=file_path,
        review_id=review_id,
    )

    return DocReviewResponse(
        id=row["id"],
        title=row["title"],
        doc_type=row["doc_type"],
        user_role=row["user_role"],
        file_path=row.get("file_path"),
        review_result=result,
        created_at=row["created_at"],
    )


@router.get("/history", response_model=list[DocReviewListItem])
async def list_reviews(
    user_id: str = Depends(get_current_user_id),
):
    """서류 검토 이력 목록 조회 (최신순)"""
    supabase = get_supabase()
    rows = (
        supabase.table(_TABLE)
        .select("id, title, doc_type, user_role, review_result, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "doc_type": r["doc_type"],
            "user_role": r.get("user_role", "미지정"),
            "gap_ratio": (r.get("review_result") or {}).get("gap_ratio"),
            "eul_ratio": (r.get("review_result") or {}).get("eul_ratio"),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.get("/{review_id}", response_model=DocReviewResponse)
async def get_review(
    review_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """서류 검토 상세 조회"""
    supabase = get_supabase()
    row = (
        supabase.table(_TABLE)
        .select("*")
        .eq("id", review_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="검토 결과를 찾을 수 없습니다.")

    return DocReviewResponse(
        id=row["id"],
        title=row["title"],
        doc_type=row["doc_type"],
        user_role=row.get("user_role", "미지정"),
        file_path=row.get("file_path"),
        review_result=row.get("review_result"),
        created_at=row["created_at"],
    )


@router.delete("/{review_id}", status_code=204)
async def delete_review(
    review_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """서류 검토 결과 삭제"""
    supabase = get_supabase()
    existing = (
        supabase.table(_TABLE)
        .select("id")
        .eq("id", review_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(status_code=404, detail="검토 결과를 찾을 수 없습니다.")

    supabase.table(_TABLE).delete().eq("id", review_id).execute()
