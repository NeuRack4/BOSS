"""
오케스트레이터 에이전트 (LangGraph 상태머신)
창업자 단계(setup → early_ops → growth)를 추적하고
적절한 하위 에이전트로 라우팅합니다.
"""
from typing import Annotated, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from pydantic import BaseModel

from backend.core.constants import FounderStage, FounderSubStage, BusinessType
from backend.agents import subsidy, tax, location, hiring


# ── 상태 정의 ──────────────────────────────────────────────────────────────

class FounderContext(BaseModel):
    user_id: str
    business_type: BusinessType = BusinessType.CAFE
    region: str = "마포구"
    stage: FounderStage = FounderStage.SETUP
    sub_stage: FounderSubStage = FounderSubStage.LOCATION_SEARCH
    messages: Annotated[list, add_messages] = []
    pending_drafts: list[str] = []


# ── 라우팅 로직 ────────────────────────────────────────────────────────────

def route(ctx: FounderContext) -> Literal["subsidy", "tax", "location", "hiring", "__end__"]:
    """현재 단계에 따라 적절한 에이전트로 라우팅"""
    sub = ctx.sub_stage

    if sub == FounderSubStage.LOCATION_SEARCH:
        return "location"
    if sub in (
        FounderSubStage.LEASE_REVIEW,
        FounderSubStage.BUSINESS_REGISTRATION,
        FounderSubStage.LICENSE_APPLICATION,
    ):
        return "tax"
    if sub in (
        FounderSubStage.HIRING_PREPARATION,
        FounderSubStage.HIRING_IN_PROGRESS,
        FounderSubStage.HIRING_CONTRACT,
    ):
        return "hiring"
    if sub == FounderSubStage.SUBSIDY_ACTIVE:
        return "subsidy"

    return "__end__"


# ── 그래프 빌드 ────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(FounderContext)

    graph.add_node("location", location.run)
    graph.add_node("tax", tax.run)
    graph.add_node("hiring", hiring.run)
    graph.add_node("subsidy", subsidy.run)

    graph.set_conditional_entry_point(route)

    for node in ("location", "tax", "hiring", "subsidy"):
        graph.add_edge(node, END)

    return graph.compile()


# 싱글턴 컴파일된 그래프
_graph = build_graph()


async def run(user_id: str, stage: FounderStage, sub_stage: FounderSubStage) -> dict:
    ctx = FounderContext(user_id=user_id, stage=stage, sub_stage=sub_stage)
    result = await _graph.ainvoke(ctx)
    return result
