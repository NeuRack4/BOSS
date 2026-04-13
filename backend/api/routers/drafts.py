import io
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer
from supabase import Client

from backend.api.dependencies import db, get_current_user_id
from backend.api.schemas.draft import DraftResponse, GenerateDraftRequest, GenerateDraftResponse

router = APIRouter()

# 한글 CID 폰트 등록 (reportlab 내장 — 외부 폰트 파일 불필요)
_FONT = "HYGothic-Medium"
pdfmetrics.registerFont(UnicodeCIDFont(_FONT))

_S = {
    "h1": ParagraphStyle("h1", fontName=_FONT, fontSize=18, textColor=HexColor("#1a1a2e"), leading=26, spaceAfter=8, spaceBefore=4),
    "h2": ParagraphStyle("h2", fontName=_FONT, fontSize=14, textColor=HexColor("#1a1a2e"), leading=22, spaceAfter=6, spaceBefore=12),
    "h3": ParagraphStyle("h3", fontName=_FONT, fontSize=12, textColor=HexColor("#333333"), leading=20, spaceAfter=4, spaceBefore=8),
    "body": ParagraphStyle("body", fontName=_FONT, fontSize=11, leading=19, spaceAfter=3),
    "li": ParagraphStyle("li", fontName=_FONT, fontSize=11, leading=19, leftIndent=14, spaceAfter=2),
}


def _esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text: str) -> str:
    """**bold** → <b>bold</b>"""
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", _esc(text))


def _markdown_to_pdf(md_content: str, title: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=25 * mm,
        rightMargin=25 * mm,
        topMargin=25 * mm,
        bottomMargin=25 * mm,
        title=title,
    )

    story = []
    for line in md_content.splitlines():
        if line.startswith("### "):
            story.append(Paragraph(_inline(line[4:].strip()), _S["h3"]))
        elif line.startswith("## "):
            story.append(Paragraph(_inline(line[3:].strip()), _S["h2"]))
        elif line.startswith("# "):
            story.append(Paragraph(_inline(line[2:].strip()), _S["h1"]))
        elif line.startswith("---"):
            story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#dee2e6"), spaceBefore=4, spaceAfter=4))
        elif re.match(r"^[-*] ", line):
            story.append(Paragraph(f"• {_inline(line[2:].strip())}", _S["li"]))
        elif re.match(r"^\d+\. ", line):
            text = re.sub(r"^\d+\. ", "", line).strip()
            story.append(Paragraph(f"• {_inline(text)}", _S["li"]))
        elif line.strip() == "":
            story.append(Spacer(1, 3 * mm))
        else:
            story.append(Paragraph(_inline(line.strip()), _S["body"]))

    doc.build(story)
    return buf.getvalue()


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


@router.get("/{draft_id}/download")
async def download_draft_pdf(
    draft_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """초안 마크다운을 PDF로 변환하여 다운로드"""
    result = (
        supabase.table("drafts")
        .select("*")
        .eq("id", draft_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="초안을 찾을 수 없습니다.")

    draft = result.data
    storage_path: str = draft["storage_path"]
    title: str = draft.get("metadata", {}).get("title", "세금 신고 초안")

    file_bytes = supabase.storage.from_("drafts").download(storage_path)
    if not file_bytes:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    md_content = file_bytes.decode("utf-8")
    pdf_bytes = _markdown_to_pdf(md_content, title)

    filename = f"{title}_초안_{draft_id}.pdf"
    encoded_filename = quote(filename)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


@router.post("/generate", response_model=GenerateDraftResponse, summary="서류 초안 생성")
async def generate_draft(req: GenerateDraftRequest):
    """
    Groq (Llama 3.3 70B) + RAG를 사용하여 행정서류 초안을 생성합니다.

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
