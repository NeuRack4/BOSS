"""
테스트용 카페 영수증 이미지 생성 스크립트
docs/sample_receipts/ 에 8장 저장
"""
import random
from datetime import datetime, timedelta
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "sample_receipts"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FONT_REG  = "C:/Windows/Fonts/malgun.ttf"
FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"

MENU = [
    ("아이스 아메리카노", "음료",  4500),
    ("핫 아메리카노",     "음료",  4000),
    ("카페라떼",          "음료",  5000),
    ("아이스 카페라떼",   "음료",  5500),
    ("바닐라라떼",        "음료",  5500),
    ("카푸치노",          "음료",  5000),
    ("초코라떼",          "음료",  5500),
    ("크루아상",          "디저트",3500),
    ("치즈케이크",        "디저트",6000),
    ("스콘",              "디저트",3000),
]

PAY_METHODS = ["신용카드", "체크카드", "카카오페이", "네이버페이", "현금"]
TIME_RANGES = [
    ("오전", (9, 11)),
    ("오전", (10, 12)),
    ("오후", (13, 15)),
    ("오후", (14, 17)),
    ("저녁", (17, 20)),
]

W = 380

def make_font(path, size):
    return ImageFont.truetype(path, size)

def draw_receipt(items, pay, dt, slot_label, receipt_no):
    """
    items: [(name, qty, unit_price), ...]
    """
    f10 = make_font(FONT_REG,  18)
    f11 = make_font(FONT_REG,  20)
    f12 = make_font(FONT_REG,  22)
    fb14 = make_font(FONT_BOLD, 26)
    fb12 = make_font(FONT_BOLD, 22)

    # 높이 계산
    line_h = 28
    header_h = 160
    item_h   = len(items) * (line_h + 4)
    footer_h = 220
    H = header_h + item_h + footer_h

    img = Image.new("RGB", (W, H), "#ffffff")
    d   = ImageDraw.Draw(img)

    def hr(y, color="#bbbbbb"):
        d.line([(20, y), (W-20, y)], fill=color, width=1)

    def dhr(y):
        """점선"""
        for x in range(20, W-20, 8):
            d.line([(x, y), (x+4, y)], fill="#cccccc", width=1)

    y = 16

    # ── 헤더 ──────────────────────────────────
    d.text((W//2, y), "홍대 우리카페", font=fb14, fill="#111111", anchor="mt")
    y += 34
    d.text((W//2, y), "서울 마포구 홍대입구로 12", font=f10, fill="#777777", anchor="mt")
    y += 24
    d.text((W//2, y), "TEL: 02-1234-5678", font=f10, fill="#777777", anchor="mt")
    y += 28
    hr(y)
    y += 10

    date_str = dt.strftime("%Y-%m-%d  %H:%M")
    d.text((24, y), date_str, font=f10, fill="#555555")
    d.text((W-24, y), f"영수증 #{receipt_no:04d}", font=f10, fill="#555555", anchor="ra")
    y += 26

    dhr(y); y += 10

    # ── 항목 ──────────────────────────────────
    for name, qty, unit in items:
        d.text((24, y), name, font=f12, fill="#111111")
        right_text = f"{qty}  ×  {unit:,}"
        amt_text   = f"{qty*unit:,}원"
        d.text((W-24, y), amt_text,    font=fb12, fill="#111111", anchor="ra")
        y += line_h
        d.text((32, y), right_text, font=f10, fill="#888888")
        y += line_h - 4

    dhr(y); y += 14

    # ── 합계 ──────────────────────────────────
    subtotal = sum(q * u for _, q, u in items)
    vat      = round(subtotal / 11)
    total    = subtotal

    rows = [
        ("공급가액",  subtotal - vat, f11, "#444444"),
        ("부가세(10%)", vat,           f11, "#444444"),
        ("합  계",    total,          fb14, "#111111"),
    ]
    for label, val, font, color in rows:
        d.text((24,    y), label,          font=font,  fill=color)
        d.text((W-24,  y), f"{val:,}원",   font=font,  fill=color, anchor="ra")
        y += 34

    hr(y, "#dddddd"); y += 14

    # ── 결제 ──────────────────────────────────
    d.text((24, y),   "결제수단",  font=f11, fill="#555555")
    d.text((W-24, y), pay,        font=fb12, fill="#222222", anchor="ra")
    y += 32
    d.text((24, y),   "승인금액",  font=f11, fill="#555555")
    d.text((W-24, y), f"{total:,}원", font=fb12, fill="#222222", anchor="ra")
    y += 40

    dhr(y); y += 16

    # ── 푸터 ──────────────────────────────────
    d.text((W//2, y), "감사합니다 ☕", font=fb12, fill="#333333", anchor="mt")
    y += 28
    d.text((W//2, y), "영수증을 보관해 주세요", font=f10, fill="#aaaaaa", anchor="mt")

    return img


def random_receipt(idx):
    # 2~4개 메뉴 랜덤 선택
    n_items = random.randint(2, 4)
    chosen  = random.sample(MENU, n_items)
    items   = [(name, random.randint(1, 3), price) for name, _, price in chosen]

    pay = random.choice(PAY_METHODS)
    slot_label, (h_min, h_max) = random.choice(TIME_RANGES)

    base_date = datetime(2026, 4, 1)
    dt = base_date + timedelta(
        days=random.randint(0, 14),
        hours=random.randint(h_min, h_max),
        minutes=random.randint(0, 59),
    )
    receipt_no = 1000 + idx * 7 + random.randint(1, 6)

    img = draw_receipt(items, pay, dt, slot_label, receipt_no)
    path = OUTPUT_DIR / f"receipt_{idx+1:02d}.png"
    img.save(path, "PNG")
    total = sum(q * u for _, q, u in items)
    print(f"[{idx+1}] {path.name}  {dt.strftime('%m-%d %H:%M')}  {len(items)}개 메뉴  합계 {total:,}원")
    return path


if __name__ == "__main__":
    random.seed(42)
    for i in range(8):
        random_receipt(i)
    print(f"\n✓ {OUTPUT_DIR} 에 8장 저장 완료")
