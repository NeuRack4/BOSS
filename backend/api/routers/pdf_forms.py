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
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.api.dependencies import db, get_current_user_id

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
    # ① 인적사항
    F("상호_단체명",              122, 193,       cjk=True),
    F("사업장_전화번호",           382, 193,       cjk=False),
    F("성명_대표자",               122, 212,       cjk=True),
    F("주소지_전화번호",           382, 212,       cjk=False),
    F("주민등록번호",              122, 230,       cjk=False),
    F("휴대전화번호",              382, 230,       cjk=False),
    F("부동산등기용등록번호",       191, 249,       cjk=False),
    F("팩스번호",                  382, 249,       cjk=False),
    # 사업장 소재지: 주소 본문 + 층·호 우정렬
    # 층 라벨 x0=448, 호 라벨 x0=489
    F("사업장_소재지",             157, 268,       cjk=True),
    F("사업장_층",                 447, 269, r=True, cjk=False),
    F("사업장_호",                 488, 269, r=True, cjk=False),
    # 사업장이 주소지인 경우 주소 자동정정 신청 체크박스 (y=289.8)
    # ([여,@447 → [부 at x=470.3,x1=475.3 → 부 blank x=475~485
    F("주소자동정정_여",           438, 289, fs=6.0, cjk=False),  # [여] 체크 blank x=437~447
    F("주소자동정정_부",           476, 289, fs=6.0, cjk=False),  # [부] 체크 blank x=475~485

    # ② 사업장 현황 ─ 업종
    # 주업태/주종목: label 우측 빈칸 (label y0=338.7)
    # 주종목 blank: x=202.3~273.6, 오른쪽 여백 확보 위해 x=250
    F("주업태",                    165, 338,       cjk=True),
    F("주종목",                    250, 338,       cjk=True),
    # 주업종코드: 셀 내 수평분리선(y=348.6) 아래
    F("주업종코드",                383, 355,       cjk=False),
    # 개업일/종업원수: 병합셀(y=333~397), 아래 빈칸 probe_y=365
    # 종업원수는 개업일과 구분되도록 x를 충분히 오른쪽으로 (x=495)
    F("개업일",                    437, 365,       cjk=False),
    F("종업원수",                  495, 365,       cjk=False),

    # 사이버몰: 명칭 blank x=134.6~240.7, 도메인 blank x=310.7~535
    F("사이버몰_명칭",             136, 401,       cjk=True),
    F("사이버몰_도메인명",         390, 402,       cjk=False),

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

    # ⑥ 투자조합 출자 여부 체크박스 (probe_y≈515.7)
    # [여] blank x1=140.9~147.0 → x=141  /  [부] blank x1=179.1~185.2 → x=180
    F("투자조합여부_여",           141, 515, fs=6.0, cjk=False),
    F("투자조합여부_부",           180, 515, fs=6.0, cjk=False),

    # ⑦ 허가·등록·신고 사업 여부 체크박스 (probe_y≈553.2)
    # 폼 좌→우: [신고]→[등록]→[허가]→[해당없음] (레이블이 blank 오른쪽에 위치)
    # [신고]     blank x1=140.9~147.0  → x=141
    # [등록]     blank x1=175.9~181.9  → x=176
    # [허가]     blank x1=210.8~216.8  → x=211
    # [해당없음]  blank x1=245.7~251.8  → x=246
    F("허가등사업여부_신고",       141, 553, fs=6.0, cjk=False),
    F("허가등사업여부_등록",       176, 553, fs=6.0, cjk=False),
    F("허가등사업여부_허가",       211, 553, fs=6.0, cjk=False),
    F("허가등사업여부_해당없음",   246, 553, fs=6.0, cjk=False),

    # ⑧ 주류 면허 신청 여부 체크박스 (probe_y≈561.0)
    # [여] blank x1=431.6~441.1 → x=432  /  [부] blank x1=470.3~479.9 → x=471
    F("주류면허신청_여",           432, 561, fs=6.0, cjk=False),
    F("주류면허신청_부",           471, 561, fs=6.0, cjk=False),

    # ⑨ 사업자단위과세 적용 신고 여부 체크박스 (probe_y≈582.9, 우측)
    # [여] blank x1=387.4~397.4 → x=388  /  [부] blank x1=437.5~447.5 → x=438
    F("사업자단위과세_여",         388, 582, fs=6.0, cjk=False),
    F("사업자단위과세_부",         438, 582, fs=6.0, cjk=False),

    # ⑩ 간이과세 관련 체크박스 (probe_y≈639.3)
    # 간이과세 적용 신고: [여] blank x1=140.9~151.0 → x=141 / [부] blank x1=191.0~201.0 → x=192
    F("간이과세적용_여",           141, 639, fs=6.0, cjk=False),
    F("간이과세적용_부",           192, 639, fs=6.0, cjk=False),
    # 간이과세 포기 신고: [여] blank x1=387.4~397.4 → x=388 / [부] blank x1=437.5~447.5 → x=438
    F("간이과세포기_여",           388, 639, fs=6.0, cjk=False),
    F("간이과세포기_부",           438, 639, fs=6.0, cjk=False),

    # ⑪ 수신 동의 체크박스
    # 문자(SMS): blank x1=365.2~374.2 → x=366, probe_y=663.1
    # 이메일:    blank x1=365.2~374.2 → x=366, probe_y=674.8
    F("수신동의_문자",             366, 663, fs=6.0, cjk=False),
    F("수신동의_이메일",           366, 674, fs=6.0, cjk=False),

    # ⑫ 그 밖의 신청 사항 체크박스 (probe_y≈737.4, 4개 항목 × [여][부])
    # 확정일자:   [여] blank x1=140.9~145.9→x=141 / [부] blank x1=168.8~173.6→x=169
    F("확정일자_여",               141, 737, fs=6.0, cjk=False),
    F("확정일자_부",               169, 737, fs=6.0, cjk=False),
    # 공동사업자: [여] blank x1=195.3~200.4→x=196 / [부] blank x1=223.4~228.4→x=224
    F("공동사업자_여",             196, 737, fs=6.0, cjk=False),
    F("공동사업자_부",             224, 737, fs=6.0, cjk=False),
    # 송달장소:   [여] blank x1=250.1~256.4→x=251 / [부] blank x1=280.4~286.7→x=281
    F("송달장소_여",               251, 737, fs=6.0, cjk=False),
    F("송달장소_부",               281, 737, fs=6.0, cjk=False),
    # 현금영수증: [여] blank x1=308.3~314.8→x=309 / [부] blank x1=338.7~345.1→x=339
    F("현금영수증_여",             309, 737, fs=6.0, cjk=False),
    F("현금영수증_부",             339, 737, fs=6.0, cjk=False),

    # ⑬ 서명란 (2페이지 — 뒤쪽)
    # "년 월 일" 행 probe_y=520 — 오늘 날짜 자동 입력
    F("신청_년",                   434, 520, page=2, r=True, cjk=False),  # 년(x=435) 앞
    F("신청_월",                   479, 520, page=2, r=True, cjk=False),  # 월(x=480) 앞
    F("신청_일",                   524, 520, page=2, r=True, cjk=False),  # 일(x=525) 앞
    # 신청인/대리인 probe_y=532/545
    F("신청인_성명",               376, 532, page=2,         cjk=True),
    F("대리인_성명",               376, 545, page=2,         cjk=True),
]


# ──────────────────────────────────────────────────────────────────────
# 식품영업 신고서 (food-biz.pdf, A4 595×841pt)
#
# 셀 경계 (수평선):
#   접수영역   y=111~126.7 / y=126.7~132.9
#   신고인 row1 (성명+주민번호)    y=132.9~150.9
#   신고인 row2 (주소+전화번호)    y=150.9~169.0
#   신고사항 header               y=169.0~175.7
#   신고사항 row1 (명칭+전화번호)  y=175.7~191.0
#   영업의 종류                   y=191.0~276.3
#   영업장 면적                   y=276.3~291.3 (approx)
#   영업장 소재지                 y=291.3~~310
#   식품용수                      y=368.4~416.5
#   공유주방/공동조리장            y=416.5~488.5
#   신고일                        y=513.4~522.4
#
# 수직 구분선: x=113 (신고인 label 분리), x=317 (좌우 셀 분리, y=132~191)
#
# 좌표 원칙:
#   - 셀 안 label text 끝 x 이후에 값 삽입 → x 겹침 없음
#   - label과 y가 겹치는 경우: probe_y를 label_y1 아래로 설정 + fs=7.5
#   - checkbox "[  ]" blank: "[" x1 위치에서 시작, fs=6.0
#   - 면적 "[  ㎡]": "[" x1 = 269.2(내부) / 384.2(외부), 숫자를 그 안에 삽입
# ──────────────────────────────────────────────────────────────────────
FOOD_BIZ: list[FieldCoord] = [
    # ① 신고인
    # Row1 y=132.9~150.9  (label y=136.9~146.8 → 값은 label 끝 아래쪽 배치)
    # 성명 label이 x=115.8~308.3 을 가득 채움 → x=116 그대로, probe_y를 label 바로 아래로
    F("신고인_성명",               116, 146, fs=7.5,  cjk=True),
    # 주민번호 label 끝 x=407.4 → x=408부터 삽입
    F("신고인_주민등록번호",        408, 146, fs=7.5,  cjk=False),
    # Row2 y=150.9~169.0  (label y=154.9~164.8)
    F("신고인_주소",               116, 164, fs=7.5,  cjk=True),
    # 전화번호 label 끝 x=359.9 → x=361부터
    F("신고인_전화번호",            361, 164, fs=7.5,  cjk=False),

    # ② 신고사항 - 명칭/전화 row  y=175.7~191.0  (label y=179.6~189.6)
    # 명칭(상호) label 끝 x=163.3 → x=164부터 → label과 x 겹침 없음
    F("명칭_상호",                 164, 184, fs=8.0,  cjk=True),
    # 전화번호 label 끝 x=359.9 → x=361부터
    F("영업장_전화번호",            361, 184, fs=8.0,  cjk=False),

    # ③ 영업의 종류 체크박스  y=191~276.3
    # 각 "[" x1 위치에 "V" (fs=6.0)
    # y=193.9~203.8: 즉석판매제조가공업 / 집단급식소 / 일반음식점영업
    F("영업종류_즉석판매제조ㆍ가공업", 162, 197, fs=6.0, cjk=False),
    F("영업종류_집단급식소식품판매업", 290, 197, fs=6.0, cjk=False),
    F("영업종류_일반음식점영업",      424, 197, fs=6.0, cjk=False),
    # y=208.2~218.1: 식품운반업 / 기타식품판매업 / 위탁급식영업
    F("영업종류_식품운반업",          162, 211, fs=6.0, cjk=False),
    F("영업종류_기타식품판매업",      290, 211, fs=6.0, cjk=False),
    F("영업종류_위탁급식영업",        424, 211, fs=6.0, cjk=False),
    # y=222.3~232.3: 식품소분업 / 식품냉동냉장업 / 제과점영업
    F("영업종류_식품소분업",          162, 225, fs=6.0, cjk=False),
    F("영업종류_식품냉동ㆍ냉장업",   290, 225, fs=6.0, cjk=False),
    F("영업종류_제과점영업",          424, 225, fs=6.0, cjk=False),
    # y=236.6~246.6: 식용얼음판매업 / 용기포장지제조업
    F("영업종류_식용얼음판매업",      162, 239, fs=6.0, cjk=False),
    F("영업종류_용기ㆍ포장지제조업", 290, 239, fs=6.0, cjk=False),
    # y=250.9~260.8: 식품자동판매기영업 / 옹기류제조업
    F("영업종류_식품자동판매기영업",  162, 253, fs=6.0, cjk=False),
    F("영업종류_옹기류제조업",        290, 253, fs=6.0, cjk=False),
    # y=265.0~275.0: 유통전문판매업 / 휴게음식점영업
    F("영업종류_유통전문판매업",      162, 268, fs=6.0, cjk=False),
    F("영업종류_휴게음식점영업",      290, 268, fs=6.0, cjk=False),

    # ④ 영업장 면적  label y=280.3~290.2
    # 내부: "[" x=264.2~269.2, "㎡]" x=284.3~299.2 → 숫자: x=270~284 사이에 삽입
    F("영업장_내부면적_㎡",          270, 283, fs=8.0, cjk=False),
    # 외부: "[" x=379.2~384.2, "㎡]" x=399.2~414.2 → 숫자: x=385~399 사이에 삽입
    F("영업장_외부면적_㎡",          385, 283, fs=8.0, cjk=False),

    # ⑤ 영업장 소재지  label y=291.3~301.3, x=115.8~194.2
    # label 끝 x=194.2 이후에 값 삽입 → x=196, label과 x 겹침 없음
    F("영업장_소재지",               196, 298, fs=8.0, cjk=True),

    # ⑥ 식품용수 체크박스  y=372.6~382.5
    # 수돗물: "[" x1=206.8,  먹는샘물: "[" x1=266.8,  먹는염지하수: "[" x1=341.8
    F("식품용수_수돗물",             207, 375, fs=6.0, cjk=False),
    F("식품용수_먹는샘물",           267, 375, fs=6.0, cjk=False),
    F("식품용수_먹는염지하수",       342, 375, fs=6.0, cjk=False),
    # y=383.6~393.6: 지하수
    F("식품용수_지하수",             207, 387, fs=6.0, cjk=False),
    # y=394.5~404.5: 먹는해양심층수 / 그밖의먹는물
    F("식품용수_먹는해양심층수",     207, 397, fs=6.0, cjk=False),
    F("식품용수_그밖의먹는물",       342, 397, fs=6.0, cjk=False),

    # ⑦ 공유주방 / 공동조리장  y=416.5~458.0
    # 공유주방 사용여부: 해당 "[" x=221.9~226.9, 미해당 "[" x=271.8~276.8
    F("공유주방_해당",               222, 424, fs=6.0, cjk=False),
    F("공유주방_미해당",             272, 424, fs=6.0, cjk=False),
    # 공동조리장 이용여부: 해당 "[" x=226.8~231.8, 미해당 "[" x=276.8~281.8
    F("공동조리장_해당",             227, 439, fs=6.0, cjk=False),
    F("공동조리장_미해당",           277, 439, fs=6.0, cjk=False),
    # 공동조리장 업소정보: "소재지:" label y=447.1~457.0
    F("공동조리장_업소정보",          411, 450, fs=7.5, cjk=True),

    # ⑧ 신고일  y=513.4~522.4
    # "년" x=442.8, "월" x=483.1, "일" x=523.6 → 각 라벨 왼쪽에 우정렬 삽입
    F("신고_년",                     442, 516, r=True,  cjk=False),
    F("신고_월",                     483, 516, r=True,  cjk=False),
    F("신고_일",                     523, 516, r=True,  cjk=False),
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

    # 식품영업 신고서: 신고일 분리 + 체크박스 값 변환 + 휴게음식점 기본 체크
    if doc_type == "food-business-license":
        # 신고일 "YYYY-MM-DD" → 신고_년/월/일 분리
        raw_date = fields.get("신고일", "")
        if raw_date:
            parts = raw_date.replace(".", "-").split("-")
            if len(parts) == 3:
                fields.setdefault("신고_년", parts[0])
                fields.setdefault("신고_월", parts[1].zfill(2))
                fields.setdefault("신고_일", parts[2].zfill(2))
        else:
            today = _date.today()
            fields.setdefault("신고_년", str(today.year))
            fields.setdefault("신고_월", str(today.month).zfill(2))
            fields.setdefault("신고_일", str(today.day).zfill(2))
        # 체크박스: "해당"/"V" 모두 "V"로 통일 (FoodBusinessLicenseForm에서 "해당" 사용)
        for k in list(fields.keys()):
            if fields[k] in ("해당", "V"):
                fields[k] = "V"
        # 공유주방_사용여부 → 해당/미해당 별도 좌표 키로 분리
        sw = fields.get("공유주방_사용여부", "")
        if sw == "V":
            fields["공유주방_해당"] = "V"
        elif sw in ("미해당", ""):
            fields["공유주방_미해당"] = "V"
        # 공동조리장_이용여부 → 별도 키로 분리
        cw = fields.get("공동조리장_이용여부", "")
        if cw == "V":
            fields["공동조리장_해당"] = "V"
        elif cw in ("미해당", ""):
            fields["공동조리장_미해당"] = "V"
        # 카페 = 휴게음식점영업 기본 체크
        fields.setdefault("영업종류_휴게음식점영업", "V")
        # 식품용수 기본: 수돗물 체크
        fields.setdefault("식품용수_수돗물", "V")

    # 사업자등록 신청서: 오늘 날짜 + 고정값 주입
    if doc_type == "business-registration":
        today = _date.today()
        fields.setdefault("신청_년", str(today.year))
        fields.setdefault("신청_월", str(today.month).zfill(2))
        fields.setdefault("신청_일", str(today.day).zfill(2))
        # 신청인_성명 = 성명_대표자 (없으면 빈칸)
        if "신청인_성명" not in fields and "성명_대표자" in fields:
            fields["신청인_성명"] = fields["성명_대표자"]
        # 주종목 고정 (AI 생성값 무시)
        fields["주종목"] = "카페"

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


@router.post("/save-fields/{doc_type}", summary="서류 필드 DB 저장")
async def save_draft_fields(
    doc_type: str,
    req: FillPdfRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(db),
):
    """필드값을 drafts 테이블 metadata에 upsert (type+user_id 기준)"""
    config = DOC_CONFIG.get(doc_type)
    if not config:
        raise HTTPException(status_code=404, detail=f"지원하지 않는 서류 유형: {doc_type}")

    metadata = {"fields": dict(req.fields)}

    existing = (
        supabase.table("drafts")
        .select("id")
        .eq("user_id", user_id)
        .eq("type", doc_type)
        .maybe_single()
        .execute()
    )

    if existing.data:
        supabase.table("drafts").update({"metadata": metadata}).eq(
            "id", existing.data["id"]
        ).execute()
    else:
        supabase.table("drafts").insert(
            {
                "user_id": user_id,
                "type": doc_type,
                "storage_path": f"fields/{doc_type}/{user_id}",
                "metadata": metadata,
            }
        ).execute()

    return {"ok": True}


@router.get("/load-fields/{doc_type}", summary="DB에서 서류 필드 불러오기")
async def load_draft_fields(
    doc_type: str,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(db),
):
    """drafts 테이블에서 저장된 필드값 반환 (없으면 null)"""
    config = DOC_CONFIG.get(doc_type)
    if not config:
        raise HTTPException(status_code=404, detail=f"지원하지 않는 서류 유형: {doc_type}")

    result = (
        supabase.table("drafts")
        .select("metadata")
        .eq("user_id", user_id)
        .eq("type", doc_type)
        .maybe_single()
        .execute()
    )

    if result.data and result.data.get("metadata", {}).get("fields"):
        return {"fields": result.data["metadata"]["fields"]}
    return {"fields": None}
