from PIL import Image, ImageDraw, ImageFont
import os

FONT_REGULAR = "C:/Windows/Fonts/malgun.ttf"
FONT_BOLD    = "C:/Windows/Fonts/malgunbd.ttf"
OUT_DIR      = "C:/Users/804/Documents/BOSS/docs/sample_menus"

def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)

# ─────────────────────────────────────────────
# 1. 모던 미니멀 (흰 배경 + 검정)
# ─────────────────────────────────────────────
def menu1():
    W, H = 600, 900
    img = Image.new("RGB", (W, H), "#FAFAF8")
    d = ImageDraw.Draw(img)

    d.rectangle([(0,0),(W,90)], fill="#1A1A1A")
    d.text((W//2, 45), "BREW & CO.", font=font(32, bold=True), fill="#FFFFFF", anchor="mm")
    d.text((W//2, 115), "COFFEE", font=font(13), fill="#999999", anchor="mm")
    d.line([(50,132),(W-50,132)], fill="#DDDDDD", width=1)

    items = [
        ("에스프레소",        "3,500"),
        ("아메리카노",        "4,000"),
        ("카페 라떼",         "4,800"),
        ("카푸치노",          "5,000"),
        ("바닐라 라떼",       "5,500"),
        ("카라멜 마키아토",   "5,800"),
    ]
    y = 155
    for name, price in items:
        d.text((60, y), name, font=font(16), fill="#222222")
        d.text((W-60, y), price, font=font(16), fill="#555555", anchor="ra")
        d.line([(60, y+26),(W-60, y+26)], fill="#EEEEEE", width=1)
        y += 44

    d.text((W//2, y+20), "NON-COFFEE", font=font(13), fill="#999999", anchor="mm")
    d.line([(50, y+36),(W-50, y+36)], fill="#DDDDDD", width=1)
    y += 58
    for name, price in [("녹차 라떼","5,000"),("고구마 라떼","5,500"),("딸기 스무디","6,000"),("망고 스무디","6,000")]:
        d.text((60, y), name, font=font(16), fill="#222222")
        d.text((W-60, y), price, font=font(16), fill="#555555", anchor="ra")
        d.line([(60, y+26),(W-60, y+26)], fill="#EEEEEE", width=1)
        y += 44

    d.text((W//2, y+20), "DESSERT", font=font(13), fill="#999999", anchor="mm")
    d.line([(50, y+36),(W-50, y+36)], fill="#DDDDDD", width=1)
    y += 58
    for name, price in [("크루아상","3,500"),("치즈케이크","6,500"),("티라미수","7,000")]:
        d.text((60, y), name, font=font(16), fill="#222222")
        d.text((W-60, y), price, font=font(16), fill="#555555", anchor="ra")
        d.line([(60, y+26),(W-60, y+26)], fill="#EEEEEE", width=1)
        y += 44

    d.rectangle([(0,H-50),(W,H)], fill="#1A1A1A")
    d.text((W//2, H-25), "ICE +500  HOT 기본", font=font(12), fill="#888888", anchor="mm")
    img.save(f"{OUT_DIR}/menu1_modern_minimal.jpg", quality=95)
    print("menu1 done")

# ─────────────────────────────────────────────
# 2. 빈티지 크래프트 (크림색 + 갈색)
# ─────────────────────────────────────────────
def menu2():
    W, H = 620, 920
    BG = "#F5EDD8"; DARK = "#3B2A1A"; MID = "#7A5C3E"; LITE = "#C4A882"
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    d.rectangle([(12,12),(W-12,H-12)], outline=DARK, width=3)
    d.rectangle([(20,20),(W-20,H-20)], outline=LITE, width=1)
    d.text((W//2, 60), "Cafe Bonne", font=font(28, bold=True), fill=DARK, anchor="mm")
    d.text((W//2, 92), "Mapo-gu, Seoul", font=font(13), fill=MID, anchor="mm")
    d.line([(40,110),(W-40,110)], fill=LITE, width=2)

    sections = [
        ("드립 커피", [("오늘의 원두 싱글오리진","5,000"),("콜드브루","6,000"),("나이트로 콜드브루","7,000")]),
        ("에스프레소 베이스", [("에스프레소","3,500"),("아메리카노","4,500"),("플랫화이트","5,500"),("코르타도","5,000")]),
        ("시그니처 음료", [("흑임자 라떼","6,500"),("쑥 라떼","6,500"),("유자 에이드","6,000"),("복숭아 아이스티","5,500")]),
        ("베이커리", [("스콘","3,500"),("바나나 머핀","3,800"),("레몬 파운드","4,000")]),
    ]
    y = 130
    for sec_name, items in sections:
        d.text((W//2, y+18), f"[ {sec_name} ]", font=font(15, bold=True), fill=DARK, anchor="mm")
        y += 42
        for name, price in items:
            d.text((50, y), "·", font=font(14), fill=MID)
            d.text((68, y), name, font=font(15), fill=DARK)
            d.text((W-48, y), price, font=font(15), fill=MID, anchor="ra")
            y += 36
        d.line([(40, y+4),(W-40, y+4)], fill=LITE, width=1)
        y += 20

    d.text((W//2, H-35), "모든 메뉴 ICE / HOT 선택 가능", font=font(12), fill=MID, anchor="mm")
    img.save(f"{OUT_DIR}/menu2_vintage_craft.jpg", quality=95)
    print("menu2 done")

# ─────────────────────────────────────────────
# 3. 감성 파스텔 (핑크 + 민트)
# ─────────────────────────────────────────────
def menu3():
    W, H = 580, 860
    img = Image.new("RGB", (W, H), "#FFF5F8")
    d = ImageDraw.Draw(img)

    d.rectangle([(0,0),(W,100)], fill="#F7C5D5")
    d.text((W//2, 38), "Petite Cafe", font=font(26, bold=True), fill="#8B3A5A", anchor="mm")
    d.text((W//2, 72), "홍대입구 메뉴판", font=font(13), fill="#B5607A", anchor="mm")

    categories = [
        ("#F7C5D5","#8B3A5A","커피",[("아이스 아메리카노","4,000"),("아이스 카페라떼","5,000"),("돌체 라떼","5,500"),("아인슈패너","6,000")]),
        ("#D5E8F7","#2A5A8B","논커피 & 티",[("캐모마일 티","4,500"),("얼그레이 밀크티","5,500"),("딸기 라떼","6,000"),("블루베리 스무디","6,500")]),
        ("#D5F7E0","#2A6B3A","디저트",[("딸기 생크림 케이크","7,500"),("마카롱 2개","4,000"),("크림 브륄레","6,500")]),
    ]
    y = 118
    for bg, fg, title, items in categories:
        d.rectangle([(30, y),(W-30, y+32)], fill=bg)
        d.text((W//2, y+16), title, font=font(15, bold=True), fill=fg, anchor="mm")
        y += 44
        for name, price in items:
            d.text((55, y), name, font=font(15), fill="#333333")
            d.text((W-50, y), price, font=font(15), fill="#777777", anchor="ra")
            d.line([(55, y+24),(W-50, y+24)], fill="#EEEEEE", width=1)
            y += 40
        y += 16

    d.text((W//2, H-30), "포장 주문 가능  0507-xxxx-xxxx", font=font(11), fill="#AAAAAA", anchor="mm")
    img.save(f"{OUT_DIR}/menu3_pastel.jpg", quality=95)
    print("menu3 done")

# ─────────────────────────────────────────────
# 4. 다크 모던 (검정 + 골드)
# ─────────────────────────────────────────────
def menu4():
    W, H = 620, 900
    img = Image.new("RGB", (W, H), "#111111")
    d = ImageDraw.Draw(img)
    GOLD = "#C9A84C"; WHITE = "#EEEEEE"; GRAY = "#777777"

    d.rectangle([(20,20),(W-20,100)], fill="#1E1E1E")
    d.text((W//2, 60), "NOIR COFFEE", font=font(30, bold=True), fill=GOLD, anchor="mm")
    d.line([(40,108),(W-40,108)], fill=GOLD, width=1)

    sections = [
        ("ESPRESSO BASED", [("에스프레소","4,000"),("롱블랙","4,500"),("카페라떼","5,500"),("피콜로","5,000"),("마키아토","5,500")]),
        ("SIGNATURE", [("블랙 티라미수 라떼","7,000"),("숯불 아메리카노","5,500"),("스모키 바닐라 라떼","6,500")]),
        ("FOOD", [("크루아상 샌드위치","7,500"),("뉴욕 치즈케이크","7,000"),("가나슈 타르트","6,500")]),
    ]
    y = 128
    for sec, items in sections:
        d.text((50, y), sec, font=font(12, bold=True), fill=GOLD)
        d.line([(50, y+20),(W-50, y+20)], fill="#333333", width=1)
        y += 32
        for name, price in items:
            d.text((60, y), name, font=font(16), fill=WHITE)
            d.text((W-55, y), price, font=font(16), fill=GRAY, anchor="ra")
            y += 38
        y += 18

    d.line([(40, H-60),(W-40, H-60)], fill=GOLD, width=1)
    d.text((W//2, H-35), "서울 마포구 합정동  OPEN 08:00 ~ 22:00", font=font(12), fill=GRAY, anchor="mm")
    img.save(f"{OUT_DIR}/menu4_dark_gold.jpg", quality=95)
    print("menu4 done")

# ─────────────────────────────────────────────
# 5. 화이트보드 스타일
# ─────────────────────────────────────────────
def menu5():
    W, H = 580, 860
    img = Image.new("RGB", (W, H), "#FEFEFE")
    d = ImageDraw.Draw(img)
    CHALK = "#2A2A2A"; SUB = "#666666"; LINE = "#DDDDDD"

    d.rectangle([(0,0),(W,80)], fill="#F0F0F0")
    d.text((W//2, 40), "오늘의 메뉴판", font=font(26, bold=True), fill=CHALK, anchor="mm")
    d.line([(0,80),(W,80)], fill=LINE, width=2)

    all_items = [
        ("-- HOT --", None),
        ("아메리카노","4,000"),
        ("카페 라떼","4,800"),
        ("카페 모카","5,300"),
        ("화이트 초코 라떼","5,500"),
        ("-- ICED --", None),
        ("아이스 아메리카노","3,800"),
        ("아이스 카페라떼","4,500"),
        ("아이스 초코","5,000"),
        ("-- ADE & TEA --", None),
        ("레몬 에이드","5,500"),
        ("자몽 에이드","5,500"),
        ("제주 녹차","4,500"),
        ("-- DESSERT --", None),
        ("와플","5,000"),
        ("팬케이크","6,500"),
        ("아이스크림 1스쿱","3,000"),
    ]
    y = 100
    for name, price in all_items:
        if price is None:
            d.text((W//2, y+10), name, font=font(13, bold=True), fill=SUB, anchor="mm")
            y += 34
        else:
            d.text((55, y), name, font=font(15), fill=CHALK)
            d.text((W-52, y), price, font=font(15), fill=SUB, anchor="ra")
            d.line([(55, y+24),(W-52, y+24)], fill=LINE, width=1)
            y += 40

    d.rectangle([(0,H-45),(W,H)], fill="#F0F0F0")
    d.text((W//2, H-22), "매일 직접 구운 베이커리  당일 소진 시 품절", font=font(11), fill=SUB, anchor="mm")
    img.save(f"{OUT_DIR}/menu5_whiteboard.jpg", quality=95)
    print("menu5 done")


menu1()
menu2()
menu3()
menu4()
menu5()
print("모두 완료!")
