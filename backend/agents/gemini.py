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
        "label": "식품 영업 신고서",
        "query": "식품영업 신고서 영업자 영업장 면적 첨부서류 휴게음식점",
        "category": "license",
        "json_template": {
            # 신고인
            "신고인_성명": "",
            "신고인_주민등록번호": "",
            "신고인_주소": "",
            "신고인_전화번호": "",
            # 신고사항
            "명칭_상호": "",
            "영업장_전화번호": "",
            "영업종류_휴게음식점영업": "해당",
            "영업장_내부면적_㎡": "",
            "영업장_외부면적_㎡": "",
            "영업장_소재지": "",
            # 식품용수 (기본 수돗물)
            "식품용수_수돗물": "해당",
            "식품용수_먹는샘물": "",
            "식품용수_먹는염지하수": "",
            "식품용수_지하수": "",
            "식품용수_먹는해양심층수": "",
            "식품용수_그 밖의 먹는물": "",
            # 기타 여부
            "공유주방_사용여부": "미해당",
            "공동조리장_이용여부": "미해당",
            "공동조리장_업소정보": "",
            "식품자동판매기_기능여부": "미해당",
            "반려동물_출입여부": "미해당",
            # 제출
            "신고일": "",
            "신고기관": "마포구청장",
        },
    },
    "employment-contract": {
        "label": "근로계약서 (표준안)",
        "query": "근로계약서 근무시간 임금 계약기간 4대보험",
        "category": "labor",
        "json_template": {
            # 채용기관장(사업주)
            "채용기관장_사업장명": "",
            "채용기관장_성명": "",
            # 근로자 인적사항
            "근로자_성명": "[직접 입력]",
            "근로자_성별": "[직접 입력]",
            "근로자_생년월일": "[직접 입력]",
            "근무형태": "정규직",
            "근로자_연락처": "[직접 입력]",
            "근로자_주소": "[직접 입력]",
            # 계약기간
            "계약기간_시작": "",
            "계약기간_종료": "[직접 입력]",
            # 근무장소 및 업무
            "근무장소": "",
            "직종_업무내용": "카페 운영 보조 (음료 제조, 서빙, 청소 등)",
            # 근로시간
            "근무요일_시작": "월",
            "근무요일_종료": "금",
            "근무시작시간": "09:00",
            "근무종료시간": "18:00",
            "휴게시작시간": "12:00",
            "휴게종료시간": "13:00",
            # 보수
            "기본급": "[직접 입력]",
            "급식비": "월 14만원",
            "임금지급일": "25",
            "은행명": "[직접 입력]",
            "계좌번호": "[직접 입력]",
            # 체결
            "계약체결일": "",
        },
    },
    "lease-contract": {
        "label": "상가건물 임대차 표준계약서",
        "query": "임대차계약서 임대인 임차인 보증금 월차임 특약",
        "category": "lease",
        "json_template": {
            # 임차 상가건물 표시
            "소재지": "",
            "토지_지목": "",
            "토지_면적_㎡": "",
            "건물_구조용도": "",
            "건물_면적_㎡": "",
            "임차할부분_면적_㎡": "",
            # 계약내용 (보증금/차임)
            "보증금": "[직접 입력]",
            "계약금": "[직접 입력]",
            "중도금": "[직접 입력]",
            "중도금_지급일": "[직접 입력]",
            "잔금": "[직접 입력]",
            "잔금_지급일": "[직접 입력]",
            "차임_월세": "[직접 입력]",
            "차임_지급일": "[직접 입력]",
            "부가세_포함여부": "불포함",
            "입금계좌": "[직접 입력]",
            "환산보증금": "[직접 입력]",
            # 임대차기간
            "임대차기간_인도일": "",
            "임대차기간_종료": "[직접 입력]",
            # 임차목적
            "임차목적_업종": "카페",
            # 특약사항
            "특약사항": "[직접 입력]",
            # 당사자 정보
            "임대인_주소": "[직접 입력]",
            "임대인_주민번호": "[직접 입력]",
            "임대인_전화": "[직접 입력]",
            "임대인_성명": "[직접 입력]",
            "임차인_주소": "",
            "임차인_주민번호": "",
            "임차인_전화": "",
            "임차인_성명": "",
            # 체결
            "계약체결일": "",
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

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    # fallback용 경량 메시지 (RAG 제거, 토큰 절감)
    stripped_user = (
        f"=== 창업자 정보 ===\n{_format_profile(user_profile)}\n\n"
        f"=== 작성 요청 ===\n"
        f"아래 JSON 템플릿의 각 필드를 창업자 정보로 채워서 완성된 JSON만 반환하세요.\n"
        f"알 수 없는 값은 \"[직접 입력]\"으로 표시하세요.\n\n{template_str}"
    )
    fallback_messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": stripped_user},
    ]

    # 429/413 발생 시 llama-3.1-8b-instant 로 fallback (RAG 제거로 토큰 절감)
    for model, msg, max_tok in [
        ("llama-3.3-70b-versatile", messages, 2048),
        ("llama-3.1-8b-instant",    fallback_messages, 1024),
    ]:
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=msg,
                temperature=0.1,
                max_tokens=max_tok,
            )
            break
        except Exception as e:
            err_str = str(e)
            if any(code in err_str for code in ("429", "413", "rate_limit")):
                if model == "llama-3.1-8b-instant":
                    raise  # 두 모델 모두 실패
                continue
            raise

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
