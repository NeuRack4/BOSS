"""
국세청 부가가치세 신고서 PDF 생성

간이과세자: 부가가치세법 시행규칙 [별지 제44호 서식]
일반과세자: 부가가치세법 시행규칙 [별지 제21호 서식]

backend/tax/forms/ 에 공식 서식 PDF가 있으면
PyMuPDF 좌표 오버레이로 필드를 채우고,
없으면 reportlab으로 직접 생성한다.
"""
import io
from pathlib import Path

from reportlab.lib.colors import black, HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from backend.tax.vat_calculator import VatInput, VatResult

# ── 한글 폰트
_FONT = "HYGothic-Medium"
pdfmetrics.registerFont(UnicodeCIDFont(_FONT))

# ── 색상
_GRAY   = HexColor("#f2f2f2")
_GRAY2  = HexColor("#e8ecf0")
_BLUE_BG = HexColor("#dbeafe")
_DARK   = HexColor("#1a1a2e")
_MID    = HexColor("#555577")
_ACCENT = HexColor("#2563eb")
_LINE   = HexColor("#cccccc")

# ── A4 콘텐츠 폭 (margin 15mm × 2)
_PAGE_W = 180 * mm

_FORMS_DIR = Path(__file__).parent / "forms"

# 한글 폰트 (PyMuPDF 오버레이용)
_MALGUN = "C:/Windows/Fonts/malgun.ttf"      # Windows 기본 한글 폰트
_GULIM  = "C:/Windows/Fonts/gulim.ttc"       # 폴백
_CJK_FONT_FILE: str | None = None
for _f in (_MALGUN, _GULIM):
    if Path(_f).exists():
        _CJK_FONT_FILE = _f
        break


def _s(size: int = 9, align: int = TA_LEFT, color=black) -> ParagraphStyle:
    return ParagraphStyle("_", fontName=_FONT, fontSize=size, alignment=align,
                          textColor=color, leading=size * 1.45)


def _p(text: str, size: int = 9, align: int = TA_LEFT, color=black) -> Paragraph:
    return Paragraph(str(text), _s(size, align, color))


def _won(amount: int) -> str:
    """정수 → 금액 포맷 (0이면 '-')"""
    return f"{amount:,}" if amount != 0 else "-"


# ─────────────────────────────────────────────
# 공통 헤더 / 풋터 빌더
# ─────────────────────────────────────────────

def _header_story(result: VatResult, business_info: dict, form_no: str) -> list:
    story: list = []

    # 서식 번호
    story.append(_p(
        f"■ 부가가치세법 시행규칙 [{form_no}] &lt;개정 2021. 3. 16.&gt;",
        size=7, color=_MID,
    ))
    story.append(Spacer(1, 1.5 * mm))

    # 제목 + 신고 유형
    is_simplified = result.tax_type == "simplified"
    tax_type_str = "간이과세자용" if is_simplified else "일반과세자용"
    is_final = result.period_end.endswith("-12-31") or result.period_end.endswith("-06-30")
    chk_pre  = "[ ]" if is_final else "[✓]"
    chk_fin  = "[✓]" if is_final else "[ ]"

    title_tbl = Table(
        [[
            _p("부 가 가 치 세 신 고 서", size=17, align=TA_CENTER, color=_DARK),
            _p(f"({tax_type_str})\n{chk_pre} 예정신고  {chk_fin} 확정신고",
               size=10, align=TA_CENTER, color=_MID),
        ]],
        colWidths=[_PAGE_W * 0.65, _PAGE_W * 0.35],
    )
    title_tbl.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX",           (0, 0), (-1, -1), 0.5, _LINE),
    ]))
    story.append(title_tbl)
    story.append(Spacer(1, 3 * mm))

    # 사업자 정보
    biz_num   = business_info.get("business_number", "___-__-_____")
    biz_name  = business_info.get("business_name",  "")
    owner     = business_info.get("owner_name",     "")
    address   = business_info.get("address",        "")
    period    = f"{result.period_start} ~ {result.period_end}"

    c1, c2, c3, c4 = 22 * mm, 68 * mm, 25 * mm, _PAGE_W - 22 * mm - 68 * mm - 25 * mm

    info_tbl = Table(
        [
            [_p("신고기간", align=TA_CENTER), _p(period, size=10),
             _p("사업자등록번호", align=TA_CENTER), _p(biz_num, size=11, align=TA_CENTER)],
            [_p("상  호", align=TA_CENTER), _p(biz_name, size=10),
             _p("성   명", align=TA_CENTER), _p(owner, size=10)],
            [_p("사업장주소", align=TA_CENTER), _p(address, size=9), "", ""],
        ],
        colWidths=[c1, c2, c3, c4],
    )
    info_tbl.setStyle(TableStyle([
        ("GRID",       (0, 0), (-1, -1), 0.5, black),
        ("BACKGROUND", (0, 0), (0, -1), _GRAY),
        ("BACKGROUND", (2, 0), (2, 1),  _GRAY),
        ("SPAN",       (1, 2), (3, 2)),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 4 * mm))

    return story


def _footer_story(result: VatResult, business_info: dict) -> list:
    story: list = []
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_LINE))
    story.append(Spacer(1, 2 * mm))
    owner = business_info.get("owner_name", "")
    story.append(_p(
        f"위의 사항을 확인하여 부가가치세법에 의하여 신고합니다. "
        f"  신고인: {owner} (서명 또는 날인)",
        size=8,
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(_p(
        "⚠  본 문서는 AI가 생성한 신고 초안입니다. 실제 신고 전 세무사 확인을 권장합니다.",
        size=7, color=_MID,
    ))
    return story


# ─────────────────────────────────────────────
# 간이과세자 신고서 (별지 제20호의2)
# ─────────────────────────────────────────────

def _simplified_supply_table(result: VatResult) -> Table:
    rate_pct = f"{int(result.vat_rate_applied * 100)}%"
    cw = [55 * mm, 33 * mm, 24 * mm, 18 * mm, _PAGE_W - 55 * mm - 33 * mm - 24 * mm - 18 * mm]

    ti_tax = round(result.sales_tax_invoice * result.vat_rate_applied * 0.1)
    ca_tax = round(result.sales_card        * result.vat_rate_applied * 0.1)
    ot_tax = round(result.sales_other       * result.vat_rate_applied * 0.1)

    rows = [
        # 헤더
        [_p("구 분",         align=TA_CENTER),
         _p("공급대가(원)",   align=TA_CENTER),
         _p("부가가치율",     align=TA_CENTER),
         _p("세 율",         align=TA_CENTER),
         _p("세 액(원)",     align=TA_CENTER)],
        # 세금계산서 발급분
        [_p("세금계산서 발급분"),
         _p(_won(result.sales_tax_invoice), align=TA_RIGHT),
         _p(rate_pct, align=TA_CENTER),
         _p("10%",  align=TA_CENTER),
         _p(_won(ti_tax), align=TA_RIGHT)],
        # 신용카드·현금영수증
        [_p("신용카드·현금영수증 발급분"),
         _p(_won(result.sales_card),        align=TA_RIGHT),
         _p(rate_pct, align=TA_CENTER),
         _p("10%",  align=TA_CENTER),
         _p(_won(ca_tax), align=TA_RIGHT)],
        # 기타
        [_p("기 타(현금 등)"),
         _p(_won(result.sales_other),       align=TA_RIGHT),
         _p(rate_pct, align=TA_CENTER),
         _p("10%",  align=TA_CENTER),
         _p(_won(ot_tax), align=TA_RIGHT)],
        # 합계
        [_p("합   계", align=TA_CENTER),
         _p(_won(result.total_supply),      size=10, align=TA_RIGHT),
         _p(""),
         _p(""),
         _p(_won(result.gross_tax),          size=10, align=TA_RIGHT)],
    ]

    tbl = Table(rows, colWidths=cw)
    tbl.setStyle(TableStyle([
        ("GRID",          (0, 0), (-1, -1), 0.5, black),
        ("BACKGROUND",    (0, 0), (-1, 0), _GRAY),
        ("BACKGROUND",    (0, 4), (-1, 4), _GRAY2),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    return tbl


# ─────────────────────────────────────────────
# 일반과세자 신고서 (별지 제17호)
# ─────────────────────────────────────────────

def _general_supply_table(result: VatResult) -> Table:
    cw = [65 * mm, 50 * mm, 20 * mm, _PAGE_W - 65 * mm - 50 * mm - 20 * mm]

    rows = [
        [_p("구 분",          align=TA_CENTER),
         _p("공급가액(원)",   align=TA_CENTER),
         _p("세율",           align=TA_CENTER),
         _p("세 액(원)",      align=TA_CENTER)],
        [_p("세금계산서 발급분 (과세)"),
         _p(_won(result.sales_tax_invoice), align=TA_RIGHT),
         _p("10%", align=TA_CENTER),
         _p(_won(round(result.sales_tax_invoice * 0.1)), align=TA_RIGHT)],
        [_p("신용카드·현금영수증 발급분"),
         _p(_won(result.sales_card),        align=TA_RIGHT),
         _p("10%", align=TA_CENTER),
         _p(_won(round(result.sales_card * 0.1)), align=TA_RIGHT)],
        [_p("기타(현금 등)"),
         _p(_won(result.sales_other),       align=TA_RIGHT),
         _p("10%", align=TA_CENTER),
         _p(_won(round(result.sales_other * 0.1)), align=TA_RIGHT)],
        [_p("과세표준 합계 / 매출세액", align=TA_CENTER),
         _p(_won(result.total_supply),      size=10, align=TA_RIGHT),
         _p(""),
         _p(_won(result.gross_tax),          size=10, align=TA_RIGHT)],
    ]

    tbl = Table(rows, colWidths=cw)
    tbl.setStyle(TableStyle([
        ("GRID",          (0, 0), (-1, -1), 0.5, black),
        ("BACKGROUND",    (0, 0), (-1, 0), _GRAY),
        ("BACKGROUND",    (0, 4), (-1, 4), _GRAY2),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    return tbl


def _deduction_table(result: VatResult) -> Table:
    cw = [80 * mm, 45 * mm, _PAGE_W - 80 * mm - 45 * mm]

    rows: list = [
        [_p("공제 항목", align=TA_CENTER),
         _p("공제 금액(원)", align=TA_CENTER),
         _p("비 고", align=TA_CENTER)],
    ]

    if result.tax_type == "general" and result.purchase_tax_deduction > 0:
        rows.append([
            _p("매입세액 (세금계산서 수취분)"),
            _p(_won(result.purchase_tax_deduction), align=TA_RIGHT),
            _p("매입 세금계산서 합계 × 10%", size=8, color=_MID),
        ])

    if result.credit_card_deduction > 0:
        rows.append([
            _p("신용카드 등 매출세액 공제"),
            _p(_won(result.credit_card_deduction), align=TA_RIGHT),
            _p("신용카드 공급대가 × 1.3%", size=8, color=_MID),
        ])

    rows.append([
        _p("전자신고 세액공제"),
        _p(_won(result.electronic_filing_deduction), align=TA_RIGHT),
        _p("홈택스 전자신고 시 적용", size=8, color=_MID),
    ])

    rows.append([
        _p("공제세액 합계", align=TA_CENTER),
        _p(_won(result.total_deduction), size=10, align=TA_RIGHT),
        _p(""),
    ])

    tbl = Table(rows, colWidths=cw)
    tbl.setStyle(TableStyle([
        ("GRID",          (0, 0), (-1, -1), 0.5, black),
        ("BACKGROUND",    (0, 0), (-1, 0), _GRAY),
        ("BACKGROUND",    (0, -1), (-1, -1), _GRAY2),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    return tbl


def _final_tax_table(result: VatResult) -> Table:
    cw = [110 * mm, _PAGE_W - 110 * mm]

    refund_str = " (환급)" if result.final_tax < 0 else ""
    rows = [
        [_p("항  목",              align=TA_CENTER),
         _p("세 액(원)",           align=TA_CENTER)],
        [_p("납부세액 (공제 전) ①"),
         _p(_won(result.gross_tax),             align=TA_RIGHT)],
        [_p("(-) 공제세액 합계 ②"),
         _p(f"- {_won(result.total_deduction)}", align=TA_RIGHT)],
        [_p("납부(환급)세액 (① - ②)"),
         _p(_won(result.net_tax),               align=TA_RIGHT)],
        [_p("(-) 예정고지 기납부세액"),
         _p(f"- {_won(result.prepaid_tax)}",    align=TA_RIGHT)],
        [_p(f"▶ 차감 납부(환급)세액{refund_str}", size=11, color=_ACCENT),
         _p(f"▶ {_won(result.final_tax)}원",     size=13, align=TA_RIGHT, color=_ACCENT)],
    ]

    tbl = Table(rows, colWidths=cw)
    tbl.setStyle(TableStyle([
        ("GRID",          (0, 0), (-1, -1), 0.5, black),
        ("BACKGROUND",    (0, 0), (-1, 0), _GRAY),
        ("BACKGROUND",    (0, -1), (-1, -1), _BLUE_BG),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    return tbl


# ─────────────────────────────────────────────
# 메인 생성 함수
# ─────────────────────────────────────────────

def generate_vat_pdf(inp: VatInput, result: VatResult, business_info: dict) -> bytes:
    """
    부가가치세 신고서 PDF bytes 생성.

    국세청 공식 서식 PDF가 backend/tax/forms/ 에 있으면 pypdf로 채우고,
    없으면 reportlab으로 직접 생성한다 (현재 기본 동작).
    """
    # 공식 PDF 좌표 오버레이 시도 (forms 디렉토리에 파일 있을 때)
    official_pdf = _fill_official_pdf_pymupdf(inp, result, business_info)
    if official_pdf:
        return official_pdf

    # ── reportlab 직접 생성
    buf = io.BytesIO()
    form_no = "별지 제44호 서식" if result.tax_type == "simplified" else "별지 제21호 서식"

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        title="부가가치세 신고서 초안",
    )

    story: list = []
    story += _header_story(result, business_info, form_no)

    # ① 과세표준 및 납부세액
    story.append(_p("① 과세표준 및 납부세액", size=11, color=_DARK))
    story.append(Spacer(1, 2 * mm))

    if result.tax_type == "simplified":
        story.append(_simplified_supply_table(result))
    else:
        story.append(_general_supply_table(result))

    story.append(Spacer(1, 5 * mm))

    # ② 공제세액
    story.append(_p("② 공제세액", size=11, color=_DARK))
    story.append(Spacer(1, 2 * mm))
    story.append(_deduction_table(result))
    story.append(Spacer(1, 5 * mm))

    # ③ 납부(환급)세액 계산
    story.append(_p("③ 납부(환급)세액 계산", size=11, color=_DARK))
    story.append(Spacer(1, 2 * mm))
    story.append(_final_tax_table(result))

    story += _footer_story(result, business_info)

    doc.build(story)
    return buf.getvalue()


def _fill_official_pdf_pymupdf(
    inp: VatInput,
    result: VatResult,
    business_info: dict,
) -> bytes | None:
    """
    PyMuPDF 좌표 오버레이로 국세청 공식 서식 PDF에 계산값 삽입.

    공식 서식 파일 위치:
      backend/tax/forms/vat_simplified.pdf  ← 간이과세자 (별지 제44호서식)
      backend/tax/forms/vat_general.pdf     ← 일반과세자 (별지 제21호서식)

    좌표는 PyMuPDF 기준 (좌상단 원점, y 하향 증가), A4 595×841 pt.
    """
    fname = "vat_simplified.pdf" if inp.tax_type == "simplified" else "vat_general.pdf"
    form_path = _FORMS_DIR / fname
    if not form_path.exists():
        return None

    try:
        import fitz  # PyMuPDF

        doc = fitz.open(str(form_path))
        page = doc[0]

        def ins_num(x1: float, baseline_y: float, value: int, size: float = 7.5) -> None:
            """정수 → 콤마 포맷 우정렬 삽입 (0이면 생략).
            x1: 오른쪽 경계 좌표, baseline_y: 텍스트 베이스라인 y"""
            if value == 0:
                return
            text = f"{value:,}"
            tw = fitz.get_text_length(text, fontname="helv", fontsize=size)
            page.insert_text(fitz.Point(x1 - tw, baseline_y), text,
                             fontname="helv", fontsize=size)

        def ins_str(x0: float, baseline_y: float, text: str, size: float = 7.5) -> None:
            """텍스트 좌정렬 삽입 (한글 포함).
            x0: 왼쪽 시작 좌표, baseline_y: 텍스트 베이스라인 y"""
            if not text:
                return
            kwargs: dict = dict(fontsize=size)
            if _CJK_FONT_FILE:
                kwargs["fontfile"] = _CJK_FONT_FILE
            else:
                kwargs["fontname"] = "helv"
            page.insert_text(fitz.Point(x0, baseline_y), str(text), **kwargs)

        # ── 사업자 정보 (신고기간 y≈111, 상호·성명·사업자번호 y≈121)
        biz_num  = business_info.get("business_number", "")
        biz_name = business_info.get("business_name", "")
        owner    = business_info.get("owner_name", "")

        # 신고기간: "년 ( 월 일 ~ 월 일)"  → 각 입력칸에 개별 삽입
        p_year  = result.period_start[:4]
        p_sm    = result.period_start[5:7]
        p_sd    = result.period_start[8:10]
        p_em    = result.period_end[5:7]
        p_ed    = result.period_end[8:10]

        # ins_str(x0, baseline_y, text, size) — new signature
        ins_str(59,  115, p_year, size=7)   # 연도
        ins_str(95,  115, p_sm,   size=7)   # 시작 월
        ins_str(117, 115, p_sd,   size=7)   # 시작 일
        ins_str(140, 115, p_em,   size=7)   # 종료 월
        ins_str(163, 115, p_ed,   size=7)   # 종료 일

        ins_str(122, 127, biz_name, size=7.5)  # 상호
        ins_str(260, 127, owner,    size=7.5)  # 성명
        ins_str(388, 127, biz_num,  size=7.5)  # 사업자등록번호

        if inp.tax_type == "simplified":
            _fill_simplified_page(page, result, ins_num, ins_str)
            if doc.page_count >= 3:
                page3 = doc[2]

                def ins_num3(x1: float, baseline_y: float, value: int, size: float = 7.5) -> None:
                    if value == 0:
                        return
                    text = f"{value:,}"
                    tw = fitz.get_text_length(text, fontname="helv", fontsize=size)
                    page3.insert_text(fitz.Point(x1 - tw, baseline_y), text,
                                      fontname="helv", fontsize=size)

                _fill_simplified_page3(page3, result, ins_num3)
        else:
            _fill_general_page(page, result, ins_num, ins_str)

        buf = io.BytesIO()
        doc.save(buf)
        doc.close()
        return buf.getvalue()

    except Exception:
        return None


def _fill_simplified_page(page, result: VatResult, ins_num, ins_str) -> None:
    """
    간이과세자 별지 제44호서식 1페이지 수치 삽입.

    ins_num(x1, baseline_y, value) — 오른쪽 경계 x1 기준 우정렬
    ins_str(x0, baseline_y, text)  — 왼쪽 경계 x0 기준 좌정렬

    컬럼 오른쪽 경계 x (A4 595×841 pt):
      금액(공급대가) 우끝: 368
      세액 우끝:           538

    행 번호 → 베이스라인 y (probe_y + 4.3 보정):
      (5)  소매업·음식점업 2021.7.1 이후 (15% 부가가치율)
      (13) 합계 납부세액 ㉮
      (19) 전자신고 세액공제 (간이 5,000원)
      (22) 신용카드 매출세액공제 2021.7.1 이후
      (24) 공제세액 합계 ㉯
      (26) 예정부과(신고) 세액 ㉱
      (29) 차감납부할 세액
    """
    AMT_X1 = 368.0   # 금액(공급대가) 컬럼 우끝
    TAX_X1 = 538.0   # 세액 컬럼 우끝
    # probe_y + 4.3 → 베이스라인 (7.5pt 폰트 기준)
    B = 4.3

    def amt(probe_y: float, value: int) -> None:
        ins_num(AMT_X1, probe_y + B, value)

    def tax(probe_y: float, value: int) -> None:
        ins_num(TAX_X1, probe_y + B, value)

    # ── 과세표준 및 납부세액
    amt(219.7, result.total_supply)   # Row (5) 금액
    tax(219.7, result.gross_tax)      # Row (5) 세액

    tax(321.5, result.gross_tax)      # Row (13) 합계납부세액 ㉮

    # ── 공제세액
    tax(390.3, result.electronic_filing_deduction)  # Row (19) 전자신고

    amt(419.8, result.sales_card)          # Row (22) 금액 (카드 매출)
    tax(419.8, result.credit_card_deduction)  # Row (22) 세액 (공제액)

    tax(439.3, result.total_deduction)     # Row (24) 공제합계 ㉯

    # ── 납부(환급)세액
    if result.prepaid_tax:
        tax(458.9, result.prepaid_tax)     # Row (26) 예정부과세액 ㉱

    tax(488.5, result.final_tax)           # Row (29) 차감납부세액


def _fill_simplified_page3(page, result: VatResult, ins_num) -> None:
    """
    간이과세자 별지 제44호서식 3페이지 — 업종별 매출 내역 삽입.

    소매업·음식점업 행 (5) 하위 상세:
      (38) 세금계산서 발급분 → sales_tax_invoice
      (39) 매입자발행 세금계산서 → 0 (생략)
      (40) 신용카드·현금영수증 발행분 → sales_card
      (41) 기타(정규영수증 외 매출분) → sales_other
      (42) 합계 → total_supply

    금액(공급대가) 컬럼 우끝: 535 pt
    """
    AMT_X1 = 535.0
    B = 4.3  # probe_y + B = baseline_y

    def amt(probe_y: float, value: int) -> None:
        ins_num(AMT_X1, probe_y + B, value)

    amt(139.5, result.sales_tax_invoice)   # (38) 세금계산서 발급분
    amt(170.7, result.sales_card)          # (40) 신용카드·현금영수증
    amt(186.3, result.sales_other)         # (41) 기타
    amt(201.8, result.total_supply)        # (42) 합계


def _fill_general_page(page, result: VatResult, ins_num, ins_str) -> None:
    """
    일반과세자 별지 제21호서식 1페이지 수치 삽입.
    좌표는 간이과세자 서식과 레이아웃이 달라 실측 후 조정 필요.
    현재는 추정 좌표 사용 (TODO: 실측).
    """
    AMT_X1 = 380.0   # 공급가액 컬럼 우끝
    TAX_X1 = 490.0   # 세액 컬럼 우끝
    B = 4.3

    def amt(probe_y: float, value: int) -> None:
        ins_num(AMT_X1, probe_y + B, value)

    def tax(probe_y: float, value: int) -> None:
        ins_num(TAX_X1, probe_y + B, value)

    # 세금계산서 발급분
    amt(185.0, result.sales_tax_invoice)
    tax(185.0, round(result.sales_tax_invoice * 0.1))
    # 신용카드·현금영수증
    amt(197.0, result.sales_card)
    tax(197.0, round(result.sales_card * 0.1))
    # 기타
    amt(209.0, result.sales_other)
    tax(209.0, round(result.sales_other * 0.1))
    # 과세표준 합계 / 매출세액
    amt(221.0, result.total_supply)
    tax(221.0, result.gross_tax)
    # 매입세액
    if result.purchase_tax_deduction:
        tax(270.0, result.purchase_tax_deduction)
    # 공제세액 합계
    tax(350.0, result.total_deduction)
    # 납부(환급)세액
    tax(380.0, result.net_tax)
    # 예정부과세액
    if result.prepaid_tax:
        tax(400.0, result.prepaid_tax)
    # 차감납부(환급)세액
    tax(440.0, result.final_tax)
