"""
서류 검토 에이전트
- OpenAI API (gpt-4o-mini)로 계약서/제안서/기타 문서 분석
- 분석 전 비즈니스 문서 여부 사전 검증 포함
- 분석 전 RAG 검색으로 관련 법령/위험 패턴 컨텍스트 보강
- 이득/손해 비율, 위험 조항, 협상 전략 반환
"""
import json
import logging

from fastapi import HTTPException
from openai import AsyncOpenAI

from backend.api.schemas.doc_review import ReviewResult, RiskClause
from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_REVIEW_MODEL = "gpt-4o-mini"

# BGE-M3 임베딩 모듈 — import 실패 시 RAG 없이 분석 계속
try:
    from backend.rag.embeddings.bge_embeddings import embed_single as _bge_embed_single
    from backend.db.client import get_supabase as _get_supabase
    _RAG_AVAILABLE = True
except Exception as _rag_import_err:
    logger.warning("RAG 모듈 import 실패, RAG 없이 분석 진행: %s", _rag_import_err)
    _RAG_AVAILABLE = False

_VALIDATE_PROMPT = """아래 문서가 실제 비즈니스 목적의 문서(계약서, 제안서, 협약서, 견적서, MOU 등)인지 판단하세요.

다음 중 하나에 해당하면 비정상 문서입니다:
- 명백히 허구이거나 비현실적인 내용 (노예계약, 범죄 행위, 판타지 설정 등)
- 비즈니스와 무관한 텍스트 (소설, 뉴스 기사, 개인 일기 등)
- 의미 없는 랜덤 텍스트

JSON으로만 반환:
{{"is_valid": true/false, "reason": "판단 근거 한 줄"}}

[문서]
{content}"""

_SYSTEM_PROMPT = """당신은 한국 계약법과 노동법에 정통한 계약서 검토 전문가입니다.
한국의 법률 기준과 업계 관행을 기준으로 실질적으로 문제가 되는 조항만 지적합니다.
관행적이고 합법적인 조항은 위험으로 분류하지 않습니다.

## 입장별 분석 원칙 (핵심)
동일한 계약서라도 의뢰인의 입장에 따라 이득/손해 비율과 위험 조항이 달라집니다.
- 갑(고용인/발주자) 입장: 갑에게 불리한 조항, 을에게 과도하게 유리한 조항을 위험으로 분류
- 을(피고용인/수주자) 입장: 을에게 불리한 조항, 갑에게 과도하게 유리한 조항을 위험으로 분류
- 같은 계약서에서 을의 손해 비율이 80%라면, 갑의 이득 비율은 약 80%여야 합니다.
모든 수치와 판단은 반드시 의뢰인의 입장에서 일관되게 산출하세요."""

_DOC_TYPE_GUIDANCE = {
    "계약서": """\
## 문서 유형: 계약서
법적 구속력이 있는 문서입니다. 다음 관점을 중심으로 분석하세요:
- 위반 시 손해배상·위약금·계약 해지 등 페널티 조항
- 해지 조건 및 중도 해지 시 불이익
- 의무 이행 기한 및 불이행 시 책임 소재
- 분쟁 해결 방법(관할 법원, 중재 조항) 편향 여부
- 법령(근로기준법, 민법, 상법 등) 위반 여부""",

    "제안서": """\
## 문서 유형: 제안서
법적 구속력은 낮지만 향후 계약의 기초가 됩니다. 다음 관점을 중심으로 분석하세요:
- 업무 범위(Scope)의 모호성 — 추후 범위 분쟁 가능성
- 납기·일정 리스크 — 비현실적인 기한 또는 지연 페널티 예고
- 가격·비용 산정 근거의 불명확성
- 지식재산권·결과물 소유권 귀속 문제
- 책임 한계 미명시로 인한 의뢰인 과도 책임 노출""",

    "기타": """\
## 문서 유형: 기타
문서의 성격에 맞게 범용적으로 검토하되, 의뢰인에게 불리한 조항과 법적 리스크를 중심으로 분석하세요.""",
}

_USER_PROMPT_TEMPLATE = """{rag_context}위 참고 자료를 바탕으로 아래 문서를 "{user_role}" 입장에서 분석하여 다음을 JSON으로 반환하세요.

의뢰인은 "{user_role}"입니다. 모든 판단(유불리 비율, 위험 조항, 수정 제안)은 이 입장에서만 작성하세요.

{doc_type_guidance}

## 위험 조항 판단 기준 (반드시 준수)
다음에 해당하는 경우에만 위험 조항으로 분류:
- 한국 법령(근로기준법, 민법, 상법 등)을 명백히 위반하는 조항
- 동종 업계 관행 대비 현저히 불리한 조항 (단순히 불리한 것은 해당 안 됨)
- 의뢰인에게 일방적으로 과도한 책임/페널티를 부과하는 조항
- 해석이 모호하여 분쟁 시 의뢰인에게 불리하게 작용할 가능성이 높은 조항

## 위험 조항이 아닌 것 (이런 건 리스트에 넣지 말 것)
- 한국에서 관행적으로 통용되는 조항 (예: 무단결근 무급 처리, 퇴직 1개월 전 통보 등)
- 법적으로 문제없는 표준 계약 조항
- 단순히 의뢰인에게 다소 불리할 뿐 협상 여지가 없는 조항

## 출력 형식
1. summary: 전반적 요약 (5-7문장). 다음을 반드시 포함:
   - 문서의 종류와 목적
   - 의뢰인의 입장 (갑/을 중 누구인지)
   - 주요 계약 조건 핵심 내용
   - 갑:을 유리도 비율 및 그 근거
   - 전반적인 유불리 판단
2. gap_ratio: 이 계약이 갑에게 유리한 정도 (0-100 정수)
3. eul_ratio: 이 계약이 을에게 유리한 정도 (0-100 정수, gap_ratio + eul_ratio = 100)
   예) 갑에게 일방적으로 유리한 계약 → gap_ratio: 75, eul_ratio: 25
4. risk_clauses: 위 기준을 충족하는 진짜 위험 조항만 (개수 제한 없음, 없으면 빈 배열 [])
   - clause: 해당 조항 원문 발췌 (50자 이내)
   - reason: 왜 실질적으로 문제인지 구체적 설명 (관행/법령 기준 명시)
   - severity: 위험도 — "High"(즉시 수정 필수), "Mid"(협상 권장), "Low"(검토 권장) 중 하나
   - suggestion_from: 문제가 되는 조항의 핵심 문구 원문 (clause에서 실제 수정이 필요한 부분만, 30자 이내)
   - suggestion_to: suggestion_from을 어떻게 바꾸면 좋은지 수정된 조항 문구 (상대방이 수락 가능한 현실적 표현, 50자 이내)

반드시 순수 JSON만 반환. 마크다운 코드블록 금지.

[문서 원문]
{content}"""


async def _retrieve_contract_knowledge(content: str) -> str:
    """
    문서 앞 2000자로 세 테이블을 검색하고 컨텍스트 문자열을 반환.
      - search_law_contract_knowledge        : 법령 조문 (3-way RRF, 2단계 계층 청킹)
      - search_pattern_contract_knowledge    : 위험 조항 패턴 (risk_level/contract_type 컬럼 포함)
      - search_acceptable_contract_knowledge : 관행적 허용 조항 (clause_name/legal_basis 컬럼 포함)
    임베딩 1회 수행 후 세 RPC에 재사용. 오류 발생 시 빈 문자열 반환.
    """
    if not _RAG_AVAILABLE:
        return ""

    query = content[:2000].strip()
    if not query:
        return ""

    try:
        embedding = await _bge_embed_single(query)
        embedding_str = "[" + ",".join(f"{v:.10f}" for v in embedding) + "]"
        supabase = _get_supabase()

        # 법령 조문 검색 (paragraph 단위 정밀 검색)
        law_result = supabase.rpc(
            "search_law_contract_knowledge",
            {
                "query_text":      query,
                "query_embedding": embedding_str,
                "match_count":     4,
                "filter_category": None,
                "min_score":       0.3,
                "min_trgm_score":  0.5,
                "min_content_len": 40,
            },
        ).execute()

        # 위험 조항 패턴 검색
        pattern_result = supabase.rpc(
            "search_pattern_contract_knowledge",
            {
                "query_text":           query,
                "query_embedding":      embedding_str,
                "match_count":          4,
                "filter_risk_level":    None,
                "filter_contract_type": None,
                "min_score":            0.25,
                "min_trgm_score":       0.35,
                "min_content_len":      30,
            },
        ).execute()

        # 관행적 허용 조항 검색
        acceptable_result = supabase.rpc(
            "search_acceptable_contract_knowledge",
            {
                "query_text":            query,
                "query_embedding":       embedding_str,
                "match_count":           4,
                "filter_contract_type":  None,
                "min_score":             0.25,
                "min_trgm_score":        0.35,
                "min_content_len":       30,
            },
        ).execute()

        law_chunks:        list[dict] = law_result.data or []
        pattern_chunks:    list[dict] = pattern_result.data or []
        acceptable_chunks: list[dict] = acceptable_result.data or []

        if not law_chunks and not pattern_chunks and not acceptable_chunks:
            return ""

        lines: list[str] = []

        if law_chunks:
            lines.append("[관련 법령 조문]")
            for chunk in law_chunks:
                meta          = chunk.get("metadata") or {}
                law_name      = meta.get("law_name") or meta.get("law") or "출처 불명"
                article       = meta.get("article", "")
                source_label  = f"{law_name} {article}".strip()
                chunk_content = (chunk.get("content") or "").strip()
                if chunk_content:
                    lines.append(f"출처: {source_label}")
                    lines.append(f"내용: {chunk_content}")
                    lines.append("")

        if pattern_chunks:
            lines.append("[위험 조항 패턴]")
            for chunk in pattern_chunks:
                risk_level    = chunk.get("risk_level") or ""
                pattern_name  = chunk.get("pattern_name") or ""
                contract_type = chunk.get("contract_type") or chunk.get("category") or ""
                chunk_content = (chunk.get("content") or "").strip()
                if chunk_content:
                    if pattern_name or risk_level:
                        lines.append(
                            f"패턴: {pattern_name} | 위험도: {risk_level} | 계약유형: {contract_type}"
                        )
                    lines.append(f"내용: {chunk_content}")
                    lines.append("")

        if acceptable_chunks:
            lines.append("[관행적 허용 조항 — 아래 조항은 업계 관행상 수락 가능한 조항입니다]")
            for chunk in acceptable_chunks:
                clause_name   = chunk.get("clause_name") or ""
                legal_basis   = chunk.get("legal_basis") or ""
                contract_type = chunk.get("contract_type") or ""
                chunk_content = (chunk.get("content") or "").strip()
                if chunk_content:
                    if clause_name:
                        lines.append(
                            f"허용조항: {clause_name} | 근거: {legal_basis} | 계약유형: {contract_type}"
                        )
                    lines.append(f"내용: {chunk_content}")
                    lines.append("")

        lines.append("---")
        lines.append("")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning("RAG 검색 실패, 빈 컨텍스트로 분석 계속: %s", exc)
        return ""


async def _validate_document(client: AsyncOpenAI, content: str) -> None:
    """비즈니스 문서 여부 사전 검증. 비정상 문서면 HTTPException 422 raise."""
    response = await client.chat.completions.create(
        model=_REVIEW_MODEL,
        messages=[
            {"role": "user", "content": _VALIDATE_PROMPT.format(content=content[:2000])},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    raw = (response.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return  # 파싱 실패 시 검증 통과 (관대하게 처리)

    if not data.get("is_valid", True):
        raise HTTPException(
            status_code=422,
            detail=f"비즈니스 문서로 인식되지 않습니다: {data.get('reason', '')}",
        )


async def analyze(content: str, user_role: str = "미지정", doc_type: str = "기타") -> ReviewResult:
    """
    문서 텍스트를 분석하여 ReviewResult 반환.

    Args:
        content: 문서 원문 텍스트

    Returns:
        ReviewResult: 분석 결과

    Raises:
        ValueError: OpenAI 응답 파싱 실패 시
        openai.APIError: API 호출 실패 시
    """
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    await _validate_document(client, content)

    rag_context = await _retrieve_contract_knowledge(content)
    # rag_context가 있으면 참고 자료 블록 + 줄바꿈, 없으면 빈 문자열로 프롬프트에서 자연스럽게 생략
    rag_prefix = rag_context if rag_context else ""

    response = await client.chat.completions.create(
        model=_REVIEW_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _USER_PROMPT_TEMPLATE.format(
                    rag_context=rag_prefix,
                    content=content,
                    user_role=user_role,
                    doc_type_guidance=_DOC_TYPE_GUIDANCE.get(doc_type, _DOC_TYPE_GUIDANCE["기타"]),
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    raw_text: str = (response.choices[0].message.content or "").strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"OpenAI 응답을 JSON으로 파싱하지 못했습니다. "
            f"오류: {e}\n원문: {raw_text[:300]}"
        )

    # risk_clauses 검증 및 변환
    raw_clauses = data.get("risk_clauses", [])
    risk_clauses = [
        RiskClause(
            clause=c.get("clause", ""),
            reason=c.get("reason", ""),
            severity=c.get("severity", "Mid"),
            suggestion_from=c.get("suggestion_from", c.get("suggestion", "")),
            suggestion_to=c.get("suggestion_to", ""),
        )
        for c in raw_clauses
    ]

    return ReviewResult(
        summary=data.get("summary", ""),
        gap_ratio=int(data.get("gap_ratio", 50)),
        eul_ratio=int(data.get("eul_ratio", 50)),
        risk_clauses=risk_clauses,
    )
