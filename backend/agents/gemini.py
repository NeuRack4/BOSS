"""
Gemini 2.0 Flash 기반 서류 초안 생성 에이전트

RAG 검색 → Gemini 2.0 Flash → 구조화된 초안 반환
무료 API 사용 (Google AI Studio 기준 1,500회/일)
"""
import google.generativeai as genai

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.rag.retriever.pgvector_retriever import retrieve

# 서류 유형별 설정
DOC_TYPE_CONFIG: dict[str, dict] = {
    "business-registration": {
        "label": "사업자등록 신청서",
        "query": "사업자등록 신청서 인적사항 상호 업태 종목 개업",
        "category": "license",
    },
    "food-business-license": {
        "label": "식품영업 신고서 (휴게음식점)",
        "query": "식품영업 신고서 영업자 영업장 면적 첨부서류 휴게음식점",
        "category": "license",
    },
    "employment-contract": {
        "label": "표준 근로계약서",
        "query": "근로계약서 근무시간 임금 계약기간 4대보험",
        "category": "labor",
    },
    "lease-contract": {
        "label": "상가건물 임대차계약서",
        "query": "임대차계약서 임대인 임차인 보증금 월차임 특약",
        "category": "lease",
    },
}

_SYSTEM_PROMPT = """당신은 서울 F&B 소상공인을 위한 행정서류 초안 작성 전문 AI입니다.
다음 규칙을 반드시 지켜주세요:

1. 제공된 서식 구조를 기반으로 실제 제출에 가까운 초안을 작성하세요.
2. 창업자 정보를 정확히 반영하고, 모르는 정보는 [확인 필요] 또는 [직접 입력]으로 표시하세요.
3. 주민등록번호 뒷자리는 절대 생성하지 마세요. 앞 7자리(6자리-성별 1자리)만 표시하세요.
4. 한국 공식 행정문서 형식을 유지하세요.
5. 마크다운(#, **, - 등) 없이 순수 텍스트로 작성하세요.
6. 섹션 구분은 ■ 기호를 사용하세요."""


def _format_profile(p: dict) -> str:
    BIZ = {"cafe": "카페", "bakery": "베이커리", "snack": "분식"}
    TAX = {"simplified": "간이과세자", "general": "일반과세자"}
    ENTITY = {"individual": "개인사업자", "corporation": "법인사업자"}

    lines = []
    if p.get("name"):              lines.append(f"성명: {p['name']}")
    if p.get("birth_date"):        lines.append(f"생년월일: {p['birth_date']}")
    if p.get("phone"):             lines.append(f"연락처: {p['phone']}")
    if p.get("email"):             lines.append(f"이메일: {p['email']}")
    if p.get("resident_id_front"):
        rid = f"{p['resident_id_front']}-{p.get('resident_id_gender', '')}●●●●●●"
        lines.append(f"주민등록번호: {rid}")
    if p.get("business_type"):     lines.append(f"업종: {BIZ.get(p['business_type'], p['business_type'])}")
    if p.get("business_name"):     lines.append(f"상호명(예정): {p['business_name']}")
    if p.get("district"):          lines.append(f"사업 예정 지역: 서울시 {p['district']}")
    if p.get("address"):
        addr = p["address"] + (" " + p["address_detail"] if p.get("address_detail") else "")
        lines.append(f"사업장 주소: {addr}")
    if p.get("floor_area"):        lines.append(f"영업장 면적: {p['floor_area']}㎡")
    if p.get("tax_type"):          lines.append(f"과세 유형: {TAX.get(p['tax_type'], p['tax_type'])}")
    if p.get("entity_type"):       lines.append(f"사업자 유형: {ENTITY.get(p['entity_type'], p['entity_type'])}")
    if p.get("open_date"):         lines.append(f"개업 예정일: {p['open_date']}")
    if p.get("has_co_owner"):      lines.append("공동사업자: 있음")
    return "\n".join(lines)


async def generate_draft(doc_type: str, user_profile: dict) -> dict:
    """
    doc_type: DOC_TYPE_CONFIG 키 (e.g. "business-registration")
    user_profile: 온보딩 폼 데이터 (snake_case)
    반환: {"doc_type", "title", "content", "disclaimer"}
    """
    config = DOC_TYPE_CONFIG.get(doc_type)
    if not config:
        raise ValueError(f"지원하지 않는 서류 유형: {doc_type}")

    # RAG 검색 — 낮은 threshold로 서식 문서 확보
    chunks = await retrieve(
        query=config["query"],
        category=config["category"],
        match_count=5,
        match_threshold=0.2,
    )
    rag_context = "\n\n".join(c["content"] for c in chunks) if chunks else "관련 서식 정보 없음"

    prompt = f"""{_SYSTEM_PROMPT}

=== 서식 구조 참고 ===
{rag_context}

=== 창업자 정보 ===
{_format_profile(user_profile)}

=== 작성 요청 ===
위 정보를 바탕으로 [{config['label']}] 초안을 작성해주세요.
서식 구조를 충실히 따르되, 창업자 정보를 정확히 반영하여 실제 제출 가능한 수준으로 작성하세요."""

    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = await model.generate_content_async(prompt)

    return {
        "doc_type":   doc_type,
        "title":      f"{config['label']} 초안",
        "content":    response.text,
        "disclaimer": LEGAL_DISCLAIMER,
    }
