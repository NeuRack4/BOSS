"""사업자등록 신청서 PDF 채우기 테스트"""
import sys, os
sys.path.insert(0, ".")
os.makedirs("scripts/test_output", exist_ok=True)
os.makedirs("scripts/calibrate", exist_ok=True)

from pathlib import Path
from backend.api.routers.pdf_forms import _fill_pdf, DOC_CONFIG
import fitz

FORMS_DIR = Path("frontend/public/forms")

sample = {
    "상호_단체명":              "성수 브루잉 카페",
    "사업장_전화번호":           "02-1234-5678",
    "성명_대표자":               "홍길동",
    "주소지_전화번호":           "010-9999-8888",
    "주민등록번호":              "900101-1234567",
    "휴대전화번호":              "010-1234-5678",
    "사업장_소재지":             "서울시 성동구 성수이로 7길 7",  # 층/호 제외
    "사업장_층":                 "2",
    "사업장_호":                 "",  # 없으면 빈칸
    "주업태":                   "음식점업",
    "주종목":                   "커피전문점",
    "주업종코드":               "562110",
    "개업일":                   "2026-05-01",
    "종업원수":                  "2",
    "자가면적_㎡":              "0",
    "타가면적_㎡":              "33",
    "임대인_성명":               "김임대",
    "임대인_사업자등록번호":     "123-45-67890",
    "임대차계약기간_시작":       "2025.04",   # 첫 줄 (시작 년월)
    "임대차계약기간_종료":       "2027.04",   # 둘째 줄 (종료 년월)
    "전세보증금":               "0",
    "월세_차임":                "1,500,000",
    "사업자금_자기자금":         "5,000,000",
    "사업자금_타인자금":         "20,000,000",
    "전자우편주소":              "hello@boss-ai.kr",
    # 서명란 (자동 주입되지만 테스트용으로 명시)
    "신청_년":                   "2026",
    "신청_월":                   "04",
    "신청_일":                   "13",
    "신청인_성명":               "홍길동",
    "대리인_성명":               "김희영",
}

config = DOC_CONFIG["business-registration"]
pdf_path = FORMS_DIR / config["pdf"]
pdf_bytes = _fill_pdf(pdf_path, config["coords"], sample, config.get("max_pages"))

out = Path("scripts/test_output/test_biz_reg.pdf")
out.write_bytes(pdf_bytes)
print(f"OK → {out} ({len(pdf_bytes):,} bytes)")

# PNG 변환 (1페이지만)
doc = fitz.open(str(out))
pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
png = Path("scripts/calibrate/biz_reg_p1.png")
pix.save(str(png))
doc.close()
print(f"PNG → {png}")
