"""
홈택스(hometax.go.kr) 부가가치세 신고 단계별 입력 가이드 생성

창업자가 홈택스에서 직접 신고할 때 각 필드에 입력할 값을 미리 계산해 제공한다.
"""
from backend.tax.vat_calculator import VatResult, TaxType


def generate_vat_hometax_guide(result: VatResult, business_info: dict) -> dict:
    """
    홈택스 부가가치세 신고 가이드 반환.

    반환 구조:
    {
        "tax_type": "simplified" | "general",
        "period": "2024-07-01 ~ 2024-12-31",
        "declaration_type": "확정신고" | "예정신고",
        "deadline": "2025-01-25",
        "final_tax": 128650,
        "steps": [ { step, menu, description, fields: [...] } ],
        "important_notes": [...],
    }
    """
    is_final = (
        result.period_end.endswith("-12-31")
        or result.period_end.endswith("-06-30")
    )
    declaration_type = "확정신고" if is_final else "예정신고"
    tax_type_str = "간이과세자" if result.tax_type == "simplified" else "일반과세자"

    # 신고 기한 계산 (기말 다음 달 25일)
    end_year, end_month, _ = result.period_end.split("-")
    next_month = int(end_month) + 1
    next_year  = int(end_year)
    if next_month > 12:
        next_month = 1
        next_year += 1
    deadline = f"{next_year}-{next_month:02d}-25"

    steps: list[dict] = [
        {
            "step": 1,
            "menu": "홈택스 로그인",
            "description": "공동·금융인증서 또는 간편인증(카카오톡·PASS·삼성패스 등)으로 로그인",
            "fields": [],
        },
        {
            "step": 2,
            "menu": "신고/납부 > 세금신고 > 부가가치세 > 신고서 작성",
            "description": (
                f"{tax_type_str} {declaration_type} 선택. "
                f"과세기간: {result.period_start} ~ {result.period_end}"
            ),
            "fields": [
                {"field": "과세자 유형",  "value": tax_type_str, "note": "간이/일반 선택"},
                {"field": "신고 유형",    "value": declaration_type},
                {"field": "과세기간 시작", "value": result.period_start},
                {"field": "과세기간 종료", "value": result.period_end},
            ],
        },
        {
            "step": 3,
            "menu": "과세표준 및 매출세액 입력",
            "description": "매출 유형별 공급가액 입력 (부가세 제외 금액)",
            "fields": [
                {
                    "field": "세금계산서 발급분 공급대가",
                    "value": result.sales_tax_invoice,
                    "unit": "원",
                    "note": "세금계산서를 발행한 매출액 합계",
                },
                {
                    "field": "신용카드·현금영수증 발급분 공급대가",
                    "value": result.sales_card,
                    "unit": "원",
                    "note": "카드단말기 월 합산 + 배달앱 매출",
                },
                {
                    "field": "기타(현금 등) 공급대가",
                    "value": result.sales_other,
                    "unit": "원",
                    "note": "현금영수증 미발행 현금 매출",
                },
                {
                    "field": "공급대가 합계",
                    "value": result.total_supply,
                    "unit": "원",
                    "note": "자동 계산 확인",
                },
            ],
        },
    ]

    # 일반과세자 추가 단계 (매입세액)
    if result.tax_type == "general":
        p_supply = round(result.purchase_tax_deduction / 0.1) if result.purchase_tax_deduction else 0
        steps.append({
            "step": 4,
            "menu": "매입세액 공제 입력",
            "description": "수취한 세금계산서 합계 입력 (원재료, 임차료 등 사업 관련 매입)",
            "fields": [
                {
                    "field": "세금계산서 수취분 공급가액",
                    "value": p_supply,
                    "unit": "원",
                },
                {
                    "field": "매입세액 합계",
                    "value": result.purchase_tax_deduction,
                    "unit": "원",
                    "note": "자동 계산 확인",
                },
            ],
        })

    step_offset = 4 if result.tax_type == "simplified" else 5

    steps.append({
        "step": step_offset,
        "menu": "공제세액 입력 확인",
        "description": "신용카드 공제·전자신고 공제는 홈택스에서 자동 계산됩니다. 금액만 확인하세요.",
        "fields": [
            {
                "field": "신용카드 등 매출세액 공제",
                "value": result.credit_card_deduction,
                "unit": "원",
                "note": "자동 계산 확인 (신용카드 공급대가 × 1.3%)",
            },
            {
                "field": "전자신고 세액공제",
                "value": result.electronic_filing_deduction,
                "unit": "원",
                "note": "홈택스 전자신고 시 자동 적용 (10,000원)",
            },
        ],
    })

    steps.append({
        "step": step_offset + 1,
        "menu": "신고서 최종 확인 및 제출",
        "description": "납부세액 확인 후 '신고서 제출' 클릭. 납부기한 내 납부 필수.",
        "fields": [
            {
                "field": "납부(환급)세액",
                "value": result.net_tax,
                "unit": "원",
            },
            {
                "field": "(-) 예정고지 기납부세액",
                "value": result.prepaid_tax,
                "unit": "원",
                "note": "예정고지 납부한 경우만 해당",
            },
            {
                "field": "차감 납부(환급)세액",
                "value": result.final_tax,
                "unit": "원",
                "note": "← 실제 납부 금액 (마이너스면 환급)",
            },
        ],
    })

    steps.append({
        "step": step_offset + 2,
        "menu": "납부",
        "description": (
            f"신고 후 {deadline}까지 납부. "
            "홈택스 즉시납부 / 인터넷뱅킹 / 은행 방문 가능."
        ),
        "fields": [
            {
                "field": "납부 금액",
                "value": max(0, result.final_tax),
                "unit": "원",
            },
            {
                "field": "납부 기한",
                "value": deadline,
                "note": f"{declaration_type} 기한 엄수 (가산세 발생 주의)",
            },
        ],
    })

    notes: list[str] = [
        f"신고기한: {deadline} (기한 초과 시 무신고가산세 20% 부과)",
        "납부는 홈택스 즉시납부·인터넷뱅킹·은행 방문 모두 가능",
    ]

    if result.tax_type == "simplified":
        notes.append(
            "간이과세자는 연 2회 신고 (1기: 1~6월 → 7/25까지, 2기: 7~12월 → 다음해 1/25까지)"
        )
        notes.append(
            "연매출 4,800만원 미만 간이과세자는 납부의무 면제 가능 — 관할 세무서 확인 권장"
        )
    else:
        notes.append(
            "일반과세자는 연 4회 (1·3분기 예정신고 + 2·4분기 확정신고)"
        )

    notes.append("본 가이드는 AI 생성 참고용입니다. 실제 신고 전 세무사 확인을 권장합니다.")

    return {
        "tax_type":         result.tax_type,
        "tax_type_label":   tax_type_str,
        "period":           f"{result.period_start} ~ {result.period_end}",
        "declaration_type": declaration_type,
        "deadline":         deadline,
        "final_tax":        result.final_tax,
        "steps":            steps,
        "important_notes":  notes,
    }
