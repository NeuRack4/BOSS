"""
AI 인사이트 API
- 매출 데이터 + RAG(마포구 카페 통계) + Claude API → 근거 기반 원인 분석 및 액션 제안
- 매출 변화 감지 시 trigger_log 자동 생성 (Proactive 트리거)
"""
import re
import anthropic
from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.core.config import get_settings
from backend.core.constants import LEGAL_DISCLAIMER, TriggerType
from backend.core.holidays import get_month_holidays
from backend.api.routers.sales import get_sales_summary
from backend.api.routers.expenses import get_expense_summary
from backend.db.client import get_supabase
from backend.rag.retriever.pgvector_retriever import retrieve_mapo_stats, retrieve_strategy, retrieve_docs

router = APIRouter()

_SYSTEM_PROMPT = """
당신은 서울 마포구 카페 1인 창업자 전담 AI 비서입니다.
창업자의 매출 데이터와 아래 참고 데이터를 바탕으로 분석합니다.

참고 데이터 종류:
- [마포구 카페 상권 통계]: 상권별 추정매출·점포수·개폐업률
- [마포구 유동인구]: 시간대별·요일별·연령대별 유동인구 수
- [마포구 상권변화지표]: HH(핵심)/HL(목적형)/LH(경쟁과열)/LL(침체) 상권 등급
- [소상공인 경영 전략 가이드]: 매출 상황별 실행 전략
- [날씨 정보]: 강수일·평균기온·비 온 날 매출
- [공휴일 정보]: 해당 월 공휴일 목록

분석 시 아래 기준으로 답변하세요:
- 위 참고 데이터의 수치를 직접 인용해 근거를 구체적으로 제시
- 유동인구 피크 시간대·요일을 매출 패턴과 연결해 분석
- 상권 등급(HH/HL/LH/LL)이 있으면 창업자 상황에 맞게 해석
- 계절성·공휴일·날씨 영향을 반드시 고려
- 1인 운영 특성 (체력·시간 한계) 감안
- 답변은 한국어, 친근하고 간결하게

답변은 반드시 아래 4개 섹션을 순서대로 작성하세요.
각 섹션은 정확히 아래 헤더 텍스트로 시작해야 합니다:

## 핵심 요약
1~2문장. 이번달 매출이 마포구 평균 대비 어느 위치인지 포함.

## 원인 분석
2~3줄. 참고 데이터 수치를 직접 인용해 근거 제시.

## 추천 액션
번호 목록으로 3가지. 각 항목은 아래 기준으로 작성:
- 1인 운영자가 당장 실행 가능한 구체적 행동
- 마케팅 항목은 반드시 포함: 어떤 플랫폼(인스타그램·블로그 등)에, 어떤 요일과 시간에, 어떤 내용으로 게시할지 구체적으로 명시
  예시: "인스타그램에 매주 금요일 오전 10시에 주말 특선 음료 사진을 올리세요. 캡션은 '이번 주말 홍대 카페 추천' 해시태그와 함께 3줄 이내로"

## 마케팅 제안
반드시 아래 3가지를 포함:
- **추천 홍보 메뉴**: 이번달 매출·카테고리 데이터 기반으로 지금 홍보하면 효과적인 메뉴 1~2개와 이유
- **채널 & 타이밍**: 인스타그램·블로그·오프라인 중 어떤 채널이 적합한지, 구체적인 요일과 시간대(예: 목요일 저녁 8시)를 명시해 게시 타이밍 제안
- **콘텐츠 방향**: 실제 캡션 예시 또는 게시물 구성 방법을 1~2줄로 구체적으로 제안 (해시태그 포함)
"""


class InsightRequest(BaseModel):
    user_id: str
    year: int
    month: int


def _build_rag_queries(month: int, change_pct: float | None) -> list[str]:
    """상황에 맞는 RAG 검색 쿼리 목록 생성"""
    queries = [f"마포구 카페 {month}월 매출 계절 패턴"]

    if change_pct is None:
        queries.append("마포구 카페 월평균 매출 권역별 통계")
    elif change_pct <= -10:
        queries.append("카페 매출 하락 원인 회복 전략")
        queries.append("마포구 카페 비수기 대응")
    elif change_pct >= 10:
        queries.append("카페 매출 상승 유지 전략")
        queries.append("마포구 카페 성수기 매출 확대")
    else:
        queries.append("마포구 카페 매출 안정 유지 전략")

    return queries


async def _retrieve_rag_context(month: int, change_pct: float | None) -> str:
    """RAG에서 마포구 통계 + 유동인구 + 상권변화지표 + 전략 가이드를 검색해 컨텍스트로 반환"""
    import asyncio as _asyncio
    queries = _build_rag_queries(month, change_pct)

    # 상황별 쿼리
    if change_pct is not None and change_pct <= -10:
        strategy_query = "카페 매출 하락 회복 전략 비수기 대응 메뉴 마케팅"
        pop_query = f"마포구 카페 {month}월 유동인구 시간대 요일 비수기"
    elif change_pct is not None and change_pct >= 10:
        strategy_query = "카페 매출 상승 유지 성수기 확대 전략"
        pop_query = f"마포구 카페 {month}월 유동인구 시간대 요일 성수기"
    else:
        strategy_query = f"카페 {month}월 운영 전략 안정 유지"
        pop_query = f"마포구 카페 {month}월 유동인구 시간대 요일"

    commercial_query = f"마포구 상권변화지표 카페 {month}월 상권 등급"

    # 1) mapo_stats 검색 (카테고리 내 중복 제거)
    stats_chunks: list[str] = []
    stats_seen: set = set()
    for query in queries:
        try:
            docs = await retrieve_mapo_stats(query=query, match_count=3, match_threshold=0.5)
            for doc in docs:
                if doc.get("id") not in stats_seen:
                    stats_seen.add(doc.get("id"))
                    stats_chunks.append(doc["content"])
        except Exception as e:
            print(f"[insights] mapo_stats RAG 실패 (query={query}): {e}")

    # 2) 유동인구 + 상권변화지표 + strategy 병렬 검색 (카테고리가 다르므로 seen_ids 공유 안 함)
    async def _search(query: str, category: str, count: int = 3, threshold: float = 0.25) -> list[dict]:
        try:
            print(f"[RAG 검색] category={category} query={query[:40]} threshold={threshold}")
            results = await retrieve_docs(query=query, category=category, match_count=count, match_threshold=threshold)
            print(f"[RAG 검색] category={category} → {len(results)}개 반환")
            return results
        except Exception as e:
            import traceback
            print(f"[insights] {category} RAG 실패: {e}")
            traceback.print_exc()
            return []

    pop_docs, commercial_docs, strategy_docs = await _asyncio.gather(
        _search(pop_query,        "mapo_population",        count=3, threshold=0.25),
        _search(commercial_query, "mapo_commercial_change", count=2, threshold=0.25),
        _search(strategy_query,   "strategy",               count=3, threshold=0.25),
    )

    pop_chunks: list[str] = []
    pop_seen: set = set()
    for doc in pop_docs:
        if doc.get("id") not in pop_seen:
            pop_seen.add(doc.get("id"))
            pop_chunks.append(doc["content"])

    commercial_chunks: list[str] = []
    comm_seen: set = set()
    for doc in commercial_docs:
        if doc.get("id") not in comm_seen:
            comm_seen.add(doc.get("id"))
            commercial_chunks.append(doc["content"])

    strategy_chunks: list[str] = []
    strat_seen: set = set()
    for doc in strategy_docs:
        if doc.get("id") not in strat_seen:
            strat_seen.add(doc.get("id"))
            strategy_chunks.append(doc["content"])

    # 섹션별로 조합
    parts: list[str] = []
    if stats_chunks:
        parts.append("[마포구 카페 상권 통계]\n" + "\n\n".join(f"• {c}" for c in stats_chunks))
    if pop_chunks:
        parts.append("[마포구 유동인구]\n" + "\n\n".join(f"• {c}" for c in pop_chunks))
    if commercial_chunks:
        parts.append("[마포구 상권변화지표]\n" + "\n\n".join(f"• {c}" for c in commercial_chunks))
    if strategy_chunks:
        parts.append("[소상공인 경영 전략 가이드]\n" + "\n\n".join(f"• {c}" for c in strategy_chunks))

    # RAG 주입 청크 요약 로그
    print(f"[RAG 주입] mapo_stats={len(stats_chunks)}개 / mapo_population={len(pop_chunks)}개 / mapo_commercial_change={len(commercial_chunks)}개 / strategy={len(strategy_chunks)}개")
    for i, c in enumerate(stats_chunks):
        print(f"  [mapo_stats {i+1}] {c[:120]}")
    for i, c in enumerate(pop_chunks):
        print(f"  [population {i+1}] {c[:120]}")
    for i, c in enumerate(commercial_chunks):
        print(f"  [commercial {i+1}] {c[:120]}")
    for i, c in enumerate(strategy_chunks):
        print(f"  [strategy  {i+1}] {c[:120]}")

    return "\n\n".join(parts)


def _get_weather_context(year: int, month: int, entries: list[dict]) -> str:
    """weather_data 테이블에서 해당 월 날씨를 조회하고 매출과 상관 분석 후 텍스트로 반환"""
    import calendar
    from datetime import date

    supabase = get_supabase()
    _, last_day = calendar.monthrange(year, month)
    from_date = date(year, month, 1)
    to_date = date(year, month, last_day)

    try:
        rows = (
            supabase.table("weather_data")
            .select("date, avg_temp, rain_mm, is_rainy")
            .gte("date", str(from_date))
            .lte("date", str(to_date))
            .execute()
            .data
        )
    except Exception as e:
        print(f"[insights] weather_data 조회 실패: {e}")
        return ""

    if not rows:
        return ""

    # 날짜 → 매출 맵
    sales_map: dict[str, int] = {e["date"]: e["amount"] for e in entries}

    rainy_sales: list[int] = []
    clear_sales: list[int] = []
    temps: list[float] = []
    rain_days = 0

    for w in rows:
        d = w["date"]
        if isinstance(d, str):
            d_str = d[:10]
        else:
            d_str = str(d)

        if w.get("avg_temp") is not None:
            temps.append(float(w["avg_temp"]))

        is_rainy = w.get("is_rainy", False)
        if is_rainy:
            rain_days += 1

        if d_str in sales_map:
            amount = sales_map[d_str]
            if is_rainy:
                rainy_sales.append(amount)
            else:
                clear_sales.append(amount)

    total_days = len(rows)
    clear_days = total_days - rain_days
    avg_temp = round(sum(temps) / len(temps), 1) if temps else None

    lines = [f"[날씨 정보] {year}년 {month}월"]
    lines.append(
        f"- 강수일: {rain_days}일 / 맑은 날: {clear_days}일"
        + (f" / 평균기온: {avg_temp}°C" if avg_temp is not None else "")
    )

    if rainy_sales:
        avg_rainy = round(sum(rainy_sales) / len(rainy_sales))
        lines.append(f"- 비 온 날 평균 매출: {avg_rainy:,}원 ({len(rainy_sales)}일 기준)")
    if clear_sales:
        avg_clear = round(sum(clear_sales) / len(clear_sales))
        lines.append(f"- 맑은 날 평균 매출: {avg_clear:,}원 ({len(clear_sales)}일 기준)")

    if rainy_sales and clear_sales:
        diff = avg_clear - avg_rainy
        if diff > 0:
            lines.append(f"- 맑은 날이 비 온 날보다 평균 {diff:,}원 높음")
        else:
            lines.append(f"- 비 온 날이 맑은 날보다 평균 {abs(diff):,}원 높음")

    return "\n".join(lines)


@router.post("/analyze")
async def analyze_sales(req: InsightRequest):
    """매출 데이터 기반 RAG + LLM 인사이트 생성"""
    settings = get_settings()

    # 매출 요약 데이터 조회
    summary = await get_sales_summary(
        user_id=req.user_id,
        year=req.year,
        month=req.month,
    )

    # 데이터 없으면 안내 반환
    if summary["current_total"] == 0:
        return {
            "insight": "아직 이번달 매출 데이터가 없습니다. 매출을 입력하면 AI 분석을 시작합니다.",
            "summary": summary,
        }

    change_pct = summary["change_pct"]
    yoy_change_pct = summary["yoy_change_pct"]

    # 비용 요약 조회
    expense_summary = await get_expense_summary(
        user_id=req.user_id,
        year=req.year,
        month=req.month,
    )
    net_profit = summary["current_total"] - expense_summary["total_expenses"]

    # RAG 검색 — 마포구 카페 통계 + strategy 컨텍스트 수집 (병렬)
    import asyncio as _asyncio
    rag_context, weather_context = await _asyncio.gather(
        _retrieve_rag_context(req.month, change_pct),
        _asyncio.get_event_loop().run_in_executor(
            None,
            lambda: _get_weather_context(req.year, req.month, summary.get("entries", [])),
        ),
    )

    # LLM에 넘길 컨텍스트 구성
    change_text = (
        f"전달 대비 {abs(change_pct)}% {'증가' if change_pct > 0 else '감소'}"
        if change_pct is not None
        else "전달 데이터 없음"
    )
    yoy_text = (
        f"전년 동월 대비 {abs(yoy_change_pct)}% {'증가' if yoy_change_pct > 0 else '감소'}"
        if yoy_change_pct is not None
        else "전년 데이터 없음"
    )

    # 비용 섹션 구성
    expense_section = ""
    if expense_summary["total_expenses"] > 0:
        breakdown_lines = "\n".join(
            f"- {cat}: {amt:,}원"
            for cat, amt in expense_summary["breakdown"].items()
        )
        expense_section = f"""
[이번달 비용 현황]
- 총 지출: {expense_summary['total_expenses']:,}원
{breakdown_lines}
- 순수익: {net_profit:,}원
"""

    rag_section = f"\n{rag_context}\n" if rag_context else ""

    # 해당 월 공휴일 목록 → 프롬프트 컨텍스트
    month_holidays = get_month_holidays(req.year, req.month)
    holiday_section = ""
    if month_holidays:
        holiday_lines = ", ".join(
            f"{date[-4:][:2]}일 {name}"
            for date, name in sorted(month_holidays.items())
        )
        holiday_section = f"\n[공휴일 정보] {req.month}월 공휴일: {holiday_lines}\n"

    weather_section = f"\n{weather_context}\n" if weather_context else ""

    user_message = f"""
[{req.year}년 {req.month}월 매출 현황]
- 이번달 총 매출: {summary['current_total']:,}원
- 전달 총 매출: {summary['prev_total']:,}원
- 전달 대비: {change_text}
- 전년 동월 총 매출: {summary['yoy_total']:,}원
- 전년 동월 대비: {yoy_text}
- 거래 건수: {summary['transaction_count']}건
- 일 평균 매출: {summary['daily_average']:,}원

[카테고리별 매출]
{chr(10).join(f"- {k}: {v:,}원" for k, v in summary['category_breakdown'].items())}

[시간대별 매출]
{chr(10).join(f"- {k}: {v:,}원" for k, v in summary['timeslot_breakdown'].items())}
{expense_section}{holiday_section}{weather_section}{rag_section}
위 데이터를 바탕으로 마포구 카페 창업자에게 실질적인 인사이트와 액션을 제안해주세요.
""".strip()

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=8000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    insight_text = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"

    # Proactive 트리거 — 매출 변화 감지 시 trigger_log 자동 생성
    triggered = False
    if change_pct is not None:
        try:
            _insert_sales_change_trigger(
                user_id=req.user_id,
                change_pct=change_pct,
                year=req.year,
                month=req.month,
            )
            triggered = True
        except Exception as e:
            print(f"[insights] trigger_log insert 실패: {e}")

    return {
        "insight": insight_text,
        "summary": summary,
        "triggered": triggered,
        "rag_used": bool(rag_context),
        "weather_used": bool(weather_context),
        "net_profit": net_profit,
        "total_expenses": expense_summary["total_expenses"],
    }


def _month_to_quarter(year: int, month: int) -> str:
    """연월 → 분기 코드 (예: 2024, 4 → '20242')"""
    q = (month - 1) // 3 + 1
    return f"{year}{q}"


def _get_latest_available_quarter(supabase) -> str:
    """documents 테이블에서 mapo_stats 최신 분기 반환 (분기 코드 내림차순)"""
    result = (
        supabase.table("documents")
        .select("metadata")
        .eq("category", "mapo_stats")
        .execute()
    )
    quarters = [
        r["metadata"]["quarter"]
        for r in (result.data or [])
        if r.get("metadata", {}).get("quarter")
    ]
    return max(quarters) if quarters else "20244"


@router.get("/areas")
def get_benchmark_areas():
    """벤치마킹 가능한 마포구 상권 목록 반환"""
    supabase = get_supabase()
    result = (
        supabase.table("documents")
        .select("metadata")
        .eq("category", "mapo_stats")
        .eq("metadata->>data_type", "sales")
        .execute()
    )
    areas = sorted({row["metadata"]["area"] for row in (result.data or []) if row.get("metadata", {}).get("area")})
    return {"areas": areas}


@router.get("/benchmark")
async def get_benchmark(
    user_id: str = Query(...),
    area: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
):
    """
    선택 상권 카페 평균 매출 vs 내 카페 매출 비교
    - area: 상권명 (예: '홍대입구역(홍대)')
    - year/month: 비교 기준 연월
    """
    supabase = get_supabase()

    # 요청 분기 → 없으면 최신 분기로 폴백
    requested_q = _month_to_quarter(year, month)
    # 해당 분기 데이터 있는지 확인
    check = (
        supabase.table("documents")
        .select("id")
        .eq("category", "mapo_stats")
        .eq("metadata->>quarter", requested_q)
        .limit(1)
        .execute()
    )
    quarter = requested_q if check.data else _get_latest_available_quarter(supabase)

    # 해당 상권 sales 문서 조회
    sales_docs = (
        supabase.table("documents")
        .select("content")
        .eq("category", "mapo_stats")
        .eq("metadata->>data_type", "sales")
        .eq("metadata->>area", area)
        .eq("metadata->>quarter", quarter)
        .execute()
        .data or []
    )

    # 해당 상권 stores 문서 조회
    stores_docs = (
        supabase.table("documents")
        .select("content")
        .eq("category", "mapo_stats")
        .eq("metadata->>data_type", "stores")
        .eq("metadata->>area", area)
        .eq("metadata->>quarter", quarter)
        .execute()
        .data or []
    )

    if not sales_docs:
        return {"error": f"'{area}' 상권의 {quarter} 데이터가 없습니다.", "quarter": quarter}

    # 월 매출금액 파싱
    area_monthly_total = 0
    for doc in sales_docs:
        m = re.search(r"월 매출금액:\s*([\d,]+)원", doc["content"])
        if m:
            area_monthly_total += int(m.group(1).replace(",", ""))

    # 점포수 파싱
    store_count = 0
    for doc in stores_docs:
        m = re.search(r"점포수:\s*(\d+)개", doc["content"])
        if m:
            store_count += int(m.group(1))

    area_avg_per_store = round(area_monthly_total / store_count) if store_count > 0 else area_monthly_total

    # 사용자 해당 월 매출
    summary = await get_sales_summary(user_id=user_id, year=year, month=month)
    user_monthly = summary["current_total"]

    ratio_pct = round((user_monthly / area_avg_per_store) * 100, 1) if area_avg_per_store > 0 else None
    diff = user_monthly - area_avg_per_store

    return {
        "area": area,
        "quarter": quarter,
        "user_monthly": user_monthly,
        "area_avg_per_store": area_avg_per_store,
        "area_total_monthly": area_monthly_total,
        "store_count": store_count,
        "ratio_pct": ratio_pct,       # 100% = 상권 평균과 동일
        "diff": diff,                  # 양수 = 평균 초과, 음수 = 평균 미달
    }


@router.get("/menu-analysis")
async def analyze_menus(
    user_id: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
):
    """메뉴별 매출 분석 + AI 추천 액션 (sales_items 기반)"""
    import calendar as _cal
    from datetime import date as _date

    settings = get_settings()
    supabase = get_supabase()

    _, last_day = _cal.monthrange(year, month)
    from_date = _date(year, month, 1)
    to_date = _date(year, month, last_day)

    rows = (
        supabase.table("sales_items")
        .select("menu_name, menu_id, category, quantity, amount, date, time_slot")
        .eq("user_id", user_id)
        .gte("date", str(from_date))
        .lte("date", str(to_date))
        .execute()
        .data or []
    )

    if not rows:
        return {
            "insight": None,
            "summary": {
                "year": year, "month": month,
                "total_amount": 0, "total_quantity": 0,
                "menu_ranking": [], "category_breakdown": {},
            },
            "message": "아직 메뉴별 매출 데이터가 없습니다. 매출 입력 시 메뉴를 선택하면 분석이 시작됩니다.",
        }

    # 집계
    menu_agg: dict[str, dict] = {}
    category_agg: dict[str, int] = {}
    for r in rows:
        name = r["menu_name"]
        if name not in menu_agg:
            menu_agg[name] = {
                "menu_name": name, "menu_id": r.get("menu_id"),
                "category": r.get("category", "기타"),
                "quantity": 0, "amount": 0,
            }
        menu_agg[name]["quantity"] += r["quantity"]
        menu_agg[name]["amount"]   += r["amount"]
        cat = r.get("category") or "기타"
        category_agg[cat] = category_agg.get(cat, 0) + r["amount"]

    ranking = sorted(menu_agg.values(), key=lambda x: x["amount"], reverse=True)
    total_amount = sum(r["amount"] for r in rows)
    total_quantity = sum(r["quantity"] for r in rows)
    top_menus = ranking[:7]

    summary = {
        "year": year, "month": month,
        "total_amount": total_amount,
        "total_quantity": total_quantity,
        "menu_ranking": ranking,
        "category_breakdown": category_agg,
    }

    # Claude 분석
    menu_lines = "\n".join(
        f"{i+1}. {m['menu_name']} ({m['category']}) — {m['quantity']}잔 · {m['amount']:,}원"
        f" ({round(m['amount'] / total_amount * 100) if total_amount else 0}%)"
        for i, m in enumerate(top_menus)
    )
    cat_lines = "\n".join(
        f"- {cat}: {amt:,}원 ({round(amt / total_amount * 100) if total_amount else 0}%)"
        for cat, amt in sorted(category_agg.items(), key=lambda x: -x[1])
    )

    user_message = f"""
[{year}년 {month}월 메뉴별 매출 현황]
총 매출: {total_amount:,}원 / 총 판매: {total_quantity}개 / 메뉴 종류: {len(ranking)}종

[매출 순위 TOP {len(top_menus)}]
{menu_lines}

[카테고리별 매출]
{cat_lines}

위 데이터를 바탕으로 다음을 분석해줘:
1. 주력 메뉴 집중도 (상위 3개 메뉴 매출 비중)
2. 카테고리 구성 평가 (음료·디저트 비중이 적절한가)
3. 판매 다양화 or 집중 전략 중 어떤 방향이 유리한지
4. 구체적 액션 2~3가지 (메뉴 조정, 가격, 마케팅 포함)
""".strip()

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=get_settings().claude_model,
        max_tokens=8000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    insight_text = message.content[0].text + f"\n\n---\n{LEGAL_DISCLAIMER}"

    return {"insight": insight_text, "summary": summary}


def _insert_sales_change_trigger(user_id: str, change_pct: float, year: int, month: int) -> None:
    """매출 변화 감지 → trigger_log 자동 삽입 (상승/하락 모두)"""
    supabase = get_supabase()
    if change_pct > 0:
        message = (
            f"[매출 상승 감지] {year}년 {month}월 매출이 전달 대비 "
            f"{change_pct:.1f}% 증가했습니다. "
            "AI 인사이트에서 상승 원인과 유지 전략을 확인해보세요."
        )
    else:
        message = (
            f"[매출 하락 감지] {year}년 {month}월 매출이 전달 대비 "
            f"{abs(change_pct):.1f}% 하락했습니다. "
            "AI 인사이트에서 원인 분석과 회복 전략을 확인해보세요."
        )
    supabase.table("trigger_log").insert({
        "user_id": user_id,
        "trigger_type": TriggerType.INFERENCE,
        "message": message,
    }).execute()
