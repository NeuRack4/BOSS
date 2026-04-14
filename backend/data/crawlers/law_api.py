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

# ── 인허가 (license) — 창업 전 신고·허가·건축 인허가 ─────────────────────────
# article_whitelist = None → 법령 전체 조문 수집
LICENSE_TARGETS = [
    {
        "name": "식품위생법",
        "article_whitelist": None,  # 전체 수집
        "stage": [FounderSubStage.LICENSE_APPLICATION, FounderSubStage.PRE_OPEN],
        "topic": "food_license",
    },
    {
        "name": "화재예방, 소방시설 설치 및 관리에 관한 법률",
        "article_whitelist": None,
        "stage": [FounderSubStage.INTERIOR, FounderSubStage.PRE_OPEN],
        "topic": "fire_safety",
    },
    {
        "name": "건축법",
        "article_whitelist": [
            "제19조",  # 용도변경
            "제20조",  # 가설건축물
            "제22조",  # 건축물의 사용승인
        ],
        "stage": [FounderSubStage.LEASE_REVIEW],
        "topic": "building_usage",
    },
]

# ── 규제법령 (regulation) — 오픈 후 운영 중 준수 규제 ────────────────────────
REGULATION_TARGETS = [
    {
        "name": "개인정보 보호법",
        "article_whitelist": None,
        "stage": [FounderSubStage.OPEN],
        "topic": "privacy",
    },
]

# ── 근로 (labor) ─────────────────────────────────────────────────────────────
LABOR_TARGETS = [
    {
        "name": "근로기준법",
        "article_whitelist": None,  # 전체 수집
        "stage": [FounderSubStage.HIRING_PREPARATION, FounderSubStage.HIRING_CONTRACT],
        "topic": "labor_standard",
    },
    {
        "name": "최저임금법",
        "article_whitelist": None,
        "stage": [FounderSubStage.HIRING_PREPARATION],
        "topic": "minimum_wage",
    },
    {
        "name": "근로자퇴직급여 보장법",
        "article_whitelist": None,
        "stage": [FounderSubStage.HIRING_CONTRACT],
        "topic": "retirement_pay",
    },
    {
        "name": "고용보험법",
        "article_whitelist": [
            "제6조",   # 피보험자격
            "제7조",   # 취득신고
            "제8조",   # 상실신고
            "제69조",  # 고용보험료
        ],
        "stage": [FounderSubStage.HIRING_CONTRACT],
        "topic": "employment_insurance",
    },
    {
        "name": "산업재해보상보험법",
        "article_whitelist": [
            "제6조",   # 적용범위
            "제7조",   # 보험관계 성립
        ],
        "stage": [FounderSubStage.HIRING_CONTRACT],
        "topic": "workers_compensation",
    },
]

# ── 임대차 (lease) ───────────────────────────────────────────────────────────
LEASE_TARGETS = [
    {
        "name": "상가건물 임대차보호법",
        "article_whitelist": None,  # 전체 수집
        "stage": [FounderSubStage.LEASE_REVIEW],
        "topic": "commercial_lease",
    },
]

# ── 지원사업 (subsidy) ────────────────────────────────────────────────────────
SUBSIDY_TARGETS = [
    {
        "name": "소상공인 보호 및 지원에 관한 법률",
        "article_whitelist": None,
        "stage": [FounderSubStage.SUBSIDY_ACTIVE],
        "topic": "small_business_support",
    },
    {
        "name": "중소기업창업 지원법",
        "article_whitelist": None,
        "stage": [FounderSubStage.LOCATION_SEARCH],
        "topic": "startup_support",
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


def _to_str(value) -> str:
    """API 응답값을 문자열로 변환 (list/dict/str 모두 처리)"""
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(_to_str(v) for v in value)
    if isinstance(value, dict):
        return " ".join(_to_str(v) for v in value.values())
    return str(value)


def _build_hang_content(hang: dict) -> str:
    """항 dict → 항내용 + 호 + 목 전체 텍스트로 조립"""
    hang_text = _to_str(hang.get("항내용") or hang.get("조문내용", ""))
    parts = [hang_text]

    ho_list = hang.get("호", [])
    if isinstance(ho_list, dict):
        ho_list = [ho_list]
    for ho in ho_list:
        ho_text = _to_str(ho.get("호내용", ""))
        if ho_text:
            parts.append(f"  {ho_text}")
        mok_list = ho.get("목", [])
        if isinstance(mok_list, dict):
            mok_list = [mok_list]
        for mok in mok_list:
            mok_text = _to_str(mok.get("목내용", ""))
            if mok_text:
                parts.append(f"    {mok_text}")

    return "\n".join(p for p in parts if p)


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
        if not hang_text.strip():
            continue  # 빈 항 스킵
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
    # article_whitelist 가 None 또는 빈 리스트이면 전체 조문 수집
    whitelist = target.get("article_whitelist") or []
    whitelist_jo_nos = {_article_name_to_jo_no(a) for a in whitelist} if whitelist else None

    async with httpx.AsyncClient(timeout=15.0) as client:
        lsi_seq = await _search_lsi_seq(target["name"], client)
        if not lsi_seq:
            return []

        await asyncio.sleep(0.3)
        all_units = await _fetch_articles(lsi_seq, client)

    results: list[dict] = []
    for unit in all_units:
        jo_no = unit.get("조문번호", "")
        # whitelist_jo_nos 가 None 이면 전체 수집
        if whitelist_jo_nos is not None and jo_no not in whitelist_jo_nos:
            continue

        chunks = _parse_article_hierarchical(unit, target["name"], lsi_seq, target)
        results.extend(chunks)

    for i, doc in enumerate(results):
        doc["source"] = target["name"]
        doc["chunk_index"] = i

    return results


# ── 세금 (tax) ───────────────────────────────────────────────────────────────
TAX_TARGETS = [
    {
        "name": "부가가치세법",
        "article_whitelist": None,  # 전체 수집
        "stage": [],
        "topic": "vat",
    },
    {
        "name": "소득세법",
        "article_whitelist": [
            "제19조",   # 사업소득
            "제24조",   # 총수입금액
            "제27조",   # 필요경비
            "제70조",   # 종합소득 확정신고
            "제76조",   # 납부
            "제143조",  # 원천징수
            "제160조",  # 장부 비치·기장
        ],
        "stage": [],
        "topic": "income_tax",
    },
    {
        "name": "국세기본법",
        "article_whitelist": [
            "제45조의2",  # 경정청구
            "제47조",     # 가산세
            "제47조의2",  # 무신고가산세
            "제47조의3",  # 과소신고가산세
            "제47조의4",  # 납부지연가산세
        ],
        "stage": [],
        "topic": "tax_penalty",
    },
    {
        "name": "조세특례제한법",
        "article_whitelist": [
            "제6조",    # 창업중소기업 세액감면
            "제7조",    # 중소기업 특별세액감면
            "제86조의3", # 간이과세자 납부면제
        ],
        "stage": [],
        "topic": "tax_exemption",
    },
]


async def _fetch_all(targets: list[dict]) -> list[dict]:
    """targets 목록 전체 수집 (공통 로직)"""
    all_docs = []
    for target in targets:
        print(f"  [{target['name']}] 수집 중...")
        docs = await fetch_regulation(target)
        print(f"  [{target['name']}] → {len(docs)}개 청크")
        all_docs.extend(docs)
        await asyncio.sleep(0.5)  # 법제처 API 레이트 리밋
    return all_docs


async def fetch_all_licenses() -> list[dict]:
    """인허가 법령 전체 수집 (식품위생법·소방법·건축법)"""
    return await _fetch_all(LICENSE_TARGETS)


async def fetch_all_regulations() -> list[dict]:
    """규제법령 전체 수집 (개인정보보호법 등 운영 중 규제)"""
    return await _fetch_all(REGULATION_TARGETS)


async def fetch_all_tax_laws() -> list[dict]:
    """세금 법령 전체 수집"""
    return await _fetch_all(TAX_TARGETS)


async def fetch_all_labor_laws() -> list[dict]:
    """근로 법령 전체 수집"""
    return await _fetch_all(LABOR_TARGETS)


async def fetch_all_lease_laws() -> list[dict]:
    """임대차 법령 전체 수집"""
    return await _fetch_all(LEASE_TARGETS)


async def fetch_all_subsidy_laws() -> list[dict]:
    """지원사업 법령 전체 수집"""
    return await _fetch_all(SUBSIDY_TARGETS)
