from enum import StrEnum


class BusinessType(StrEnum):
    CAFE = "cafe"
    BAKERY = "bakery"
    SNACK = "snack"  # 분식


class FounderStage(StrEnum):
    """창업자 단계 상태머신"""
    SETUP = "setup"             # 창업 준비
    EARLY_OPS = "early_ops"     # 초기 운영 (오픈 후 ~6개월)
    GROWTH = "growth"           # 성장기 (6개월 이후)


class FounderSubStage(StrEnum):
    """세부 단계"""
    # SETUP
    LOCATION_SEARCH = "location_search"         # 입지 탐색
    LEASE_REVIEW = "lease_review"               # 임대차 계약 검토
    BUSINESS_REGISTRATION = "biz_registration"  # 사업자 등록
    LICENSE_APPLICATION = "license_application" # 인허가 신청
    INTERIOR = "interior"                       # 인테리어
    PRE_OPEN = "pre_open"                       # 오픈 직전

    # EARLY_OPS
    OPEN = "open"               # 오픈
    HIRING_PREPARATION = "hiring_preparation"  # 채용 준비 (공고 초안 생성)
    HIRING_IN_PROGRESS = "hiring_in_progress"  # 공고 게시 후 지원자 대기
    HIRING_CONTRACT = "hiring_contract"        # 면접 완료 → 계약서 초안 자동 생성
    TAX_SETUP = "tax_setup"     # 세금 신고 셋업

    # GROWTH
    SUBSIDY_ACTIVE = "subsidy_active"   # 지원사업 활성화


class TriggerType(StrEnum):
    TIME_BASED = "time_based"
    STATE_TRANSITION = "state_transition"
    EVENT_DETECTION = "event_detection"
    INFERENCE = "inference"


class DocumentCategory(StrEnum):
    LICENSE = "license"
    TAX = "tax"
    LABOR = "labor"
    LEASE = "lease"
    SUBSIDY = "subsidy"
    REGULATION = "regulation"  # 규제법령 (식품위생법, 소방법, 건축법 등)


class DraftType(StrEnum):
    SUBSIDY_APPLICATION = "subsidy_application"
    LABOR_CONTRACT = "labor_contract"
    LEASE_CONTRACT = "lease_contract"
    TAX_RETURN = "tax_return"
    JOB_POSTING = "job_posting"
    WAGE_SIMULATION = "wage_simulation"  # 인건비 시뮬레이션 리포트


# 서울 자치구 목록
SEOUL_DISTRICTS = [
    "강남구", "강동구", "강북구", "강서구", "관악구",
    "광진구", "구로구", "금천구", "노원구", "도봉구",
    "동대문구", "동작구", "마포구", "서대문구", "서초구",
    "성동구", "성북구", "송파구", "양천구", "영등포구",
    "용산구", "은평구", "종로구", "중구", "중랑구",
]

LEGAL_DISCLAIMER = (
    "본 내용은 참고용이며 실제 신고 및 계약 전 전문가 확인을 권장합니다."
)

# ============================================================
# 마포구 카페 시뮬레이션 상수 (2024 기준)
# ============================================================

# 비용 구조
MAPO_AVG_RENT = 2_800_000          # 마포구 카페 평균 월세 (원)
MAPO_AVG_FIXED_COST = 1_500_000    # 인건비·공과금 등 평균 고정비 (원)
MAPO_AVG_INITIAL_INVEST = 50_000_000  # 평균 초기 투자금 (원, 인테리어+보증금)

# 매출 추정 파라미터
CAFE_AVG_UNIT_PRICE = 4_500        # 평균 객단가 (원)
CAFE_CONVERSION_RATE = 0.03        # 유동인구 → 방문객 전환율

# 스코어 가중치 (합계 = 1.0)
SCORE_WEIGHTS = {
    "survival":   0.35,
    "saturation": 0.25,   # 역산 (낮을수록 좋음)
    "revenue":    0.20,
    "bep":        0.10,   # 역산 (짧을수록 좋음)
    "growth":     0.10,
}

# 위험도 임계값 (종합 스코어 기준)
RISK_HIGH_THRESHOLD = 40.0
RISK_LOW_THRESHOLD  = 65.0
