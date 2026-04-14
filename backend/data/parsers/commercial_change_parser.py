"""
서울 열린데이터광장 골목상권 상권변화지표 파서

대상: VwsmTrdarlxQq (상권변화지표) — API 500 오류로 파일 직접 다운로드 방식 사용

파일 다운로드:
  서울 열린데이터광장 (data.seoul.go.kr)
  검색: "서울시 우리마을가게 상권분석서비스 상권변화지표"
  파일 저장 위치: backend/data/seeds/commercial_change/

지원 파일 형식 (자동 감지):
  - .xls  : Office 2003 SpreadsheetML XML (서울 열린데이터광장 기본 제공 형식)
  - .csv  : 한국어 컬럼명 또는 영어(API) 필드명 CSV
  - .xml  : 서울 열린데이터광장 XML 응답 형식

상권변화지표 코드:
  HH: 지속성장 (매출 높음 + 점포수 증가)
  HL: 성장둔화 (매출 높음 + 점포수 감소)
  LH: 잠재성장 (매출 낮음 + 점포수 증가)
  LL: 침체    (매출 낮음 + 점포수 감소)
"""
import csv
import xml.etree.ElementTree as ET
from pathlib import Path


# 마포구 상권 키워드 필터
_MAPO_KEYWORDS = ["홍대", "합정", "연남", "망원", "공덕", "성산", "마포", "아현", "신수"]

# 상권변화지표 코드 → 한국어 설명 (서울 열린데이터광장 실제 명칭 기준)
CHANGE_CODE_LABELS = {
    "HH": "정체 (매출 높음 + 점포수 증가)",
    "HL": "상권축소 (매출 높음 + 점포수 감소)",
    "LH": "상권확장 (매출 낮음 + 점포수 증가)",
    "LL": "다이나믹 (매출 낮음 + 점포수 감소)",
}

# 한국어 컬럼명 → 내부 키 매핑
# 실제 CSV 컬럼명: "상권_변화_지표" (코드값 HH/HL/LH/LL)
#                  "상권_변화_지표_명" (한글 설명)
_KO_COLUMN_MAP = {
    "기준_년분기_코드":  "quarter",
    "기준_년_코드":      "year",
    "기준_분기_코드":    "quarter_num",
    "상권_구분_코드":    "area_type_cd",
    "상권_구분_코드_명": "area_type_nm",
    "상권_코드":         "area_cd",
    "상권_코드_명":      "area_nm",
    "상권_변화_지표":    "change_code",   # 실제 컬럼명 (코드값: HH/HL/LH/LL)
    "상권_변화_지표_명": "change_nm",
    "운영_영업_개월_평균": "opbiz_mon_avg",
}

# 영어 필드명 → 내부 키 매핑 (API 형식)
_EN_COLUMN_MAP = {
    "STDR_YYQU_CD":      "quarter",
    "STDR_YY_CD":        "year",
    "STDR_QU_CD":        "quarter_num",
    "TRDAR_SE_CD":       "area_type_cd",
    "TRDAR_SE_CD_NM":    "area_type_nm",
    "TRDAR_CD":          "area_cd",
    "TRDAR_CD_NM":       "area_nm",
    "TRDAR_XCNTU_CD":    "change_code",
    "TRDAR_XCNTU_CD_NM": "change_nm",
    "OPBIZ_MON_AVG":     "opbiz_mon_avg",
}

# Office 2003 SpreadsheetML 네임스페이스
_SS_NS = "urn:schemas-microsoft-com:office:spreadsheet"


def _detect_column_map(headers: list[str]) -> dict[str, str]:
    ko_hits = sum(1 for h in headers if h in _KO_COLUMN_MAP)
    en_hits = sum(1 for h in headers if h in _EN_COLUMN_MAP)
    return _KO_COLUMN_MAP if ko_hits >= en_hits else _EN_COLUMN_MAP


def _normalize_row(raw: dict, col_map: dict[str, str]) -> dict:
    result = {}
    for col, key in col_map.items():
        val = str(raw.get(col, "")).strip()
        if val:
            result[key] = val
    return result


def _is_mapo(row: dict) -> bool:
    return any(kw in row.get("area_nm", "") for kw in _MAPO_KEYWORDS)


def _build_quarter(row: dict) -> str:
    if "quarter" in row:
        # 숫자로 저장된 경우 (예: 20231.0) → 정수 문자열로 변환
        q = row["quarter"].split(".")[0].replace(" ", "")
        return q
    year = row.get("year", "").split(".")[0]
    qnum = row.get("quarter_num", "").split(".")[0]
    return f"{year}{qnum}" if year and qnum else ""


# ── XLS (Office 2003 SpreadsheetML XML) 파서 ─────────────────────────────────

def _parse_spreadsheetml(path: Path) -> list[dict]:
    """
    서울 열린데이터광장이 제공하는 .xls 파일은 실제로
    Office 2003 SpreadsheetML XML 형식입니다.

    구조:
      <Workbook>
        <Worksheet>
          <Table>
            <Row> ← 헤더
              <Cell><Data>컬럼명</Data></Cell>
            <Row> ← 데이터
              <Cell><Data>값</Data></Cell>
    """
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            tree = ET.parse(path)
            root = tree.getroot()
            break
        except ET.ParseError:
            # 인코딩 문제로 파싱 실패 시 텍스트로 읽어서 재시도
            try:
                with open(path, encoding=encoding, errors="replace") as f:
                    content = f.read()
                root = ET.fromstring(content.encode("utf-8"))
                break
            except Exception:
                continue
    else:
        return []

    # 네임스페이스 처리 (있을 수도 없을 수도 있음)
    ns = {"ss": _SS_NS}

    # Worksheet → Table → Row 탐색 (네임스페이스 있는 경우)
    rows_el = root.findall(f".//{{{_SS_NS}}}Row")

    # 네임스페이스 없는 단순 XML인 경우 폴백
    if not rows_el:
        rows_el = root.findall(".//Row")

    if not rows_el:
        return []

    # 첫 번째 Row를 헤더로 처리
    def _cell_text(cell_el) -> str:
        data = cell_el.find(f"{{{_SS_NS}}}Data")
        if data is None:
            data = cell_el.find("Data")
        return (data.text or "").strip() if data is not None else ""

    header_row = rows_el[0]
    headers = [_cell_text(c) for c in header_row]
    col_map = _detect_column_map(headers)

    results = []
    for row_el in rows_el[1:]:
        cells = [_cell_text(c) for c in row_el]
        # 셀 수가 헤더보다 적으면 빈 문자열로 패딩
        cells += [""] * (len(headers) - len(cells))
        raw = dict(zip(headers, cells))
        row = _normalize_row(raw, col_map)
        if not _is_mapo(row):
            continue
        row["quarter"] = _build_quarter(row)
        if row.get("change_code"):
            results.append(row)

    return results


# ── CSV 파서 ──────────────────────────────────────────────────────────────────

def _parse_csv(path: Path) -> list[dict]:
    results = []
    for encoding in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            with open(path, encoding=encoding, newline="") as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []
                col_map = _detect_column_map(headers)
                for raw in reader:
                    row = _normalize_row(raw, col_map)
                    if not _is_mapo(row):
                        continue
                    row["quarter"] = _build_quarter(row)
                    if row.get("change_code"):
                        results.append(row)
            return results
        except (UnicodeDecodeError, LookupError):
            continue
    return results


# ── 파일 형식 자동 감지 ───────────────────────────────────────────────────────

def parse_file(path: str | Path) -> list[dict]:
    """
    파일 확장자 및 내용을 보고 파서를 자동 선택합니다.
    .xls / .xml → SpreadsheetML XML 파서
    .csv        → CSV 파서
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {path}")

    suffix = path.suffix.lower()

    if suffix in (".xls", ".xml"):
        rows = _parse_spreadsheetml(path)
        # SpreadsheetML 파싱 실패 시 CSV로 폴백
        if not rows:
            rows = _parse_csv(path)
        return rows

    # .csv 또는 알 수 없는 확장자
    return _parse_csv(path)


# ── RAG 청크 변환 ─────────────────────────────────────────────────────────────

def rows_to_docs(rows: list[dict], source_filename: str) -> list[dict]:
    """파싱된 행 → RAG 텍스트 청크 (ingest_documents에 바로 전달 가능)"""
    docs = []
    source = f"서울 열린데이터광장 골목상권 상권변화지표 ({source_filename})"

    for i, row in enumerate(rows):
        area = row.get("area_nm", "")
        quarter = row.get("quarter", "")
        code = row.get("change_code", "")
        code_nm = row.get("change_nm", "") or CHANGE_CODE_LABELS.get(code, code)
        label = CHANGE_CODE_LABELS.get(code, code_nm)
        opbiz = row.get("opbiz_mon_avg", "")

        lines = [
            f"[마포구 상권변화지표] 상권: {area} | 기준분기: {quarter}",
            f"상권 변화 유형: {code} - {label}",
        ]
        if opbiz:
            lines.append(f"평균 운영 개월: {opbiz}개월")

        docs.append({
            "source": source,
            "chunk_index": i,
            "content": "\n".join(lines),
            "metadata": {
                "area": area,
                "quarter": quarter,
                "change_code": code,
                "data_type": "change_index",
            },
        })

    return docs


def load_all_from_dir(dir_path: str | Path) -> list[dict]:
    """
    디렉토리의 모든 지원 파일(.xls / .csv / .xml)을 파싱해 합산 반환.
    """
    dir_path = Path(dir_path)
    all_docs = []

    files = sorted(
        [f for f in dir_path.iterdir() if f.suffix.lower() in (".xls", ".csv", ".xml")]
    )

    if not files:
        print(f"[commercial_change] {dir_path} 에 파일 없음 (.xls/.csv/.xml)")
        return []

    for file in files:
        rows = parse_file(file)
        docs = rows_to_docs(rows, file.name)
        print(f"[commercial_change] {file.name} ({file.suffix}): {len(rows)}행 -> {len(docs)}청크 (마포구 필터 후)")
        all_docs.extend(docs)

    return all_docs
