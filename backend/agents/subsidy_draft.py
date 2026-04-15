"""
지원사업 신청서 초안 에이전트

HWP 원문 텍스트(또는 공고 description)를 바탕으로:
  1. 작성해야 할 항목을 카드 목록으로 구조화 (Claude)
  2. 창업자 프로파일 기반으로 각 카드 pre-fill (Claude)

첨부파일이 없는 공고는 빈 카드 목록 반환 → 프론트에서 직접 질문 추가.
"""
import json
import logging
import re
from typing import Optional

import anthropic

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER

logger = logging.getLogger(__name__)


# ── 카드 타입 정의 ──────────────────────────────────────────────
#
# {
#   "id": str,
#   "section": str,          # 섹션/그룹명 (e.g. "신청자 정보")
#   "field_name": str,       # 항목명 (e.g. "대표자 성명")
#   "description": str,      # 작성 안내 (짧게)
#   "required": bool,
#   "type": "text" | "textarea" | "date" | "number",
#   "value": str,            # LLM pre-fill 값 (없으면 "")
# }


# 프로파일 필드 → 카드 field_name 키워드 매핑
_PROFILE_FIELD_KEYWORDS: dict[str, list[str]] = {
    "owner_name":      ["대표자", "성명", "대표자명", "신청자명", "신청인"],
    "business_name":   ["상호명", "업체명", "사업체명", "사업장명"],
    "business_number": ["사업자등록번호", "사업자번호"],
    "address":         ["사업장 주소", "사업장주소", "주소", "소재지"],
    "phone":           ["전화번호", "연락처", "휴대폰"],
    "email":           ["이메일", "전자우편"],
    "tax_type":        ["과세유형", "과세형태"],
}


def apply_profile_prefill(cards: list, profile: Optional[dict]) -> list:
    """
    카드의 value 필드를 현재 프로파일 기준으로 갱신한다.

    캐시된 cards_json에는 과거 프로파일 값이 굳어 있을 수 있으므로,
    매 요청마다 이 함수를 통해 최신 프로파일로 덮어쓴다.
    매칭되지 않는 카드는 기존 value 유지.
    """
    if not profile:
        return cards
    result = []
    for card in cards:
        field = card.get("field_name", "")
        new_value = card.get("value", "")
        for key, keywords in _PROFILE_FIELD_KEYWORDS.items():
            val = profile.get(key)
            if val and any(kw in field for kw in keywords):
                new_value = str(val)
                break
        result.append({**card, "value": new_value})
    return result


_ONE_PASS_SYSTEM = """
당신은 한국 정부 지원사업 신청서 분석 전문가입니다.
신청서 원문과 창업자 정보를 받아, 창업자가 작성해야 할 항목을 추출하고 pre-fill합니다.

규칙:
- 기관이 채워놓는 항목(공고번호, 접수일 등)은 제외
- 창업자가 직접 기입해야 하는 란만 포함, 최대 20개
- 비슷한 항목은 하나의 section으로 묶기
- type: 짧은 답변=text, 장문=textarea, 날짜=date, 금액/숫자=number
- value: 창업자 정보에서 알 수 있으면 채우고, 모르면 ""
- 반드시 JSON 배열만 반환 (다른 텍스트 없이)

출력 형식:
[
  {
    "id": "c1",
    "section": "섹션명",
    "field_name": "항목명",
    "description": "작성 안내 (1줄)",
    "required": true,
    "type": "text",
    "value": "pre-fill 값 또는 빈 문자열"
  }
]
"""


async def build_draft_cards(
    program: dict,
    hwp_text: str,
    founder_profile: Optional[dict],
    cached_cards: Optional[list] = None,
) -> dict:
    """
    신청서 초안 카드 목록을 생성한다.

    Args:
        program: subsidy_programs 행 (title, description, organization 등)
        hwp_text: HWP에서 추출한 원문 텍스트 (없으면 "")
        founder_profile: founder_business_info + founder_state 조합 dict

    Returns:
        {
          "has_attachment": bool,
          "cards": [...],
          "disclaimer": str,
        }
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    has_attachment = bool(hwp_text and hwp_text.strip()) or bool(cached_cards)

    if not has_attachment:
        return {
            "has_attachment": False,
            "cards": [],
            "disclaimer": LEGAL_DISCLAIMER,
        }

    # ── 캐시된 카드 구조가 있으면 Claude 호출 스킵 ────────────
    if cached_cards:
        # value 필드만 비워서 반환 (프로파일 pre-fill 없이 빠르게)
        cards = [{**c, "value": c.get("value", "")} for c in cached_cards]
        return {
            "has_attachment": True,
            "cards": cards,
            "disclaimer": LEGAL_DISCLAIMER,
        }

    # ── 단일 호출: 카드 구조화 + pre-fill ────────────────────
    clean_hwp = _sanitize_hwp_text(hwp_text)
    profile_text = _format_profile(founder_profile)
    prompt = (
        f"[공고 제목]\n{program.get('title', '')}\n"
        f"[주관기관]\n{program.get('organization', '')}\n"
        f"[지원 대상]\n{program.get('target', '') or '명시 없음'}\n\n"
        f"[창업자 정보]\n{profile_text}\n\n"
        f"[신청서 원문]\n{clean_hwp[:4000]}"
    )

    resp = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=_ONE_PASS_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    cards = _parse_json(resp.content[0].text)
    if not cards:
        logger.warning("[draft] haiku parse failed — fallback to description")
        cards = await _fallback_cards_from_description(client, program, founder_profile)
    if not cards:
        return {
            "has_attachment": True,
            "cards": [],
            "disclaimer": LEGAL_DISCLAIMER,
        }

    return {
        "has_attachment": True,
        "cards": cards,
        "disclaimer": LEGAL_DISCLAIMER,
    }


async def _fallback_cards_from_description(
    client: anthropic.AsyncAnthropic,
    program: dict,
    founder_profile: Optional[dict] = None,
) -> list:
    """HWP 파싱 실패 시 공고 description으로 카드 구조화."""
    description = (program.get("description") or "")[:2000]
    if not description:
        return []
    profile_text = _format_profile(founder_profile)
    prompt = (
        f"[공고 제목]\n{program.get('title', '')}\n"
        f"[주관기관]\n{program.get('organization', '')}\n\n"
        f"[창업자 정보]\n{profile_text}\n\n"
        f"[공고 내용]\n{description}"
    )
    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=_ONE_PASS_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_json(resp.content[0].text)
    except Exception as e:
        logger.error(f"[draft] fallback failed: {e}")
        return []


def _sanitize_hwp_text(text: str) -> str:
    """HWP 추출 텍스트에서 제어문자·NUL 등 Claude에게 불필요한 문자 제거."""
    # NUL 및 저수위 제어문자 제거 (탭·줄바꿈 제외)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # 3줄 이상 연속 빈줄 압축
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _parse_json(text: str) -> list:
    """LLM 응답에서 JSON 배열 추출. 잘린 JSON도 완성된 객체만 복구."""
    text = text.strip()
    # 코드블록 제거
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Strategy 1: 전체 파싱 시도
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Strategy 2: [ ... ] 블록 탐색
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            result = json.loads(match.group())
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Strategy 3: 잘린 JSON에서 완성된 객체만 복구 (flat 구조 한정)
    cards: list[dict] = []
    for m in re.finditer(r'\{[^{}]+\}', text, re.DOTALL):
        try:
            obj = json.loads(m.group())
            if isinstance(obj, dict) and "id" in obj and "field_name" in obj:
                cards.append(obj)
        except json.JSONDecodeError:
            pass
    if cards:
        logger.warning(f"[parse_json] partial recovery: {len(cards)} cards from truncated JSON")
        return cards

    return []


def _format_profile(profile: Optional[dict]) -> str:
    if not profile:
        return "업종: 카페, 지역: 서울 마포구"
    lines = []
    if profile.get("owner_name"):
        lines.append(f"대표자: {profile['owner_name']}")
    if profile.get("business_name"):
        lines.append(f"상호명: {profile['business_name']}")
    if profile.get("business_number"):
        lines.append(f"사업자등록번호: {profile['business_number']}")
    if profile.get("business_type"):
        lines.append(f"업종: {profile['business_type']}")
    if profile.get("tax_type"):
        lines.append(f"과세유형: {profile['tax_type']}")
    if profile.get("address"):
        lines.append(f"사업장 주소: {profile['address']}")
    if profile.get("stage"):
        lines.append(f"창업 단계: {profile['stage']}")
    return "\n".join(lines) if lines else "업종: 카페, 지역: 서울 마포구"
