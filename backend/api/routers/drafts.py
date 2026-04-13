from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.draft import DraftResponse, GenerateDraftRequest, GenerateDraftResponse

router = APIRouter()


@router.get("/", response_model=list[DraftResponse])
async def list_drafts(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("drafts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    result = (
        supabase.table("drafts")
        .select("*")
        .eq("id", draft_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return result.data


@router.post("/generate", response_model=GenerateDraftResponse, summary="서류 초안 생성")
async def generate_draft(req: GenerateDraftRequest):
    """
    Gemini 2.0 Flash + RAG를 사용하여 행정서류 초안을 생성합니다.

    지원 doc_type:
    - business-registration  : 사업자등록 신청서
    - food-business-license  : 식품영업 신고서 (휴게음식점)
    - employment-contract    : 표준 근로계약서
    - lease-contract         : 상가건물 임대차계약서
    """
    from backend.agents.gemini import generate_draft as _generate, DOC_TYPE_CONFIG
    if req.doc_type not in DOC_TYPE_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 서류 유형입니다. 가능한 값: {list(DOC_TYPE_CONFIG.keys())}",
        )
    try:
        result = await _generate(req.doc_type, req.user_profile.model_dump())
        return GenerateDraftResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"초안 생성 중 오류: {str(e)}")
