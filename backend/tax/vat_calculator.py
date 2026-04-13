"""
부가가치세 계산 엔진

간이과세자: 공급가액 × 업종별 부가가치율(15%) × 10%
일반과세자: 매출세액(공급가액 × 10%) - 매입세액(세금계산서 × 10%)
"""
from dataclasses import dataclass, field
from typing import Literal

TaxType = Literal["simplified", "general"]

# 업종별 부가가치율 (간이과세자, 부가가치세법 시행령 별표)
VAT_RATE_BY_BUSINESS: dict[str, float] = {
    "cafe":    0.15,   # 음식점업
    "bakery":  0.15,
    "snack":   0.15,
    "retail":  0.15,   # 소매업
    "service": 0.30,   # 서비스업
}

CREDIT_CARD_DEDUCTION_RATE = 0.013  # 신용카드 등 매출세액 공제율 1.3%
# 전자신고 세액공제: 간이과세자 5,000원 / 일반과세자 10,000원 (조세특례제한법 §104의8②)
ELECTRONIC_FILING_DEDUCTION_SIMPLIFIED = 5_000
ELECTRONIC_FILING_DEDUCTION_GENERAL    = 10_000
TAX_RATE = 0.10                        # 부가세율 10%


@dataclass
class VatInput:
    """부가세 신고 입력 데이터"""
    user_id: str
    tax_type: TaxType
    period_start: str        # "YYYY-MM-DD"
    period_end: str          # "YYYY-MM-DD"
    business_type: str = "cafe"

    # 매출 (공급가액, 원 — VAT 별도)
    sales_tax_invoice: int = 0    # 세금계산서 발급분
    sales_card: int = 0           # 신용카드·현금영수증 발급분
    sales_other: int = 0          # 기타 (현금 미발행분)

    # 매입 (공급가액, 원) — 일반과세자에서 사용
    purchase_tax_invoice: int = 0  # 세금계산서 수취 합계

    # 기납부세액
    prepaid_tax: int = 0           # 예정고지 기납부세액


@dataclass
class VatResult:
    """부가세 계산 결과"""
    tax_type: TaxType
    period_start: str
    period_end: str

    # 공급가액 내역
    sales_tax_invoice: int
    sales_card: int
    sales_other: int
    total_supply: int

    # 세액 계산
    vat_rate_applied: float     # 간이: 업종 부가가치율, 일반: 0.10
    gross_tax: int              # 납부세액 (공제 전)

    # 공제
    credit_card_deduction: int          # 신용카드 매출세액 공제
    electronic_filing_deduction: int    # 전자신고 세액공제
    purchase_tax_deduction: int         # 매입세액 공제 (일반과세자)
    total_deduction: int

    # 최종
    net_tax: int       # 납부(환급)세액 (공제 후)
    prepaid_tax: int   # 예정고지 기납부세액
    final_tax: int     # 차감납부(환급)세액 — 실제 납부 금액

    notes: list[str] = field(default_factory=list)


def calculate_vat(inp: VatInput) -> VatResult:
    """
    부가가치세 계산.
    간이/일반과세자 분기 처리 후 VatResult 반환.
    """
    total_supply = inp.sales_tax_invoice + inp.sales_card + inp.sales_other

    if inp.tax_type == "simplified":
        vat_rate = VAT_RATE_BY_BUSINESS.get(inp.business_type, 0.15)
        gross_tax = round(total_supply * vat_rate * TAX_RATE)
        purchase_deduction = 0
        notes = [
            f"간이과세자 업종별 부가가치율: {int(vat_rate * 100)}% (카페/음식점)",
            f"납부세액 = {total_supply:,}원 × {int(vat_rate * 100)}% × 10% = {gross_tax:,}원",
        ]
    else:
        vat_rate = TAX_RATE
        gross_tax = round(total_supply * TAX_RATE)
        purchase_deduction = round(inp.purchase_tax_invoice * TAX_RATE)
        notes = [
            f"일반과세자 매출세액: {total_supply:,}원 × 10% = {gross_tax:,}원",
            f"매입세액 공제: {inp.purchase_tax_invoice:,}원 × 10% = {purchase_deduction:,}원",
        ]

    # 신용카드 등 매출세액 공제 (납부세액 한도)
    raw_card_ded = round(inp.sales_card * CREDIT_CARD_DEDUCTION_RATE)
    credit_card_deduction = min(raw_card_ded, gross_tax)

    # 전자신고 세액공제 (납부세액 있을 때만)
    e_rate = (ELECTRONIC_FILING_DEDUCTION_SIMPLIFIED if inp.tax_type == "simplified"
              else ELECTRONIC_FILING_DEDUCTION_GENERAL)
    e_deduction = e_rate if gross_tax > 0 else 0

    total_deduction = credit_card_deduction + e_deduction + purchase_deduction
    net_tax = max(0, gross_tax - total_deduction)
    final_tax = net_tax - inp.prepaid_tax  # 음수면 환급

    notes.append(f"신용카드 매출세액 공제: {credit_card_deduction:,}원 (신용카드 매출 × 1.3%)")
    notes.append(f"전자신고 세액공제: {e_deduction:,}원")
    notes.append(f"최종 납부세액: {final_tax:,}원")

    return VatResult(
        tax_type=inp.tax_type,
        period_start=inp.period_start,
        period_end=inp.period_end,
        sales_tax_invoice=inp.sales_tax_invoice,
        sales_card=inp.sales_card,
        sales_other=inp.sales_other,
        total_supply=total_supply,
        vat_rate_applied=vat_rate,
        gross_tax=gross_tax,
        credit_card_deduction=credit_card_deduction,
        electronic_filing_deduction=e_deduction,
        purchase_tax_deduction=purchase_deduction,
        total_deduction=total_deduction,
        net_tax=net_tax,
        prepaid_tax=inp.prepaid_tax,
        final_tax=final_tax,
        notes=notes,
    )


def aggregate_financials_to_vat_input(
    user_id: str,
    financials: list[dict],
    business_info: dict,
    period_start: str,
    period_end: str,
    prepaid_tax: int = 0,
) -> VatInput:
    """
    founder_financials 행 목록 → VatInput 변환.
    period_start/end: "YYYY-MM-DD"
    """
    tax_type: TaxType = business_info.get("tax_type", "simplified")
    business_type = business_info.get("business_type", "cafe")

    sales_card      = sum(r.get("sales_card", 0)           for r in financials)
    sales_cash      = sum(r.get("sales_cash", 0)            for r in financials)
    sales_delivery  = sum(r.get("sales_delivery", 0)        for r in financials)
    sales_tax_inv   = sum(r.get("sales_tax_invoice", 0)     for r in financials)
    p_tax_inv       = sum(r.get("purchase_tax_invoice", 0)  for r in financials)

    # 배달 매출은 카드 매출로 집계 (카드 공제 대상)
    total_card = sales_card + sales_delivery

    return VatInput(
        user_id=user_id,
        tax_type=tax_type,
        period_start=period_start,
        period_end=period_end,
        business_type=business_type,
        sales_tax_invoice=sales_tax_inv,
        sales_card=total_card,
        sales_other=sales_cash,
        purchase_tax_invoice=p_tax_inv,
        prepaid_tax=prepaid_tax,
    )
