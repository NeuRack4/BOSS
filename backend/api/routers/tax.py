"""세금 기한 조회 + 초안 생성 + 공공데이터 동기화 API"""
import io
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import Client

from backend.agents.tax import generate_tax_draft, get_upcoming_deadlines
from backend.api.dependencies import db, get_current_user_id
from backend.data.crawlers.tax_calendar import upsert_tax_deadlines
from backend.db.client import get_supabase
from backend.tax.hometax_guide import generate_vat_hometax_guide
from backend.tax.pdf_generator import generate_vat_pdf
from backend.tax.vat_calculator import (
    VatInput,
    aggregate_financials_to_vat_input,
    calculate_vat,
)

router = APIRouter()


class DraftRequest(BaseModel):
    user_id: str
    deadline_id: int


class VatDraftRequest(BaseModel):
    period_start: str   # "YYYY-MM-DD"
    period_end: str     # "YYYY-MM-DD"
    prepaid_tax: int = 0


@router.get("/deadlines")
async def list_tax_deadlines(days_ahead: int = Query(default=30, ge=1, le=365)):
    """다가오는 세금 기한 목록 조회"""
    deadlines = await get_upcoming_deadlines(days_ahead=days_ahead)
    return {"deadlines": deadlines, "count": len(deadlines)}


@router.post("/draft")
async def create_tax_draft(body: DraftRequest):
    """
    세금 신고서 초안 생성 (기존 방식 — 체크리스트 마크다운).
    deadline_id로 tax_deadlines 테이블 조회 후 Claude API로 초안 생성 → Supabase Storage 저장.
    """
    row = (
        get_supabase()
        .table("tax_deadlines")
        .select("id, tax_type, title, deadline_date, description, source_url")
        .eq("id", body.deadline_id)
        .maybe_single()
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=404, detail="deadline not found")

    storage_path, draft_id = await generate_tax_draft(
        user_id=body.user_id, deadline=row
    )
    return {
        "storage_path": storage_path,
        "deadline_id": body.deadline_id,
        "draft_id": draft_id,
    }


@router.post("/vat-draft")
async def create_vat_draft(
    body: VatDraftRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """
    부가가치세 신고서 초안 생성.

    1. founder_financials 에서 해당 기간 데이터 집계
    2. 부가세 계산 (간이/일반 자동 분기)
    3. 국세청 서식 PDF 생성 (reportlab + pypdf fallback)
    4. 홈택스 입력 가이드 생성
    5. Supabase Storage에 PDF 저장 + drafts 테이블 기록
    """
    # ── 사업자 정보 조회
    biz_result = (
        supabase.table("founder_business_info")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    business_info: dict = biz_result.data or {}

    # ── 재무 데이터 집계 (해당 기간)
    p_start_year, p_start_month, _ = body.period_start.split("-")
    p_end_year,   p_end_month,   _ = body.period_end.split("-")

    fin_result = (
        supabase.table("founder_financials")
        .select("*")
        .eq("user_id", user_id)
        .gte("year", int(p_start_year))
        .lte("year", int(p_end_year))
        .execute()
    )
    financials = fin_result.data or []

    # 연도 경계가 같을 때 월 필터링
    financials = [
        r for r in financials
        if (r["year"] > int(p_start_year)
            or r["month"] >= int(p_start_month))
        and (r["year"] < int(p_end_year)
             or r["month"] <= int(p_end_month))
    ]

    if not financials:
        raise HTTPException(
            status_code=404,
            detail=f"{body.period_start} ~ {body.period_end} 기간의 재무 데이터가 없습니다. "
                   "먼저 매출 데이터를 입력하거나 mock 데이터를 시드하세요.",
        )

    # ── 부가세 계산
    vat_input: VatInput = aggregate_financials_to_vat_input(
        user_id=user_id,
        financials=financials,
        business_info=business_info,
        period_start=body.period_start,
        period_end=body.period_end,
        prepaid_tax=body.prepaid_tax,
    )
    vat_result = calculate_vat(vat_input)

    # ── PDF 생성
    pdf_bytes = generate_vat_pdf(vat_input, vat_result, business_info)

    # ── 홈택스 가이드 생성
    hometax_guide = generate_vat_hometax_guide(vat_result, business_info)

    # ── Supabase Storage 업로드
    period_label = f"{body.period_start[:7]}_{body.period_end[:7]}"
    storage_path = f"tax-drafts/{user_id}/vat_{period_label}.pdf"

    supabase.storage.from_("drafts").upload(
        path=storage_path,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    # ── drafts 테이블 기록
    tax_type_label = "간이과세자" if vat_result.tax_type == "simplified" else "일반과세자"
    insert_result = (
        supabase.table("drafts")
        .insert({
            "user_id": user_id,
            "type": "tax_return",
            "storage_path": storage_path,
            "metadata": {
                "title": f"부가가치세 신고서 ({tax_type_label}) {period_label}",
                "tax_type": vat_result.tax_type,
                "period_start": body.period_start,
                "period_end": body.period_end,
                "final_tax": vat_result.final_tax,
                "hometax_guide": hometax_guide,
            },
        })
        .execute()
    )
    draft_id: int = insert_result.data[0]["id"]

    # ── 임시 다운로드 URL 생성 (1시간 유효)
    signed = supabase.storage.from_("drafts").create_signed_url(
        path=storage_path, expires_in=3600
    )
    pdf_url: str = signed.get("signedURL", "")

    return {
        "draft_id": draft_id,
        "pdf_url": pdf_url,
        "storage_path": storage_path,
        "calculation": {
            "tax_type": vat_result.tax_type,
            "period": f"{body.period_start} ~ {body.period_end}",
            "total_supply": vat_result.total_supply,
            "gross_tax": vat_result.gross_tax,
            "total_deduction": vat_result.total_deduction,
            "net_tax": vat_result.net_tax,
            "prepaid_tax": vat_result.prepaid_tax,
            "final_tax": vat_result.final_tax,
            "notes": vat_result.notes,
        },
        "hometax_guide": hometax_guide,
    }


@router.get("/vat-draft/{draft_id}/download")
async def download_vat_pdf(
    draft_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """부가가치세 신고서 PDF 직접 다운로드"""
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
    title: str = draft.get("metadata", {}).get("title", "부가가치세_신고서_초안")

    pdf_bytes = supabase.storage.from_("drafts").download(storage_path)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    filename = f"{title}.pdf"
    encoded_filename = quote(filename)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


@router.get("/vat-draft/{draft_id}/hometax-guide")
async def get_hometax_guide(
    draft_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(db),
):
    """저장된 홈택스 입력 가이드 조회"""
    result = (
        supabase.table("drafts")
        .select("metadata")
        .eq("id", draft_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="초안을 찾을 수 없습니다.")

    guide = result.data.get("metadata", {}).get("hometax_guide")
    if not guide:
        raise HTTPException(status_code=404, detail="홈택스 가이드 데이터가 없습니다.")

    return guide


@router.post("/deadlines/sync")
async def sync_tax_deadlines(year: int | None = Query(default=None)):
    """
    공공데이터포털에서 세금 기한 데이터를 가져와 DB에 저장.
    year 미지정 시 현재 연도 기준.
    """
    target_year = year or date.today().year
    count = await upsert_tax_deadlines(target_year)
    return {"synced": count, "year": target_year}
