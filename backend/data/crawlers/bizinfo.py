"""
기업마당 공공 API 크롤러 (https://www.bizinfo.go.kr)

2026-04 확인 사항:
  - 인증 키 파라미터: `crtfcKey`
  - 응답 루트: `jsonArray`
  - 페이징 파라미터 무시됨 → `searchCnt` 하나로 전량 취득
  - 기간 필드: `reqstBeginEndDe` 단일 문자열
      "2026-04-06 ~ 2026-04-27"  |  "2020.01.01 ~ 2026.12.31"
      "예산 소진시까지" | "추후 공지" | "차수별 상이" 등
  - 마감된 공고는 API 가 드랍 → 현재 스냅샷만 확보 가능

필터 스코프 (v0.5):
  - 대분류 `pldirSportRealmLclasCodeNm == '창업'`
  - 지역: 서울 / 마포 / 전국성 기관, 또는 지역표시 없음
  - 타 광역/기초자치단체 명시된 공고 제외

사용 전 robots.txt 및 이용약관 확인 완료.
"""
import re
from datetime import date
from typing import Optional
from urllib.parse import urlparse

import httpx

from backend.core.config import get_settings

_BASE_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"

_STARTUP_CATEGORY = "창업"

_NATIONAL_MARKERS = (
    "전국", "중소벤처기업부", "중기부", "소진공", "소상공인시장진흥공단",
    "창업진흥원", "기술보증", "신용보증", "중소기업", "TIPS",
)
_SEOUL_MARKERS = ("서울", "마포", "SBA", "서울창업", "서울경제진흥원")

_OTHER_REGION_KEYWORDS = (
    # 광역 약칭
    "부산", "대구", "인천", "광주", "대전", "울산", "경기", "강원",
    "충북", "충남", "전북", "전남", "경북", "경남", "제주", "세종",
    # 광역 풀네임 (주관기관에 자주 등장)
    "경상북도", "경상남도", "전라북도", "전라남도", "충청북도", "충청남도",
    "강원도", "경기도", "제주특별자치도", "세종특별자치시",
    "부산광역시", "대구광역시", "인천광역시", "광주광역시",
    "대전광역시", "울산광역시",
    # 주요 기초자치
    "수원", "안양", "성남", "용인", "고양", "화성", "부천", "남양주",
    "안산", "평택", "파주", "김포", "광명", "시흥", "하남", "의정부",
    "구리", "양주", "포천", "춘천", "원주", "강릉", "속초", "청주",
    "천안", "아산", "당진", "전주", "군산", "익산", "정읍", "목포",
    "여수", "순천", "나주", "포항", "경주", "안동", "구미", "영주",
    "김천", "상주", "창원", "김해", "진주", "거제", "통영", "양산",
)

_DATE_RE = re.compile(r"(\d{4})[-.](\d{1,2})[-.](\d{1,2})")
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


async def fetch_snapshot(search_count: int = 2000) -> list[dict]:
    """기업마당 현재 활성 공고 전량 원본 조회."""
    settings = get_settings()
    params = {
        "crtfcKey": settings.bizinfo_api_key,
        "dataType": "json",
        "searchCnt": search_count,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
    return data.get("jsonArray", []) or []


async def fetch_startup_programs() -> list[dict]:
    """
    필터: 대분류 == '창업' (약 90여 건).
    지역 필터는 제거 — 타지역 공고도 참고용으로 모두 수집.
    """
    raw = await fetch_snapshot()
    filtered = [
        it for it in raw
        if it.get("pldirSportRealmLclasCodeNm") == _STARTUP_CATEGORY
    ]
    parsed = [_parse_program_detail(it) for it in filtered]
    return [p for p in parsed if p.get("external_id")]


# ------------------------------------------------------------
# 레거시 호환
# ------------------------------------------------------------

async def fetch_programs(
    business_type=None,
    region: str = "마포구",
    page: int = 1,
    per_page: int = 20,
) -> list[dict]:
    """기존 시그니처 유지. 창업 스코프 공고만 반환 (페이지 절단)."""
    items = await fetch_startup_programs()
    start = (page - 1) * per_page
    return [
        {
            "id": p["external_id"],
            "title": p["title"],
            "organization": p.get("organization") or "",
            "deadline": p.get("end_date") or p.get("period_raw") or "",
            "url": p.get("detail_url") or "",
            "score": 0.0,
        }
        for p in items[start : start + per_page]
    ]


# ------------------------------------------------------------
# 필터 / 파싱
# ------------------------------------------------------------

def _matches_startup_scope(item: dict) -> bool:
    if item.get("pldirSportRealmLclasCodeNm") != _STARTUP_CATEGORY:
        return False
    return _is_seoul_or_nation(item)


def _is_seoul_or_nation(item: dict) -> bool:
    title = item.get("pblancNm") or ""
    hashtags = item.get("hashtags") or ""
    jurisdiction = item.get("jrsdInsttNm") or ""
    executor = item.get("excInsttNm") or ""

    # 1) 주관기관 기준 엄격 컷 — 타지역 시도가 주관이면 즉시 제외
    org_blob = f"{jurisdiction} {executor}"
    if any(m in org_blob for m in _SEOUL_MARKERS):
        return True
    if any(r in org_blob for r in _OTHER_REGION_KEYWORDS):
        return False

    # 2) 제목 기준 타지역 명시도 제외
    if any(r in title for r in _OTHER_REGION_KEYWORDS):
        return False

    # 3) 주관기관이 전국성 중앙기관이면 통과
    if any(m in org_blob for m in _NATIONAL_MARKERS):
        return True

    # 4) 제목/해시태그에 서울 마커가 있으면 통과
    extra_blob = f"{title} {hashtags}"
    if any(m in extra_blob for m in _SEOUL_MARKERS):
        return True

    # 5) 주관기관이 비어 있고 지역 명시 없으면 전국으로 간주
    return True


def _parse_program_detail(item: dict) -> dict:
    period_raw = (item.get("reqstBeginEndDe") or "").strip()
    start_dt, end_dt = _parse_period(period_raw)
    has_period = start_dt is not None and end_dt is not None
    is_ongoing = bool(period_raw) and not has_period
    title = (item.get("pblancNm") or "").strip()
    description = _strip_html(item.get("bsnsSumryCn") or "")

    return {
        "external_id": str(item.get("pblancId") or "").strip(),
        "title": title,
        "organization": (item.get("excInsttNm") or item.get("jrsdInsttNm") or "").strip() or None,
        "region": _infer_region(title, item),
        "program_kind": item.get("pldirSportRealmLclasCodeNm") or None,
        "sub_kind": item.get("pldirSportRealmMlsfcCodeNm") or None,
        "target": (item.get("trgetNm") or None),
        "start_date": start_dt.isoformat() if start_dt else None,
        "end_date": end_dt.isoformat() if end_dt else None,
        "period_raw": period_raw or None,
        "is_ongoing": is_ongoing,
        "description": description or None,
        "detail_url": item.get("pblancUrl") or None,
        "external_url": item.get("rceptEngnHmpgUrl") or None,
        "hashtags": item.get("hashtags") or None,
        "raw": item,
    }


def _parse_period(raw: str) -> tuple[Optional[date], Optional[date]]:
    if not raw:
        return (None, None)
    matches = _DATE_RE.findall(raw)
    if len(matches) < 2:
        return (None, None)
    try:
        start = date(int(matches[0][0]), int(matches[0][1]), int(matches[0][2]))
        end = date(int(matches[1][0]), int(matches[1][1]), int(matches[1][2]))
        if end < start:
            return (None, None)
        return (start, end)
    except ValueError:
        return (None, None)


def _strip_html(html: str) -> str:
    if not html:
        return ""
    text = _HTML_TAG_RE.sub(" ", html)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", '"')
    )
    return _WS_RE.sub(" ", text).strip()


def _infer_region(title: str, item: dict) -> Optional[str]:
    blob = " ".join(
        (title, item.get("jrsdInsttNm") or "", item.get("excInsttNm") or "")
    )
    if "마포" in blob:
        return "마포구"
    if any(m in blob for m in _SEOUL_MARKERS):
        return "서울"
    return "전국"


# ------------------------------------------------------------
# 첨부파일 스크래퍼 (신청서 초안 기능)
# ------------------------------------------------------------

_ATTACH_EXTS = (".hwp", ".pdf", ".docx", ".doc")

# 기업마당 다운로드 URL regex — BS4는 &fileSn=0 의 & 를 엔티티로 파싱해 href를 잘라버림
_RE_FILEDOWN = re.compile(r'href="(/cmm/fms/fileDown\.do\?[^"]+)"')
_RE_EXTSN = re.compile(r'data-extsn="([^"]+)"')
_RE_FILEBLANK = re.compile(
    r"fileBlank\('([^']+)'\s*\+\s*'/'\s*\+\s*'([^']+)'"
)


async def fetch_attachments(detail_url: str) -> list[dict]:
    """
    기업마당 공고 상세 페이지에서 첨부파일 목록을 수집한다.

    기업마당 HTML 구조 특이사항:
      - <a href="/cmm/fms/fileDown.do?atchFileId=...&fileSn=0"> 에서
        & 가 이스케이프 안 된 채로 있어 BS4가 href를 잘라버림
      - data-extsn="hwp" 속성으로 파일 타입 판별
      - fileBlank() onclick 에서 실제 파일명 추출

    Returns:
        [{"filename": str, "file_type": str, "download_url": str}, ...]
        첨부파일이 없거나 접근 실패 시 빈 리스트 반환.
    """
    if not detail_url:
        return []

    base = _base_origin(detail_url)
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(
                detail_url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; BOSS-crawler/1.0)"},
            )
            resp.raise_for_status()
            html = resp.text
    except Exception:
        return []

    # regex로 직접 추출 — 순서 보장 (HTML 등장 순)
    download_hrefs = _RE_FILEDOWN.findall(html)   # ["/cmm/fms/fileDown.do?...", ...]
    ext_values = _RE_EXTSN.findall(html)           # ["hwp", "pdf", ...]
    fileblank_matches = _RE_FILEBLANK.findall(html) # [("/webapp/.../2026/04", "파일명.hwp"), ...]

    results: list[dict] = []
    seen: set[str] = set()

    for i, href in enumerate(download_hrefs):
        file_type = ext_values[i] if i < len(ext_values) else "unknown"
        if file_type not in ("hwp", "pdf", "docx"):
            continue

        download_url = base + href

        if download_url in seen:
            continue
        seen.add(download_url)

        # 파일명: fileBlank 에서 추출 (같은 순서)
        if i < len(fileblank_matches):
            _, raw_fname = fileblank_matches[i]
            filename = raw_fname.strip()
        else:
            filename = f"신청서.{file_type}"

        results.append({"filename": filename, "file_type": file_type, "download_url": download_url})

    return results


async def download_attachment(download_url: str) -> Optional[bytes]:
    """첨부파일을 바이트로 다운로드. 실패 시 None 반환."""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(
                download_url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; BOSS-crawler/1.0)"},
            )
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


def _base_origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _ext_from_filename(filename: str) -> str:
    """파일명에서 확장자 추출."""
    lower = filename.lower()
    if lower.endswith(".hwp"):
        return "hwp"
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith(".docx") or lower.endswith(".doc"):
        return "docx"
    return "unknown"
