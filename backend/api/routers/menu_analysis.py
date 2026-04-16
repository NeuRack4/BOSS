"""
메뉴 분석 API
- 재료 중복 분석: 공유 재료 시각화 + 파생 메뉴 추천
- 메뉴 복잡도 경고: 메뉴별 복잡도 점수 + 제거 권장
- 재고 단순화 제안: 재료 그룹핑 + 통합 전략
"""
import json
import logging
import traceback
import anthropic
from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_current_user_id
from backend.core.config import get_settings
from backend.db.client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter()

_SYSTEM_PROMPT = """당신은 10년 경력의 카페 운영 컨설턴트입니다.
메뉴 구성을 분석하여 운영 효율, 재고 관리, 수익성 관점에서 구체적이고 실질적인 조언을 제공합니다.
반드시 JSON만 응답하세요. 설명 텍스트 없이 JSON 객체만 출력하세요."""

# ── 1차 호출: 메뉴별 재료 + 복잡도 분석 ──────────────────────────────────
_PROMPT1_PREFIX = "다음은 한국 카페의 메뉴 목록입니다:\n"
_PROMPT1_SUFFIX = """
각 메뉴의 재료와 복잡도를 분석하고, 아래 JSON 구조로만 응답하세요.

{
  "overall_insight": "전체 메뉴 구성 종합 평가. 강점·약점·핵심 개선 방향 3~5문장.",
  "menu_ingredients": [
    {
      "menu_name": "메뉴명",
      "ingredients": ["재료1", "재료2"],
      "complexity_score": 3,
      "complexity_label": "보통",
      "complexity_reason": "복잡도 이유 1문장.",
      "is_removal_candidate": false,
      "removal_reason": null
    }
  ],
  "complexity_summary": {
    "level": "높음",
    "warning": true,
    "main_issues": ["문제점1", "문제점2"],
    "removal_candidates": ["메뉴명1"],
    "removal_benefit": "제거 시 기대 효과 1~2문장."
  }
}

기준: complexity_score 1(단순)~5(복잡), complexity_label은 1~2→단순/3→보통/4~5→복잡,
is_removal_candidate는 다른 메뉴와 재료 중복 없거나 복잡도 대비 메리트가 낮은 메뉴.
"""

# ── 2차 호출: 재료 중복 + 재고 단순화 + 파생 메뉴 ────────────────────────
_PROMPT2_TEMPLATE = """다음은 한국 카페 메뉴와 재료 목록입니다:
{menu_ingredients_text}

아래 3가지를 분석하고 JSON 구조로만 응답하세요.

{
  "ingredient_overlap": [
    {
      "ingredient": "재료명",
      "menus": ["메뉴1", "메뉴2"],
      "count": 2,
      "storage_type": "냉장",
      "storage_tip": "보관 주의사항 1문장.",
      "overlap_insight": "운영 시너지 1문장."
    }
  ],
  "simplification_groups": [
    {
      "group_name": "그룹명 (예: 에스프레소 베이스)",
      "menus": ["메뉴1", "메뉴2"],
      "shared_ingredients": ["공유재료1"],
      "each_unique": {"메뉴1": ["고유재료A"], "메뉴2": ["고유재료B"]},
      "consolidation_tip": "통합 구매·관리 방법 2문장.",
      "expected_benefit": "기대 효과 (원가 절감, 재고 낭비 감소 등)."
    }
  ],
  "derived_suggestions": [
    {
      "name": "파생 메뉴명",
      "base_ingredients": ["기존재료1", "기존재료2"],
      "new_ingredient": null,
      "operational_benefit": "운영 이점 1문장.",
      "target_customer": "타겟 고객층",
      "reason": "추천 이유 2문장."
    }
  ]
}

기준: ingredient_overlap은 2개 이상 메뉴에서 쓰이는 재료만, storage_type은 냉장/냉동/상온 중 하나,
simplification_groups는 재료 2개 이상 공유 묶음 위주, derived_suggestions는 3~5개.
"""


@router.post("/analyze")
async def analyze_menus(user_id: str = Depends(get_current_user_id)):
    """등록된 활성 메뉴를 AI가 심층 분석 — 재료 중복·복잡도·재고 단순화 3가지 핵심 분석"""
    supabase = get_supabase()
    menus = (
        supabase.table("menus")
        .select("name, category")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
        .data
        or []
    )

    if not menus:
        raise HTTPException(
            status_code=400,
            detail="분석할 활성 메뉴가 없습니다. 먼저 메뉴를 등록해주세요.",
        )

    menu_list = "\n".join(f"- {m['name']} ({m['category']})" for m in menus)

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    def parse_json(raw: str, label: str) -> dict:
        raw = raw.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError as e:
            logger.error(f"[menu_analysis] {label} JSON 파싱 실패. raw='{raw[:300]}' err={e}")
            raise HTTPException(status_code=500, detail=f"AI 응답 파싱 실패 ({label}). 다시 시도해주세요.")

    # ── 1차 호출: 메뉴별 재료 + 복잡도 ──────────────────────────────
    try:
        msg1 = await client.messages.create(
            model=settings.claude_model,
            max_tokens=8000,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _PROMPT1_PREFIX + menu_list + _PROMPT1_SUFFIX}],
        )
    except Exception as e:
        logger.error(f"[menu_analysis] 1차 호출 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"AI 분석 중 오류: {str(e)}")

    data1 = parse_json(msg1.content[0].text, "1차")
    menu_ingredients: list[dict] = data1.get("menu_ingredients", [])

    # 복잡도 수치 보완
    all_ings: set[str] = set()
    total_count = 0
    for item in menu_ingredients:
        ings = item.get("ingredients", [])
        all_ings.update(ings)
        total_count += len(ings)

    summary = data1.get("complexity_summary", {})
    summary["total_menus"] = len(menu_ingredients)
    summary["total_unique_ingredients"] = len(all_ings)
    summary["avg_ingredients_per_menu"] = (
        round(total_count / len(menu_ingredients), 1) if menu_ingredients else 0
    )

    # ── 2차 호출: 재료 중복 + 단순화 + 파생 메뉴 ────────────────────
    menu_ingredients_text = "\n".join(
        f"- {item['menu_name']}: {', '.join(item.get('ingredients', []))}"
        for item in menu_ingredients
    )
    try:
        msg2 = await client.messages.create(
            model=settings.claude_model,
            max_tokens=8000,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _PROMPT2_TEMPLATE.replace("{menu_ingredients_text}", menu_ingredients_text)}],
        )
    except Exception as e:
        logger.error(f"[menu_analysis] 2차 호출 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"AI 분석 중 오류: {str(e)}")

    data2 = parse_json(msg2.content[0].text, "2차")

    return {
        "overall_insight": data1.get("overall_insight", ""),
        "menu_ingredients": menu_ingredients,
        "ingredient_overlap": data2.get("ingredient_overlap", []),
        "complexity_summary": summary,
        "simplification_groups": data2.get("simplification_groups", []),
        "derived_suggestions": data2.get("derived_suggestions", []),
    }
