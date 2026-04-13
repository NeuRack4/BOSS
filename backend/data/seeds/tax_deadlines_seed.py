"""
세금 기한 시드 데이터 — 공공데이터 API 미응답 시 fallback
연 1회 수동 갱신 (매년 1월 초)
"""
from datetime import date


def get_seed_deadlines(year: int) -> list[dict]:
    """주어진 연도의 세금 기한 목록 반환"""
    y = year
    yn = year + 1  # 다음 해 (2기 확정신고·종합소득세 기준)

    base: list[dict] = [
        # ── 부가가치세 ──────────────────────────────────────────
        {
            "tax_type": "vat",
            "title": "부가세 1기 예정신고",
            "deadline_date": str(date(y, 4, 25)),
            "year": y,
            "description": "1~3월 과세기간 부가가치세 예정신고·납부",
            "source_url": "https://www.hometax.go.kr",
        },
        {
            "tax_type": "vat",
            "title": "부가세 1기 확정신고",
            "deadline_date": str(date(y, 7, 25)),
            "year": y,
            "description": "1~6월 과세기간 부가가치세 확정신고·납부",
            "source_url": "https://www.hometax.go.kr",
        },
        {
            "tax_type": "vat",
            "title": "부가세 2기 예정신고",
            "deadline_date": str(date(y, 10, 25)),
            "year": y,
            "description": "7~9월 과세기간 부가가치세 예정신고·납부",
            "source_url": "https://www.hometax.go.kr",
        },
        {
            "tax_type": "vat",
            "title": "부가세 2기 확정신고",
            "deadline_date": str(date(yn, 1, 25)),
            "year": y,
            "description": "7~12월 과세기간 부가가치세 확정신고·납부",
            "source_url": "https://www.hometax.go.kr",
        },
        # ── 종합소득세 ──────────────────────────────────────────
        {
            "tax_type": "income",
            "title": "종합소득세 신고",
            "deadline_date": str(date(yn, 5, 31)),
            "year": y,
            "description": f"{y}년도 소득에 대한 종합소득세 확정신고·납부",
            "source_url": "https://www.hometax.go.kr",
        },
    ]

    # ── 원천세: 전월분 다음 달 10일 납부 (직원 있는 경우) ────
    for m in range(1, 13):
        if m < 12:
            pay_date = date(y, m + 1, 10)
        else:
            pay_date = date(yn, 1, 10)

        base.append({
            "tax_type": "withholding",
            "title": f"원천세 {m}월분 납부",
            "deadline_date": str(pay_date),
            "year": y,
            "description": f"{y}년 {m}월 급여 원천징수세액 납부 (직원 있는 경우)",
            "source_url": "https://www.hometax.go.kr",
        })

    return base
