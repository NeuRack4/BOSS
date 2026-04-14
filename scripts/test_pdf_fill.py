"""사업자등록 신청서 PDF 채우기 테스트 — 체크박스 좌표 검증용"""
import sys, os
sys.path.insert(0, ".")
os.makedirs("scripts/test_output", exist_ok=True)
os.makedirs("scripts/calibrate", exist_ok=True)

from pathlib import Path
from backend.api.routers.pdf_forms import _fill_pdf, DOC_CONFIG
import fitz

FORMS_DIR = Path("frontend/public/forms")

sample = {
    # ① 인적사항
    "상호_단체명":              "연남 커피",
    "사업장_전화번호":           "02-3456-7890",
    "성명_대표자":               "홍길동",
    "주소지_전화번호":           "02-1111-2222",
    "주민등록번호":              "900101-1234567",
    "휴대전화번호":              "010-1234-5678",
    "사업장_소재지":             "서울시 마포구 연남동 123-4",
    "사업장_층":                 "1",
    "사업장_호":                 "",
    # 주소 자동정정: [부] 체크
    "주소자동정정_부":           "V",

    # ② 업종
    "주업태":                   "음식점업",
    "주종목":                   "커피전문점",
    "주업종코드":               "562110",
    "개업일":                   "2026-05-01",
    "종업원수":                  "2",
    # 사이버몰
    "사이버몰_명칭":             "연남커피",
    "사이버몰_도메인명":         "www.yncafe.co.kr",

    # ③ 사업장 구분 + 임대차 명세
    "자가면적_㎡":              "0",
    "타가면적_㎡":              "33",
    "임대인_성명":               "김임대",
    "임대인_사업자등록번호":     "123-45-67890",
    "임대차계약기간_시작":       "2025.04",
    "임대차계약기간_종료":       "2027.04",
    "전세보증금":               "0",
    "월세_차임":                "1,500,000",

    # ④ 사업자금
    "사업자금_자기자금":         "5,000,000",
    "사업자금_타인자금":         "0",

    # ⑤ 전자우편
    "전자우편주소":              "hello@yncafe.co.kr",

    # ⑥ 투자조합: [부] 체크
    "투자조합여부_부":           "V",

    # ⑦ 허가·등록·신고: [신고] 체크
    "허가등사업여부_신고":       "V",

    # ⑧ 주류면허: [부] 체크
    "주류면허신청_부":           "V",

    # ⑨ 사업자단위과세: [부] 체크
    "사업자단위과세_부":         "V",

    # ⑩ 간이과세 적용: [부] 체크 / 포기: [여] 체크
    "간이과세적용_부":           "V",
    "간이과세포기_여":           "V",

    # ⑪ 수신동의: [문자] 체크
    "수신동의_문자":             "V",

    # ⑫ 그 밖의 신청사항
    "확정일자_여":               "V",   # 확정일자 [여] 체크
    "공동사업자_부":             "V",   # 공동사업자 [부] 체크
    "송달장소_부":               "V",   # 송달장소 [부] 체크
    "현금영수증_여":             "V",   # 현금영수증 [여] 체크

    # ⑬ 서명란
    "신청_년":                   "2026",
    "신청_월":                   "04",
    "신청_일":                   "14",
    "신청인_성명":               "홍길동",
}

config = DOC_CONFIG["business-registration"]
pdf_path = FORMS_DIR / config["pdf"]
pdf_bytes = _fill_pdf(pdf_path, config["coords"], sample, config.get("max_pages"))

out = Path("scripts/test_output/test_biz_reg.pdf")
out.write_bytes(pdf_bytes)
print(f"OK → {out} ({len(pdf_bytes):,} bytes)")

# PNG 변환
doc = fitz.open(str(out))
for i in range(doc.page_count):
    pix = doc[i].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    png = Path(f"scripts/calibrate/biz_reg_p{i+1}.png")
    pix.save(str(png))
    print(f"PNG p{i+1} → {png}")

# 체크박스 구역 클립 (2× 확대, 하단부 y=500~760)
page = doc[0]
clip = fitz.Rect(50, 500, 550, 760)
mat = fitz.Matrix(3, 3)
pix2 = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
pix2.save("scripts/calibrate/biz_reg_checkboxes.png")
print("PNG checkboxes → scripts/calibrate/biz_reg_checkboxes.png")

doc.close()
