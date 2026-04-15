"""
VLM OCR API — Claude Vision 기반 이미지 → 구조화 데이터 추출
- POST /ocr/receipt    : 영수증 → 메뉴별 항목 추출 + 등록된 메뉴 자동 매칭
- POST /ocr/menu       : 메뉴판 사진 → 메뉴 목록 추출
- POST /ocr/sales-file : POS CSV/Excel → 컬럼 AI 분석 → 매출 행 파싱
"""
import base64
import json
import re
import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.core.config import get_settings
from backend.api.dependencies import get_current_user_id
from backend.db.client import get_supabase

router = APIRouter()

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 5

_RECEIPT_PROMPT = """이 이미지는 카페 매출 영수증 또는 정산 전표입니다.
다음 JSON 형식으로 추출해주세요:

{
  "date": "YYYY-MM-DD",
  "time_slot": "09:00-11:30|11:30-14:00|14:00-16:30|16:30-19:00|19:00-21:30",
  "items": [
    {
      "name": "메뉴명",
      "quantity": 정수,
      "unit_price": 정수,
      "amount": 정수
    }
  ],
  "total": 정수
}

규칙:
- items: 영수증에 나온 각 메뉴별로 1행씩
- 수량(quantity)이 명시되지 않으면 1로 처리
- unit_price × quantity = amount 가 되도록 계산
- 거래 시각 기준: 9-11:30→"09:00-11:30", 11:30-14:00→"11:30-14:00", 14:00-16:30→"14:00-16:30", 16:30-19:00→"16:30-19:00", 19:00-21:30→"19:00-21:30"
- 날짜·시각 불명확하면 date=null, time_slot="09:00-11:30"
- 숫자는 쉼표·원화기호 없이 정수만
- 추출 불가 항목은 null (추측·날조 금지)
- JSON 외 텍스트 없이 JSON만 반환"""

_MENU_PROMPT = """이 이미지는 카페 메뉴판입니다.
메뉴 항목을 아래 JSON 형식으로 추출해주세요:

{
  "items": [
    {
      "name": "메뉴명",
      "category": "음료|디저트|기타",
      "price": 정수 또는 null
    }
  ]
}

규칙:
- 가격은 숫자(원 단위 정수)만. 불명확하면 null
- 메뉴명은 이미지에 표기된 그대로 (번역·변형 금지)
- 중복 항목 제외
- JSON 외 다른 텍스트 없이 JSON만 반환"""


def _detect_media_type(data: bytes) -> str:
    """매직 바이트로 실제 이미지 포맷 감지"""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "image/jpeg"


def _encode_image(data: bytes, content_type: str) -> tuple[str, str]:
    media_type = _detect_media_type(data)
    return base64.standard_b64encode(data).decode("utf-8"), media_type


def _extract_json(text: str) -> dict:
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    raw = m.group(1) if m else text
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail="이미지에서 데이터를 추출하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요."
        )


async def _call_vision(image_b64: str, media_type: str, prompt: str) -> dict:
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return _extract_json(message.content[0].text)


def _normalize(s: str) -> str:
    """공백·특수공백 제거 + 소문자 변환 (카페라떼 == 카페 라떼)"""
    return s.strip().lower().replace(" ", "").replace("\u00a0", "").replace("\u3000", "")


def _match_menu(menu_name: str, menus: list[dict]) -> dict | None:
    """메뉴명 매칭 (공백 무시 완전일치 → 공백 무시 부분일치)"""
    norm = _normalize(menu_name)
    for m in menus:
        if _normalize(m["name"]) == norm:
            return m
    for m in menus:
        mn = _normalize(m["name"])
        if norm in mn or mn in norm:
            return m
    return None


class ReceiptItem(BaseModel):
    name: str
    quantity: int
    unit_price: int
    amount: int
    menu_id: str | None = None
    matched_name: str | None = None
    is_matched: bool = False
    category: str = "기타"


class ReceiptResult(BaseModel):
    date: str | None
    time_slot: str
    items: list[ReceiptItem]
    total: int | None


class MenuResult(BaseModel):
    items: list[dict]


@router.post("/receipt", response_model=ReceiptResult)
async def ocr_receipt(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """영수증 사진 → 메뉴별 항목 추출 + 등록된 메뉴 자동 매칭"""
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="JPG, PNG, WEBP, GIF 형식만 지원합니다.")

    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"파일 크기는 {MAX_SIZE_MB}MB 이하여야 합니다.")

    b64, media_type = _encode_image(data, file.content_type)
    result = await _call_vision(b64, media_type, _RECEIPT_PROMPT)

    # 등록된 메뉴 목록 로드 (매칭용)
    supabase = get_supabase()
    menus = (
        supabase.table("menus")
        .select("id, name, category, price")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data or []
    )

    valid_slots = {"09:00-11:30","11:30-14:00","14:00-16:30","16:30-19:00","19:00-21:30"}
    time_slot = result.get("time_slot", "09:00-11:30")
    if time_slot not in valid_slots:
        time_slot = "09:00-11:30"

    items: list[ReceiptItem] = []
    for raw in (result.get("items") or []):
        name = str(raw.get("name") or "").strip()
        if not name:
            continue
        qty = int(raw.get("quantity") or 1)
        unit_price = int(raw.get("unit_price") or 0)
        amount = int(raw.get("amount") or unit_price * qty)

        matched = _match_menu(name, menus)
        items.append(ReceiptItem(
            name=name,
            quantity=qty,
            unit_price=unit_price,
            amount=amount,
            menu_id=matched["id"] if matched else None,
            matched_name=matched["name"] if matched else None,
            is_matched=matched is not None,
            category=matched["category"] if matched else "기타",
        ))

    return ReceiptResult(
        date=result.get("date"),
        time_slot=time_slot,
        items=items,
        total=result.get("total"),
    )


@router.post("/menu", response_model=MenuResult)
async def ocr_menu(file: UploadFile = File(...)):
    """메뉴판 사진 → 메뉴 목록 추출"""
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="JPG, PNG, WEBP, GIF 형식만 지원합니다.")

    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"파일 크기는 {MAX_SIZE_MB}MB 이하여야 합니다.")

    b64, media_type = _encode_image(data, file.content_type)
    result = await _call_vision(b64, media_type, _MENU_PROMPT)

    items = result.get("items", [])
    valid_items = [i for i in items if isinstance(i, dict) and i.get("name")]
    return MenuResult(items=valid_items)


# ──────────────────────────────────────────────
# POS CSV / Excel 매출 파일 가져오기
# ──────────────────────────────────────────────

ALLOWED_FILE_MIME = {
    "text/csv", "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_FILE_MB = 10
MAX_ROWS = 2000  # 한 번에 처리할 최대 행 수

_COLUMN_MAP_PROMPT = """다음은 카페 POS 매출 데이터 파일의 헤더와 샘플 데이터입니다.

헤더 컬럼: {headers}

샘플 데이터 (최대 3행):
{sample}

다음 필드에 해당하는 컬럼명을 JSON으로 반환하세요.
반드시 헤더에 실제로 존재하는 컬럼명만 사용하고, 없으면 null.

{{
  "date": "날짜/일자/거래일/거래일시 등 날짜 컬럼명 또는 null",
  "time": "시간/거래시간/시각 등 시간 컬럼명 또는 null",
  "menu_name": "메뉴명/품목명/상품명/아이템명 등 메뉴 컬럼명 (필수)",
  "quantity": "수량/판매수량/개수 등 수량 컬럼명 또는 null",
  "unit_price": "단가/단위금액/개당가격 등 단가 컬럼명 또는 null",
  "amount": "금액/매출액/결제금액/판매금액/합계 등 금액 컬럼명 (필수)",
  "category": "카테고리/분류/종류 등 카테고리 컬럼명 또는 null"
}}

JSON만 반환. 다른 텍스트 없이."""


def _parse_int_safe(v) -> int:
    """쉼표·원화기호·공백 제거 후 정수 변환. 실패 시 0."""
    if v is None:
        return 0
    s = str(v).replace(",", "").replace("원", "").replace("₩", "").replace(" ", "").strip()
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return 0


def _parse_date_safe(v) -> str | None:
    """다양한 날짜 포맷 → YYYY-MM-DD. 실패 시 None."""
    if v is None:
        return None
    import pandas as pd
    s = str(v).strip()
    # 숫자만 8자리 (20240115 형태)
    if re.match(r"^\d{8}$", s):
        s = f"{s[:4]}-{s[4:6]}-{s[6:]}"
    # 한국어 날짜 (2024년 1월 15일)
    m = re.match(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", s)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return None


def _parse_timeslot(v) -> str:
    """시간 문자열 → time_slot. 실패 시 09:00-11:30."""
    default = "09:00-11:30"
    if v is None:
        return default
    s = str(v).strip()
    m = re.search(r"(\d{1,2})[:\s](\d{2})", s)
    if not m:
        return default
    hour = int(m.group(1))
    minute = int(m.group(2))
    total = hour * 60 + minute
    if total < 11 * 60 + 30:
        return "09:00-11:30"
    if total < 14 * 60:
        return "11:30-14:00"
    if total < 16 * 60 + 30:
        return "14:00-16:30"
    if total < 19 * 60:
        return "16:30-19:00"
    return "19:00-21:30"


def _read_file_to_df(data: bytes, filename: str):
    """CSV/Excel 바이트 → pandas DataFrame. 인코딩 자동 감지."""
    import pandas as pd
    import io

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext in ("xlsx", "xls"):
        return pd.read_excel(io.BytesIO(data), dtype=str, engine="openpyxl" if ext == "xlsx" else None)

    # CSV — 인코딩 순서대로 시도
    for enc in ("utf-8-sig", "utf-8", "euc-kr", "cp949", "latin-1"):
        try:
            return pd.read_csv(io.BytesIO(data), dtype=str, encoding=enc)
        except (UnicodeDecodeError, Exception):
            continue
    raise HTTPException(status_code=422, detail="파일 인코딩을 인식할 수 없습니다. UTF-8 또는 EUC-KR로 저장 후 다시 시도해주세요.")


async def _detect_column_mapping(headers: list[str], sample_rows: list[dict]) -> dict:
    """Claude에게 헤더+샘플을 보여주고 컬럼 매핑 반환."""
    settings = get_settings()
    sample_text = "\n".join(
        str({k: row.get(k, "") for k in headers}) for row in sample_rows[:3]
    )
    prompt = _COLUMN_MAP_PROMPT.format(
        headers=", ".join(headers),
        sample=sample_text,
    )
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", raw)
    text = m.group(1) if m else raw
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="컬럼 분석에 실패했습니다. 파일 헤더가 있는지 확인해주세요.")


@router.post("/sales-file")
async def import_sales_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    POS CSV / Excel 매출 파일 → 컬럼 AI 자동 분석 → 파싱된 매출 행 반환
    - 카페마다 다른 컬럼 구조를 Claude가 자동 매핑
    - 반환된 rows를 프론트에서 확인 후 /sales-items/bulk 로 저장
    """
    data = await file.read()
    if len(data) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"파일 크기는 {MAX_FILE_MB}MB 이하여야 합니다.")

    try:
        df = _read_file_to_df(data, file.filename or "upload.csv")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"파일을 읽을 수 없습니다: {e}")

    # 빈 행/컬럼 제거
    df = df.dropna(how="all").reset_index(drop=True)
    df.columns = [str(c).strip() for c in df.columns]
    headers = list(df.columns)

    if not headers:
        raise HTTPException(status_code=422, detail="파일에 데이터가 없습니다.")

    total_rows = min(len(df), MAX_ROWS)
    df = df.head(MAX_ROWS)

    # Claude로 컬럼 매핑 분석
    sample_rows = df.head(3).to_dict("records")
    col_map = await _detect_column_mapping(headers, sample_rows)

    menu_col     = col_map.get("menu_name")
    amount_col   = col_map.get("amount")
    date_col     = col_map.get("date")
    time_col     = col_map.get("time")
    qty_col      = col_map.get("quantity")
    unit_col     = col_map.get("unit_price")
    category_col = col_map.get("category")

    if not menu_col or menu_col not in headers:
        raise HTTPException(status_code=422, detail="메뉴명 컬럼을 찾을 수 없습니다. 파일에 메뉴명 컬럼이 있는지 확인해주세요.")
    if not amount_col or amount_col not in headers:
        raise HTTPException(status_code=422, detail="금액 컬럼을 찾을 수 없습니다. 파일에 금액 컬럼이 있는지 확인해주세요.")

    # 등록된 메뉴 로드 (카테고리 매핑용)
    supabase = get_supabase()
    menus = (
        supabase.table("menus")
        .select("id, name, category")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data or []
    )

    # 날짜 기본값 (오늘)
    from datetime import date as _date
    today_str = str(_date.today())

    rows = []
    skipped = 0
    for _, row in df.iterrows():
        menu_name = str(row.get(menu_col, "")).strip()
        if not menu_name or menu_name.lower() in ("nan", "none", ""):
            skipped += 1
            continue

        amount = _parse_int_safe(row.get(amount_col))
        if amount <= 0:
            skipped += 1
            continue

        qty = _parse_int_safe(row.get(qty_col)) if qty_col and qty_col in headers else 1
        if qty <= 0:
            qty = 1

        unit_price = _parse_int_safe(row.get(unit_col)) if unit_col and unit_col in headers else (amount // qty)

        date_str = _parse_date_safe(row.get(date_col)) if date_col and date_col in headers else today_str
        if not date_str:
            date_str = today_str

        time_slot = _parse_timeslot(row.get(time_col)) if time_col and time_col in headers else "09:00-11:30"

        # 카테고리: 파일 값 우선 → 등록된 메뉴에서 매핑 → 기본값
        raw_cat = str(row.get(category_col, "")).strip() if category_col and category_col in headers else ""
        matched = _match_menu(menu_name, menus)
        if raw_cat and raw_cat.lower() not in ("nan", "none", ""):
            category = raw_cat
        elif matched:
            category = matched["category"]
        else:
            category = "기타"

        rows.append({
            "date": date_str,
            "time_slot": time_slot,
            "menu_name": menu_name,
            "quantity": qty,
            "unit_price": unit_price,
            "amount": amount,
            "category": category,
            "menu_id": matched["id"] if matched else None,
        })

    if not rows:
        raise HTTPException(status_code=422, detail="유효한 매출 데이터를 찾을 수 없습니다. 메뉴명·금액 컬럼을 확인해주세요.")

    return {
        "total_rows": total_rows,
        "parsed_rows": len(rows),
        "skipped_rows": skipped,
        "columns_detected": col_map,
        "rows": rows,
    }
