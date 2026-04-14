"""
PDF 서식 좌표 기반 텍스트 삽입 엔드포인트
PyMuPDF(fitz)로 정부 공식 서식 PDF에 사용자 데이터를 정확한 좌표로 삽입

세금관리(pdf_generator.py)와 동일한 기법 적용:
  - ins_num: 우측정렬, helv 폰트, fitz.get_text_length()로 x 역산
  - ins_str: 좌측정렬, CJK 폰트 (한글)
  - baseline_y = probe_y(행 상단 y0) + B(4.3pt 고정 오프셋)
"""
from __future__ import annotations

import io
from datetime import date as _date
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/drafts", tags=["pdf-forms"])

_FORMS_DIR = Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "forms"

# 한글 폰트 (Windows)
_MALGUN = "C:/Windows/Fonts/malgun.ttf"
_GULIM  = "C:/Windows/Fonts/gulim.ttc"
_CJK_FONT: str | None = None
for _f in (_MALGUN, _GULIM):
    if Path(_f).exists():
        _CJK_FONT = _f
        break

# probe_y → baseline_y 오프셋 (7.5~8pt 폰트 기준, 세금관리와 동일)
_B = 4.3


# ──────────────────────────────────────────────────────────────────────
# 좌표 정의 타입
# ──────────────────────────────────────────────────────────────────────

class FieldCoord:
    """PDF 텍스트 삽입 좌표 정의"""
    def __init__(
        self,
        key: str,
        x: float,           # 좌정렬: 텍스트 왼쪽 시작 x / 우정렬: 셀 오른쪽 경계 x1
        probe_y: float,     # 행의 상단 y0 (fitz 추출값) — baseline_y = probe_y + 4.3
        page: int = 1,
        font_size: float = 8.0,
        right_align: bool = False,  # True = 우측정렬 (금액 등 숫자), x는 x1로 해석
        use_cjk: bool = True,       # False = helv(ASCII), True = 한글 CJK 폰트
    ) -> None:
        self.key = key
        self.x = x
        self.probe_y = probe_y
        self.page = page
        self.font_size = font_size
        self.right_align = right_align
        self.use_cjk = use_cjk

    @property
    def baseline_y(self) -> float:
        return self.probe_y + _B


# 단축 생성자
def F(key, x, py, page=1, fs=8.0, r=False, cjk=True) -> FieldCoord:
    """F(key, x, probe_y, page, font_size, right_align, use_cjk)"""
    return FieldCoord(key, x, py, page, fs, r, cjk)


# ──────────────────────────────────────────────────────────────────────
# 사업자등록 신청서 (biz-reg.pdf, 6페이지, A4 595×841pt)
#
# probe_y = fitz.get_text("words")로 추출한 해당 행의 y0
# baseline_y = probe_y + 4.3
#
# 우측정렬(r=True): x = 셀의 오른쪽 경계(x1), helv 폰트, fitz.get_text_length로 역산
# 좌측정렬(r=False): x = 텍스트 시작 위치
# ──────────────────────────────────────────────────────────────────────
BIZ_REG: list[FieldCoord] = [
    # ① 인적사항 ─ 각 행의 probe_y = 해당 라벨 y0
    # 라벨 "상호(단체명)" y0=193, 입력은 라벨 끝(x=120) 직후
    F("상호_단체명",              122, 193,       cjk=True),
    # "(사업장 전화번호)" 라벨 y0=193, 라벨 끝 x=381 직후
    F("사업장_전화번호",           382, 193,       cjk=False),

    # "성명(대표자)" y0=212
    F("성명_대표자",               122, 212,       cjk=True),
    F("주소지_전화번호",           382, 212,       cjk=False),

    # "주민등록번호" y0=230
    F("주민등록번호",              122, 230,       cjk=False),
    F("휴대전화번호",              382, 230,       cjk=False),

    # "(단체)부동산등기용등록번호" y0=249
    F("부동산등기용등록번호",       191, 249,       cjk=False),
    F("팩스번호",                  382, 249,       cjk=False),

    # "사업장(단체) 소재지" y0=268 — 주소 본문 (층/호 제외)
    # 층 라벨 x0=448, 호 라벨 x0=489 → 각각 우정렬로 숫자 삽입
    F("사업장_소재지",             157, 268,       cjk=True),
    F("사업장_층",                 447, 269, r=True, cjk=False),  # 층(x=448) 앞 우정렬
    F("사업장_호",                 488, 269, r=True, cjk=False),  # 호(x=489) 앞 우정렬

    # ② 사업장 현황 ─ 업종
    # 주업태/주종목: label이 셀 좌측, data는 label 끝(x1) 오른쪽, 같은 y (probe_y=label y0)
    # 주업태 label x=136~163.9, y0=338.7 → data x=165, probe_y=338
    F("주업태",                    165, 338,       cjk=True),
    # 주종목 label x=203.8~231.7, y0=338.7 → data x=233, probe_y=338
    F("주종목",                    233, 338,       cjk=True),
    # 주업종코드: 셀 내 수평분리선(y=348.6) 아래 data 행 → probe_y=355 유지
    F("주업종코드",                383, 355,       cjk=False),
    # 개업일/종업원수: 병합셀(y=333~397), label y=332~348 → 아래 빈칸 probe_y=365
    F("개업일",                    437, 365,       cjk=False),
    F("종업원수",                  477, 365,       cjk=False),

    # 부업태/부종목: 부 행 label y0=374.6 → data x=label끝 오른쪽, probe_y=374
    F("부업태",                    165, 374,       cjk=True),
    F("부종목",                    233, 374,       cjk=True),
    # 부업종코드: 셀 내 수평분리선(y=384.3) 아래 → probe_y=391 유지
    F("부업종코드",                383, 391,       cjk=False),

    # 사이버몰 ─ 헤더와 같은 행, "사이버몰 도메인" 라벨 끝 x=311
    F("사이버몰_도메인명",         313, 402,       cjk=True),

    # ③ 사업장 구분 + 임대차 명세
    # 자가면적: ㎡(x=158) 앞 → 우정렬 x1=157, probe_y=481
    F("자가면적_㎡",              157, 481, r=True,  cjk=False),
    # 타가면적: ㎡(x=185) 앞 → 우정렬 x1=184
    F("타가면적_㎡",              184, 481, r=True,  cjk=False),
    # 임대인 정보 (좌정렬)
    F("임대인_성명",               200, 481,        cjk=True),
    F("임대인_사업자등록번호",     242, 481,        cjk=False),
    F("임대인_주민법인등록번호",   297, 481,        cjk=False),
    # 임대차계약기간: 두 줄 (시작 y=476, 종료 y=487) — 예: 시작="2025.04", 종료="2027.04"
    F("임대차계약기간_시작",       350, 476,        cjk=False),  # ". . ." 점선 위 첫 줄
    F("임대차계약기간_종료",       362, 487,        cjk=False),  # "~" 이후 둘째 줄
    # 금액: 원(x=444) 앞 → 우정렬 x1=443
    F("전세보증금",               443, 481, r=True,  cjk=False),
    # 월세: 원(x=525) 앞 → 우정렬 x1=524
    F("월세_차임",                524, 481, r=True,  cjk=False),

    # ④ 사업자금
    # "자기자금" 라벨 y0=611, 원(x=284) 앞 → 우정렬 x1=283
    F("사업자금_자기자금",        283, 611, r=True,  cjk=False),
    # "타인자금" 라벨 y0=611, 원(x=524) 앞 → 우정렬 x1=523
    F("사업자금_타인자금",        523, 611, r=True,  cjk=False),

    # ⑤ 전자우편 — 입력 셀 x=134.6~257.1, 시작 x≈137
    F("전자우편주소",              137, 668,        cjk=False),

    # ⑥ 서명란 (2페이지 — 뒤쪽)
    # "년 월 일" 행 probe_y=520 — 오늘 날짜 자동 입력
    F("신청_년",                   434, 520, page=2, r=True, cjk=False),  # 년(x=435) 앞
    F("신청_월",                   479, 520, page=2, r=True, cjk=False),  # 월(x=480) 앞
    F("신청_일",                   524, 520, page=2, r=True, cjk=False),  # 일(x=525) 앞
    # 신청인/대리인 probe_y=532/545
    F("신청인_성명",               376, 532, page=2,         cjk=True),
    F("대리인_성명",               376, 545, page=2,         cjk=True),
]


# ──────────────────────────────────────────────────────────────────────
# 식품영업 신고서 (food-biz.pdf, 2페이지, A4 595×841pt)
# ──────────────────────────────────────────────────────────────────────
FOOD_BIZ: list[FieldCoord] = [
    F("신고인_성명",               116, 144,       cjk=True),
    F("신고인_주민등록번호",        365, 144,       cjk=False),
    F("신고인_주소",               116, 162,       cjk=True),
    F("신고인_전화번호",            365, 162,       cjk=False),
    F("명칭_상호",                 116, 186,       cjk=True),
    F("영업장_전화번호",            365, 186,       cjk=False),
    F("영업장_내부면적_㎡",        260, 289,       cjk=False),
    F("영업장_외부면적_㎡",        363, 289,       cjk=False),
    F("영업장_소재지",             116, 304,       cjk=True),
    F("신고일",                     61, 531,       cjk=False),
]


# ──────────────────────────────────────────────────────────────────────
# 표준 근로계약서 (employment.pdf, 3페이지, A4 595×841pt)
# ──────────────────────────────────────────────────────────────────────
EMP_CONTRACT: list[FieldCoord] = [
    F("채용기관장_사업장명",         48, 154, page=1, fs=9, cjk=True),
    F("근로자_성명",                 93, 286, page=1,       cjk=True),
    F("근로자_성별",                225, 286, page=1,       cjk=False),
    F("근로자_생년월일",            340, 286, page=1,       cjk=False),
    F("근무형태",                   448, 286, page=1,       cjk=False),
    F("근로자_연락처",              100, 324, page=1,       cjk=False),
    F("근로자_주소",                250, 324, page=1,       cjk=True),
    F("계약기간_시작",              145, 399, page=1,       cjk=False),
    F("계약기간_종료",              355, 399, page=1,       cjk=False),
    F("근무장소",                   214, 619, page=1,       cjk=True),
    F("직종_업무내용",              182, 637, page=1,       cjk=True),
    F("근무요일_시작",             320, 692, page=1,       cjk=False),
    F("근무요일_종료",             365, 692, page=1,       cjk=False),
    F("근무시작시간",              408, 692, page=1,       cjk=False),
    F("근무종료시간",              458, 692, page=1,       cjk=False),
    F("휴게시작시간",              231, 714, page=1,       cjk=False),
    F("휴게종료시간",              282, 714, page=1,       cjk=False),
    F("기본급",                    145, 611, page=2,       r=True,  cjk=False),
    F("급식비",                    290, 611, page=2,       r=True,  cjk=False),
    F("임금지급일",                280, 712, page=2,       cjk=False),
    F("은행명",                    207, 753, page=2,       cjk=False),
    F("계좌번호",                  265, 753, page=2,       cjk=False),
    F("계약일",                    245, 323, page=3, fs=9, cjk=False),
]


# ──────────────────────────────────────────────────────────────────────
# 상가건물 임대차 표준계약서 (lease.pdf, 4페이지, A4 595×841pt)
# ──────────────────────────────────────────────────────────────────────
LEASE_CONTRACT: list[FieldCoord] = [
    F("소재지",                    111, 167, page=1,       cjk=True),
    F("토지_지목",                  75, 192, page=1,       cjk=False),
    F("토지_면적_㎡",              185, 192, page=1,       cjk=False),
    F("건물_구조용도",             255, 192, page=1,       cjk=True),
    F("건물_면적_㎡",              435, 192, page=1,       cjk=False),
    F("임차할부분_면적_㎡",        435, 211, page=1,       cjk=False),
    F("보증금",                    110, 309, page=1,       cjk=False),
    F("계약금",                    110, 326, page=1,       cjk=False),
    F("잔금",                      110, 359, page=1,       cjk=False),
    F("잔금_지급일",               347, 359, page=1,       cjk=False),
    F("차임_월세",                 110, 376, page=1,       cjk=False),
    F("차임_지급일",               347, 376, page=1,       cjk=False),
    F("입금계좌",                  145, 391, page=1,       cjk=True),
    F("임대차기간_인도일",         270, 660, page=1,       cjk=False),
    F("임대차기간_종료",           400, 668, page=1,       cjk=False),
    F("임차목적_업종",             320, 688, page=1,       cjk=True),
    F("임대인_성명",               390, 151, page=3,       cjk=True),
    F("임차인_성명",               390, 271, page=3,       cjk=True),
    F("계약체결일",                245,  96, page=3, fs=9, cjk=False),
]


# ──────────────────────────────────────────────────────────────────────
# 서류 타입 → PDF 파일 + 좌표 매핑
# ──────────────────────────────────────────────────────────────────────
DOC_CONFIG: dict[str, dict[str, Any]] = {
    "business-registration":  {"pdf": "biz-reg.pdf",    "coords": BIZ_REG,        "max_pages": 2},
    "food-business-license":  {"pdf": "food-biz.pdf",   "coords": FOOD_BIZ},
    "employment-contract":    {"pdf": "employment.pdf",  "coords": EMP_CONTRACT},
    "lease-contract":         {"pdf": "lease.pdf",       "coords": LEASE_CONTRACT},
}


# ──────────────────────────────────────────────────────────────────────
# 요청 스키마
# ──────────────────────────────────────────────────────────────────────
class FillPdfRequest(BaseModel):
    fields: dict[str, str]


# ──────────────────────────────────────────────────────────────────────
# 핵심 PDF 채우기 함수 (세금관리 기법 적용)
# ──────────────────────────────────────────────────────────────────────

def _fill_pdf(pdf_path: Path, coords: list[FieldCoord], fields: dict[str, str], max_pages: int | None = None) -> bytes:
    """
    PyMuPDF로 PDF에 텍스트 삽입 후 bytes 반환.

    ins_num (우측정렬, helv):
        text_width = fitz.get_text_length(text, fontname="helv", fontsize)
        insert_point.x = x1 - text_width

    ins_str (좌측정렬, CJK):
        insert_point.x = x0
    """
    doc = fitz.open(str(pdf_path))
    if max_pages and doc.page_count > max_pages:
        doc.select(list(range(max_pages)))

    for coord in coords:
        value = fields.get(coord.key, "")
        if not value or value == "[직접 입력]":
            continue

        page_idx = coord.page - 1
        if page_idx >= doc.page_count:
            continue

        page = doc[page_idx]
        text = str(value)
        fs = coord.font_size
        by = coord.baseline_y  # probe_y + 4.3

        try:
            if coord.right_align:
                # 우측정렬: helv 폰트로 text_width 계산 후 x1 역산
                tw = fitz.get_text_length(text, fontname="helv", fontsize=fs)
                pt = fitz.Point(coord.x - tw, by)
                page.insert_text(pt, text, fontname="helv", fontsize=fs, color=(0, 0, 0))
            elif not coord.use_cjk or not _CJK_FONT:
                # 좌정렬 ASCII (전화번호, 날짜, 코드 등)
                pt = fitz.Point(coord.x, by)
                page.insert_text(pt, text, fontname="helv", fontsize=fs, color=(0, 0, 0))
            else:
                # 좌정렬 한글 — CJK 폰트 삽입 (fontfile + fontname 둘 다 필요)
                pt = fitz.Point(coord.x, by)
                page.insert_text(pt, text, fontfile=_CJK_FONT, fontname="malgun", fontsize=fs, color=(0, 0, 0))
        except Exception:
            # 폰트 오류 폴백
            try:
                pt = fitz.Point(coord.x, by)
                page.insert_text(pt, text, fontname="helv", fontsize=fs, color=(0, 0, 0))
            except Exception:
                pass

    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True)
    doc.close()
    return buf.getvalue()


# ──────────────────────────────────────────────────────────────────────
# API 엔드포인트
# ──────────────────────────────────────────────────────────────────────

@router.post("/fill-pdf/{doc_type}")
async def fill_pdf(doc_type: str, req: FillPdfRequest):
    """
    서류 타입 + 필드값 → PyMuPDF로 공식 서식 PDF 텍스트 삽입 → PDF bytes 반환

    doc_type: business-registration | food-business-license |
              employment-contract | lease-contract
    """
    config = DOC_CONFIG.get(doc_type)
    if not config:
        raise HTTPException(status_code=404, detail=f"지원하지 않는 서류 유형: {doc_type}")

    pdf_path = _FORMS_DIR / config["pdf"]
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF 서식 파일 없음: {config['pdf']}")

    fields = dict(req.fields)

    # 사업자등록 신청서: 오늘 날짜 + 대리인 자동 주입
    if doc_type == "business-registration":
        today = _date.today()
        fields.setdefault("신청_년", str(today.year))
        fields.setdefault("신청_월", str(today.month).zfill(2))
        fields.setdefault("신청_일", str(today.day).zfill(2))
        fields.setdefault("대리인_성명", "김희영")
        # 신청인_성명 = 성명_대표자 (없으면 빈칸)
        if "신청인_성명" not in fields and "성명_대표자" in fields:
            fields["신청인_성명"] = fields["성명_대표자"]

    try:
        pdf_bytes = _fill_pdf(pdf_path, config["coords"], fields, config.get("max_pages"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 생성 오류: {e}")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{doc_type}.pdf"',
            "Cache-Control": "no-store",
        },
    )
