"""
Groq (Llama 3.3 70B) 기반 서류 초안 생성 에이전트

RAG 검색 → Groq API → JSON 필드 → 구조화된 초안 반환
무료 API (14,400 req/일, 30 req/분)
"""
import json
import re
from openai import AsyncOpenAI

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER
from backend.rag.retriever.pgvector_retriever import retrieve

# 서류 유형별 설정
DOC_TYPE_CONFIG: dict[str, dict] = {
    "business-registration": {
        "label": "사업자등록 신청서",
        "query": "사업자등록 신청서 인적사항 상호 업태 종목 개업",
        "category": "license",
        "json_template": {
            # 인적사항
            "상호_단체명": "",
            "성명_대표자": "",
            "주민등록번호": "",
            "부동산등기용등록번호": "",
            "사업장_소재지": "",
            "자동정정신청": "부",
            "사업장_전화번호": "",
            "휴대전화번호": "",
            "주소지_전화번호": "",
            "팩스번호": "",
            # 업종
            "주업태": "음식점업",
            "주종목": "커피 전문점",
            "주업종코드": "552101",
            "부업태": "",
            "부종목": "",
            "부업종코드": "",
            "개업일": "",
            "종업원수": "1",
            # 사이버몰
            "사이버몰_도메인명": "",
            # 사업장 구분
            "자가면적_㎡": "",
            "타가면적_㎡": "",
            # 임대차명세
            "임대인_성명": "[직접 입력]",
            "임대인_사업자등록번호": "[직접 입력]",
            "임대인_주민법인등록번호": "[직접 입력]",
            "임대차계약기간": "[직접 입력]",
            "전세보증금": "[직접 입력]",
            "월세_차임": "[직접 입력]",
            # 기타
            "투자조합_출자여부": "부",
            "허가사업_여부": "여",
            "사업자금_자기자금": "[직접 입력]",
            "사업자금_타인자금": "[직접 입력]",
            "간이과세_신고여부": "부",
            "간이과세_포기신고여부": "부",
            "전자우편주소": "",
            "확정일자_신청여부": "부",
            "공동사업자_신청여부": "부",
            "사업장외_송달장소_신청여부": "부",
            "현금영수증_가입신청여부": "여",
            "신탁재산_여부": "부",
            # 제출
            "관할_세무서": "",
            "신청일": "",
        },
    },
    "food-business-license": {
        "label": "식품영업 신고서 (휴게음식점)",
        "query": "식품영업 신고서 영업자 영업장 면적 첨부서류 휴게음식점",
        "category": "license",
        "json_template": {
            "영업자_성명": "",
            "영업자_주민등록번호": "",
            "영업자_전화번호": "",
            "영업자_주소": "",
            "영업소_명칭": "",
            "영업소_소재지": "",
            "영업장_면적_㎡": "",
            "영업의_종류": "휴게음식점영업",
            "식품위생교육_이수여부": "",
            "위생책임자_성명": "",
            "급수_시설_종류": "상수도",
            "신고일": "",
            "신고기관": "",
        },
    },
    "employment-contract": {
        "label": "표준 근로계약서",
        "query": "근로계약서 근무시간 임금 계약기간 4대보험",
        "category": "labor",
        "json_template": {
            "사업주_성명": "",
            "사업장_명칭": "",
            "사업장_소재지": "",
            "사업주_연락처": "",
            "근로자_성명": "[직접 입력]",
            "근로자_주민등록번호": "[직접 입력]",
            "근무_장소": "",
            "담당_업무": "카페 운영 보조 (음료 제조, 서빙, 청소 등)",
            "계약_기간_시작": "",
            "계약_기간_종료": "[직접 입력]",
            "근무_시간": "09:00 ~ 18:00",
            "휴게_시간": "12:00 ~ 13:00 (1시간)",
            "근무_요일": "월 ~ 금 (주 5일)",
            "임금_시급_또는_월급": "[직접 입력]",
            "임금_지급일": "매월 [직접 입력]일",
            "임금_지급_방법": "계좌이체",
            "연차_유급휴가": "근로기준법 제60조에 따름",
            "사회보험_적용": "국민연금·건강보험·고용보험·산재보험 가입",
            "계약_체결일": "",
        },
    },
    "lease-contract": {
        "label": "상가건물 임대차계약서",
        "query": "임대차계약서 임대인 임차인 보증금 월차임 특약",
        "category": "lease",
        "json_template": {
            "임대인_성명": "[직접 입력]",
            "임대인_주민등록번호": "[직접 입력]",
            "임대인_주소": "[직접 입력]",
            "임대인_연락처": "[직접 입력]",
            "임차인_성명": "",
            "임차인_주민등록번호": "",
            "임차인_주소": "",
            "임차인_연락처": "",
            "부동산_소재지": "",
            "부동산_면적_㎡": "",
            "임대_목적": "영업용 (카페)",
            "보증금": "[직접 입력]",
            "월_차임": "[직접 입력]",
            "차임_지급일": "매월 [직접 입력]일",
            "임대_기간_시작": "",
            "임대_기간_종료": "[직접 입력]",
            "특약사항": "[직접 입력]",
            "계약_체결일": "",
        },
    },
}

_SYSTEM_PROMPT = """당신은 한국 행정서류 작성 전문가입니다.
창업자 정보와 서식 참고 자료를 바탕으로 서류의 각 필드 값을 채워 JSON으로만 반환하세요.

규칙:
1. 반드시 유효한 JSON만 반환하세요. 다른 텍스트, 설명, 마크다운 없이 JSON만.
2. 창업자 정보에서 알 수 있는 값은 정확히 채우세요.
3. 알 수 없는 값은 "[직접 입력]"으로 표시하세요.
4. 주민등록번호 뒷자리는 절대 생성하지 마세요. "앞6자리-성별1자리●●●●●●" 형식만 사용.
5. 날짜는 YYYY-MM-DD 형식으로 작성하세요.
6. "여/부" 체크박스 필드는 반드시 "여" 또는 "부" 문자열만 사용하세요.
7. 사업자등록 신청서의 경우, 음식점(카페)은 허가사업_여부="여", 현금영수증_가입신청여부="여"로 설정하세요."""


def _format_profile(p: dict) -> str:
    BIZ = {"cafe": "카페", "bakery": "베이커리", "snack": "분식"}
    TAX = {"simplified": "간이과세자", "general": "일반과세자"}
    ENTITY = {"individual": "개인사업자", "corporation": "법인사업자"}

    lines = []
    if p.get("name"):             lines.append(f"성명: {p['name']}")
    if p.get("birth_date"):       lines.append(f"생년월일: {p['birth_date']}")
    if p.get("phone"):            lines.append(f"연락처: {p['phone']}")
    if p.get("email"):            lines.append(f"이메일: {p['email']}")
    if p.get("resident_id_front"):
        rid = f"{p['resident_id_front']}-{p.get('resident_id_gender', '')}●●●●●●"
        lines.append(f"주민등록번호: {rid}")
    if p.get("business_type"):    lines.append(f"업종: {BIZ.get(p['business_type'], p['business_type'])}")
    if p.get("business_name"):    lines.append(f"상호명(예정): {p['business_name']}")
    if p.get("district"):         lines.append(f"사업 예정 지역: 서울시 {p['district']}")
    if p.get("address"):
        addr = p["address"] + (" " + p["address_detail"] if p.get("address_detail") else "")
        lines.append(f"사업장 주소: {addr}")
    if p.get("floor_area"):       lines.append(f"영업장 면적: {p['floor_area']}㎡")
    if p.get("tax_type"):         lines.append(f"과세 유형: {TAX.get(p['tax_type'], p['tax_type'])}")
    if p.get("entity_type"):      lines.append(f"사업자 유형: {ENTITY.get(p['entity_type'], p['entity_type'])}")
    if p.get("open_date"):        lines.append(f"개업 예정일: {p['open_date']}")
    if p.get("has_co_owner"):     lines.append("공동사업자: 있음")
    if p.get("has_hygiene_edu"):  lines.append("식품위생교육: 이수 완료")
    return "\n".join(lines)


def _extract_json(text: str) -> dict:
    """LLM 응답에서 JSON 추출 (```json 블록 포함 처리)"""
    text = text.strip()
    # ```json ... ``` 블록 제거
    match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 중괄호 범위만 추출 재시도
        match = re.search(r"\{[\s\S]+\}", text)
        if match:
            return json.loads(match.group())
        return {}


async def generate_draft(doc_type: str, user_profile: dict) -> dict:
    config = DOC_TYPE_CONFIG.get(doc_type)
    if not config:
        raise ValueError(f"지원하지 않는 서류 유형: {doc_type}")

    # RAG 검색
    chunks = await retrieve(
        query=config["query"],
        category=config["category"],
        match_count=5,
        match_threshold=0.2,
    )
    rag_context = "\n\n".join(c["content"] for c in chunks) if chunks else "관련 서식 정보 없음"

    template_str = json.dumps(config["json_template"], ensure_ascii=False, indent=2)

    user_message = f"""=== 서식 참고 ===
{rag_context}

=== 창업자 정보 ===
{_format_profile(user_profile)}

=== 작성 요청 ===
아래 JSON 템플릿의 각 필드를 창업자 정보로 채워서 완성된 JSON만 반환하세요.

{template_str}"""

    settings = get_settings()
    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.1,
        max_tokens=2048,
    )

    raw = response.choices[0].message.content or ""
    fields = _extract_json(raw)

    # fields가 비면 템플릿 그대로 반환
    if not fields:
        fields = config["json_template"].copy()

    return {
        "doc_type":   doc_type,
        "title":      f"{config['label']} 초안",
        "content":    raw,
        "fields":     fields,
        "disclaimer": LEGAL_DISCLAIMER,
    }
