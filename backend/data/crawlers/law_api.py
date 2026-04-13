"""
법제처 국가법령정보 API 크롤러
마포구 카페 창업에 직접 적용되는 규제 조문만 수집합니다.

API 문서: https://www.law.go.kr/LSW/openapiInfo.do
공공저작물 자유이용 허락 확인 완료.
"""
import re
import asyncio
import httpx
from backend.core.constants import FounderSubStage

_BASE_URL = "https://www.law.go.kr/DRF"
_OC = "kimjaehyun9605"

# 마포구 카페 창업에 직접 적용되는 법령 + 조문 화이트리스트
REGULATION_TARGETS = [
    {
        "name": "식품위생법",
        "article_whitelist": [
            "제36조",  # 영업의 종류 (휴게음식점/일반음식점/제과점)
            "제37조",  # 영업허가 등
            "제41조",  # 식품위생교육
            "제44조",  # 영업자 준수사항
            "제88조",  # 집단급식소
        ],
        "stage": [
            FounderSubStage.LICENSE_APPLICATION,
            FounderSubStage.PRE_OPEN,
        ],
        "topic": "food_license",
    },
    {
        "name": "화재예방, 소방시설 설치 및 관리에 관한 법률",
        "article_whitelist": [
            "제12조",  # 소방시설의 설치 및 관리
            "제15조",  # 피난시설, 방화구획
            "제22조",  # 소방안전관리자 선임
        ],
        "stage": [
            FounderSubStage.INTERIOR,
            FounderSubStage.PRE_OPEN,
        ],
        "topic": "fire_safety",
    },
    {
        "name": "건축법",
        "article_whitelist": [
            "제19조",  # 용도변경
        ],
        "stage": [
            FounderSubStage.LEASE_REVIEW,
        ],
        "topic": "building_usage",
    },
]


def _article_name_to_jo_no(article_name: str) -> str:
    """'제36조' → '36' (API 조문번호 형식)"""
    match = re.search(r"제\s*(\d+)\s*조", article_name)
    if not match:
        return ""
    return match.group(1)


async def _search_lsi_seq(name: str, client: httpx.AsyncClient) -> str | None:
    """법령명으로 법령일련번호(lsiSeq) 조회"""
    resp = await client.get(
        f"{_BASE_URL}/lawSearch.do",
        params={
            "OC": _OC,
            "target": "law",
            "type": "JSON",
            "query": name,
            "display": 1,
            "page": 1,
        },
    )
    resp.raise_for_status()
    data = resp.json()

    search_result = data.get("LawSearch", {})
    law = search_result.get("law") or search_result.get("법령")
    if not law:
        return None

    # 단일 결과는 dict, 복수 결과는 list
    if isinstance(law, list):
        law = law[0]

    return law.get("법령일련번호") or law.get("lsiSeq")


async def _fetch_articles(lsi_seq: str, client: httpx.AsyncClient) -> list[dict]:
    """법령 전체 조문 목록 반환"""
    resp = await client.get(
        f"{_BASE_URL}/lawService.do",
        params={
            "OC": _OC,
            "target": "law",
            "type": "JSON",
            "MST": lsi_seq,
        },
    )
    resp.raise_for_status()
    data = resp.json()

    law_data = data.get("법령", {})
    jo_section = law_data.get("조문", {})
    units = jo_section.get("조문단위", [])

    if isinstance(units, dict):
        units = [units]

    return units


def _build_hang_content(hang: dict) -> str:
    """항 dict → 항내용 + 호 + 목 전체 텍스트로 조립"""
    parts = [hang["항내용"]]

    ho_list = hang.get("호", [])
    if isinstance(ho_list, dict):
        ho_list = [ho_list]
    for ho in ho_list:
        parts.append(f"  {ho['호내용']}")
        mok_list = ho.get("목", [])
        if isinstance(mok_list, dict):
            mok_list = [mok_list]
        for mok in mok_list:
            parts.append(f"    {mok['목내용']}")

    return "\n".join(parts)


def _parse_article_hierarchical(
    unit: dict, law_name: str, lsi_seq: str, target: dict
) -> list[dict]:
    """
    조문 단위 → [article_chunk, paragraph_chunk1, paragraph_chunk2, ...]

    반환 형식:
      chunk_type  = "article" | "paragraph"
      article_key = "{law_name}-{jo_no}"  (parent 연결용 임시 키)
      paragraph_no, paragraph_char: 항 번호 (article chunk는 None)
    """
    # 장 제목 등 비조문 단위는 스킵
    if unit.get("조문여부") != "조문":
        return []

    jo_no = unit.get("조문번호", "")
    if not jo_no.isdigit():
        return []

    jo_title = unit.get("조문제목", "")
    jo_key = unit.get("조문키", jo_no)  # 조문키는 조문단위별 고유값 (예: "0019001")
    article_name = f"제{int(jo_no)}조"
    article_label = f"{article_name}({jo_title})" if jo_title else article_name
    article_key = f"{law_name}-{jo_key}"  # 조번호 대신 조문키 사용 → 동일 조번호 중복 방지

    hang_list = unit.get("항", [])
    if isinstance(hang_list, dict):
        hang_list = [hang_list]

    base_metadata = {
        "law": law_name,
        "lsi_seq": lsi_seq,
        "article": article_name,
        "article_no": int(jo_no),
        "article_title": jo_title,
        "topic": target["topic"],
        "stage": [str(s) for s in target["stage"]],
        "business_type": ["카페"],
    }

    chunks: list[dict] = []

    # 항이 없는 조문 (제목만 있거나 단문 조문)
    if not hang_list:
        chunks.append({
            "content": article_label,
            "chunk_type": "article",
            "article_key": article_key,
            "paragraph_no": None,
            "paragraph_char": None,
            "metadata": {**base_metadata, "chunk_type": "article"},
        })
        return chunks

    # article chunk (parent): 전체 항을 합쳐 하나의 청크로 저장 (검색 컨텍스트용)
    all_hang_texts = [_build_hang_content(h) for h in hang_list]
    article_content = f"{article_label}\n\n" + "\n\n".join(all_hang_texts)
    chunks.append({
        "content": article_content,
        "chunk_type": "article",
        "article_key": article_key,
        "paragraph_no": None,
        "paragraph_char": None,
        "metadata": {**base_metadata, "chunk_type": "article"},
    })

    # paragraph chunks (children): 항 단위로 분리하여 정밀 검색 지원
    for idx, hang in enumerate(hang_list, 1):
        hang_char = hang.get("항번호", f"①")
        hang_text = _build_hang_content(hang)
        # 검색 결과에서 어느 조/항인지 즉시 알 수 있도록 prefix 삽입
        content = f"[{law_name} {article_label} {hang_char}항]\n{hang_text}"

        chunks.append({
            "content": content,
            "chunk_type": "paragraph",
            "article_key": article_key,
            "paragraph_no": idx,
            "paragraph_char": hang_char,
            "metadata": {
                **base_metadata,
                "chunk_type": "paragraph",
                "paragraph_no": idx,
                "paragraph_char": hang_char,
            },
        })

    return chunks


async def fetch_regulation(target: dict) -> list[dict]:
    """
    단일 법령 수집 → ingest_law_documents() 입력 형식 반환

    반환: [{"source", "chunk_index", "content", "chunk_type", "article_key",
             "paragraph_no", "paragraph_char", "metadata"}]
    """
    whitelist_jo_nos = {
        _article_name_to_jo_no(a) for a in target["article_whitelist"]
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        lsi_seq = await _search_lsi_seq(target["name"], client)
        if not lsi_seq:
            return []

        await asyncio.sleep(0.3)
        all_units = await _fetch_articles(lsi_seq, client)

    results: list[dict] = []
    for unit in all_units:
        jo_no = unit.get("조문번호", "")
        if jo_no not in whitelist_jo_nos:
            continue

        chunks = _parse_article_hierarchical(unit, target["name"], lsi_seq, target)
        results.extend(chunks)

    for i, doc in enumerate(results):
        doc["source"] = target["name"]
        doc["chunk_index"] = i

    return results


# 카페 창업자에게 직접 관련된 세금 법령 + 조문 화이트리스트
TAX_TARGETS = [
    {
        "name": "부가가치세법",
        "article_whitelist": [
            "제2조",   # 정의 (과세대상)
            "제3조",   # 납세의무자
            "제14조",  # 세금계산서 발급
            "제48조",  # 예정신고와 납부
            "제49조",  # 확정신고와 납부
            "제61조",  # 간이과세자 납부의무 면제
            "제62조",  # 간이과세자 신고와 납부
        ],
        "stage": [],
        "topic": "vat",
    },
    {
        "name": "소득세법",
        "article_whitelist": [
            "제19조",  # 사업소득
            "제70조",  # 종합소득과세표준 확정신고
            "제76조",  # 납부
            "제160조", # 장부의 비치·기장
        ],
        "stage": [],
        "topic": "income_tax",
    },
    {
        "name": "국세기본법",
        "article_whitelist": [
            "제47조",  # 가산세
            "제47조의2",  # 무신고가산세
            "제47조의3",  # 과소신고가산세
            "제47조의4",  # 납부지연가산세
            "제45조의2",  # 경정 등의 청구
        ],
        "stage": [],
        "topic": "tax_penalty",
    },
]


async def fetch_all_regulations() -> list[dict]:
    """전체 규제법령 수집 (REGULATION_TARGETS 전체)"""
    all_docs = []
    for target in REGULATION_TARGETS:
        docs = await fetch_regulation(target)
        all_docs.extend(docs)
        await asyncio.sleep(0.5)
    return all_docs


async def fetch_all_tax_laws() -> list[dict]:
    """세금 법령 수집 (TAX_TARGETS 전체)"""
    all_docs = []
    for target in TAX_TARGETS:
        docs = await fetch_regulation(target)
        all_docs.extend(docs)
        await asyncio.sleep(0.5)
    return all_docs
