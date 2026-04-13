"""
Enterprise 계정 mock 재무 데이터 시드
- 상호: 마포라운지커피 (홍대입구)
- 과세유형: 간이과세자
- 기간: 2024년 7월 ~ 12월 (2기)
- 연매출 약 4,800만원 수준

실행: python -m backend.data.seeds.mock_financials
"""
import uuid
from backend.db.client import get_supabase

# ── 고정 UUID (Supabase Auth에서 enterprise@boss-demo.kr 계정 생성 후 여기에 입력)
ENTERPRISE_USER_ID = "00000000-0000-0000-0000-000000000001"

# ── 2024년 2기 (7~12월) mock 매출 데이터
# 카드 70% / 현금 30% 비율, 배달 0% (홀 카페 기준)
_MONTHLY_DATA = [
    # (year, month, sales_card, sales_cash, purchase_ingredient, purchase_rent, purchase_other, purchase_tax_invoice)
    (2024, 7,  2_660_000, 1_140_000, 800_000, 1_500_000, 200_000, 800_000),   # 여름 성수기
    (2024, 8,  2_940_000, 1_260_000, 880_000, 1_500_000, 200_000, 880_000),   # 성수기 피크
    (2024, 9,  2_520_000, 1_080_000, 760_000, 1_500_000, 180_000, 760_000),
    (2024, 10, 2_800_000, 1_200_000, 820_000, 1_500_000, 200_000, 820_000),
    (2024, 11, 2_450_000, 1_050_000, 740_000, 1_500_000, 180_000, 740_000),
    (2024, 12, 3_080_000, 1_320_000, 900_000, 1_500_000, 220_000, 900_000),   # 연말 성수기
]

# ── 사업자 정보
_BUSINESS_INFO = {
    "user_id": ENTERPRISE_USER_ID,
    "business_name": "마포라운지커피",
    "business_number": "123-45-67890",
    "owner_name": "김창업",
    "address": "서울특별시 마포구 어울마당로 65, 1층 (서교동)",
    "tax_type": "simplified",
}


def seed_enterprise_financials() -> None:
    """enterprise 계정 재무 데이터 + 사업자 정보 upsert"""
    supabase = get_supabase()

    # 사업자 정보 upsert
    supabase.table("founder_business_info").upsert(
        _BUSINESS_INFO, on_conflict="user_id"
    ).execute()
    print(f"[seed] business_info upserted: {_BUSINESS_INFO['business_name']}")

    # 월별 재무 데이터 upsert
    rows = []
    for year, month, s_card, s_cash, p_ing, p_rent, p_other, p_tax_inv in _MONTHLY_DATA:
        rows.append({
            "user_id": ENTERPRISE_USER_ID,
            "year": year,
            "month": month,
            "sales_card": s_card,
            "sales_cash": s_cash,
            "sales_delivery": 0,
            "sales_tax_invoice": 0,
            "purchase_ingredient": p_ing,
            "purchase_rent": p_rent,
            "purchase_other": p_other,
            "purchase_tax_invoice": p_tax_inv,
        })

    supabase.table("founder_financials").upsert(
        rows, on_conflict="user_id,year,month"
    ).execute()
    print(f"[seed] {len(rows)}개월 재무 데이터 upserted ({rows[0]['year']}년 {rows[0]['month']}월 ~ {rows[-1]['year']}년 {rows[-1]['month']}월)")

    # 요약 출력
    total_card  = sum(r["sales_card"] for r in rows)
    total_cash  = sum(r["sales_cash"] for r in rows)
    total_sales = total_card + total_cash
    gross_tax   = round(total_sales * 0.15 * 0.10)
    card_ded    = round(total_card * 0.013)
    final_tax   = max(0, gross_tax - card_ded - 10_000)
    print(f"\n[mock VAT preview]")
    print(f"  2024년 2기 총 매출: {total_sales:,}원")
    print(f"  납부세액 (공제전):  {gross_tax:,}원")
    print(f"  신용카드 공제:      {card_ded:,}원")
    print(f"  전자신고 공제:      10,000원")
    print(f"  예상 납부세액:      {final_tax:,}원")


if __name__ == "__main__":
    seed_enterprise_financials()
