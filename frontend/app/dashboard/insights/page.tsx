"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Summary = {
  current_total: number;
  prev_total: number;
  change_pct: number | null;
  yoy_total: number;
  yoy_change_pct: number | null;
  transaction_count: number;
  daily_average: number;
  category_breakdown: Record<string, number>;
  timeslot_breakdown: Record<string, number>;
};

type InsightResult = {
  insight: string;
  summary: Summary;
  rag_used: boolean;
  weather_used?: boolean;
};

type BenchmarkResult = {
  area: string;
  quarter: string;
  user_monthly: number;
  area_avg_per_store: number;
  area_total_monthly: number;
  store_count: number;
  ratio_pct: number | null;
  diff: number;
  error?: string;
};

type MenuRankItem = {
  menu_name: string;
  menu_id: string | null;
  category: string;
  quantity: number;
  amount: number;
};

type MenuSummary = {
  year: number;
  month: number;
  total_amount: number;
  total_quantity: number;
  menu_ranking: MenuRankItem[];
  category_breakdown: Record<string, number>;
};

type MenuAnalysisResult = {
  insight: string | null;
  summary: MenuSummary;
  message?: string;
};

const CATEGORY_ICON: Record<string, string> = {
  음료: "☕",
  디저트: "🍰",
  푸드: "🍱",
  기타: "📦",
};

export default function InsightsPage() {
  const today = new Date();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const [tab, setTab] = useState<"ai" | "menu">("ai");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // AI 분석 탭
  const [result, setResult] = useState<InsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 벤치마킹
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [benchLoading, setBenchLoading] = useState(false);

  // 메뉴별 분석 탭
  const [menuResult, setMenuResult] = useState<MenuAnalysisResult | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/insights/areas`)
      .then((r) => r.json())
      .then((d) => {
        setAreas(d.areas ?? []);
        if (d.areas?.length > 0) setSelectedArea(d.areas[0]);
      })
      .catch(() => {});
  }, [apiUrl]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/insights/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, year, month }),
      });
      if (!res.ok) {
        setError("분석 중 오류가 발생했습니다.");
        return;
      }
      setResult(await res.json());
    } catch {
      setError("백엔드 서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleBenchmark = async () => {
    if (!selectedArea) return;
    setBenchLoading(true);
    setBenchmark(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBenchLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        area: selectedArea,
        year: String(year),
        month: String(month),
      });
      const res = await fetch(`${apiUrl}/insights/benchmark?${params}`);
      setBenchmark(await res.json());
    } catch {
    } finally {
      setBenchLoading(false);
    }
  };

  const handleMenuAnalyze = async () => {
    setMenuLoading(true);
    setMenuError(null);
    setMenuResult(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMenuError("로그인이 필요합니다.");
      setMenuLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        year: String(year),
        month: String(month),
      });
      const res = await fetch(`${apiUrl}/insights/menu-analysis?${params}`);
      if (!res.ok) {
        setMenuError("분석 중 오류가 발생했습니다.");
        return;
      }
      setMenuResult(await res.json());
    } catch {
      setMenuError("백엔드 서버에 연결할 수 없습니다.");
    } finally {
      setMenuLoading(false);
    }
  };

  const changeColor =
    result?.summary.change_pct != null
      ? result.summary.change_pct > 0
        ? "text-green-600"
        : "text-red-500"
      : "text-gray-400";
  const changeSign =
    result?.summary.change_pct != null
      ? result.summary.change_pct > 0
        ? "▲"
        : "▼"
      : "";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">AI 인사이트</h1>
        <p className="text-sm text-gray-500 mt-1">
          매출 데이터를 AI가 분석해 원인과 액션을 제안합니다
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
        {(["ai", "menu"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "ai" ? "✦ AI 매출 분석" : "☕ 메뉴별 분석"}
          </button>
        ))}
      </div>

      {/* 기간 선택 (공통) */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">
          분석 기간 선택
        </h2>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              연도
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500"
            >
              {[today.getFullYear() - 1, today.getFullYear()].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              월
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          {tab === "ai" ? (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {loading ? "분석 중..." : "✦ AI 분석 시작"}
            </button>
          ) : (
            <button
              onClick={handleMenuAnalyze}
              disabled={menuLoading}
              className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {menuLoading ? "분석 중..." : "☕ 메뉴 분석 시작"}
            </button>
          )}
        </div>
        {tab === "ai" && error && (
          <p className="mt-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {tab === "menu" && menuError && (
          <p className="mt-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {menuError}
          </p>
        )}
      </div>

      {/* ── AI 매출 분석 탭 ── */}
      {tab === "ai" && (
        <>
          {/* 벤치마킹 */}
          {areas.length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">
                상권 평균 벤치마킹
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                내 카페 {year}년 {month}월 매출을 선택 상권 카페 평균과
                비교합니다
              </p>
              <div className="flex items-center gap-3 mb-5">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500"
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBenchmark}
                  disabled={benchLoading || !selectedArea}
                  className="px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-gray-700 font-bold text-sm transition-all disabled:opacity-50"
                >
                  {benchLoading ? "조회 중..." : "비교하기"}
                </button>
              </div>
              {benchmark && !benchmark.error && (
                <BenchmarkCard benchmark={benchmark} />
              )}
              {benchmark?.error && (
                <p className="text-xs text-red-500">{benchmark.error}</p>
              )}
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="glass-card rounded-xl p-8 text-center border-brand-500/20">
              <div className="inline-flex items-center gap-3 text-brand-500">
                <span className="animate-pulse text-2xl">✦</span>
                <p className="text-sm font-medium">
                  Claude가 마포구 카페 데이터를 분석하고 있습니다...
                </p>
              </div>
            </div>
          )}

          {/* AI 분석 결과 */}
          {result && !loading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">이번달 매출</p>
                  <p className="text-lg font-bold text-gray-900">
                    {result.summary.current_total.toLocaleString()}원
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">전달 대비</p>
                  <p className={`text-lg font-bold ${changeColor}`}>
                    {result.summary.change_pct != null
                      ? `${changeSign} ${Math.abs(result.summary.change_pct)}%`
                      : "-"}
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">전년 동월 대비</p>
                  <p
                    className={`text-lg font-bold ${result.summary.yoy_change_pct == null ? "text-gray-400" : result.summary.yoy_change_pct > 0 ? "text-green-600" : "text-red-500"}`}
                  >
                    {result.summary.yoy_change_pct != null
                      ? `${result.summary.yoy_change_pct > 0 ? "▲" : "▼"} ${Math.abs(result.summary.yoy_change_pct)}%`
                      : "-"}
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">일 평균</p>
                  <p className="text-lg font-bold text-gray-900">
                    {result.summary.daily_average.toLocaleString()}원
                  </p>
                </div>
              </div>

              <InsightCard
                insight={result.insight}
                ragUsed={result.rag_used}
                weatherUsed={result.weather_used}
                year={year}
                month={month}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">
                    카테고리별 매출
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(result.summary.category_breakdown).map(
                      ([cat, amt]) => {
                        const pct =
                          result.summary.current_total > 0
                            ? Math.round(
                                (amt / result.summary.current_total) * 100,
                              )
                            : 0;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>{cat}</span>
                              <span>
                                {amt.toLocaleString()}원 ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-surface-300 rounded-full">
                              <div
                                className="h-1.5 bg-brand-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">
                    시간대별 매출
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(result.summary.timeslot_breakdown).map(
                      ([slot, amt]) => {
                        const pct =
                          result.summary.current_total > 0
                            ? Math.round(
                                (amt / result.summary.current_total) * 100,
                              )
                            : 0;
                        return (
                          <div key={slot}>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>{slot}</span>
                              <span>
                                {amt.toLocaleString()}원 ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-surface-300 rounded-full">
                              <div
                                className="h-1.5 bg-purple-400 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── 메뉴별 분석 탭 ── */}
      {tab === "menu" && (
        <>
          {/* 로딩 */}
          {menuLoading && (
            <div className="glass-card rounded-xl p-8 text-center">
              <div className="inline-flex items-center gap-3 text-brand-500">
                <span className="animate-pulse text-2xl">☕</span>
                <p className="text-sm font-medium">
                  메뉴별 판매 데이터를 분석하고 있습니다...
                </p>
              </div>
            </div>
          )}

          {/* 데이터 없음 */}
          {menuResult && menuResult.message && (
            <div className="glass-card rounded-xl p-8 text-center space-y-3">
              <p className="text-3xl">📊</p>
              <p className="text-sm font-medium text-gray-700">
                {menuResult.message}
              </p>
              <p className="text-xs text-gray-400">
                매출 입력 시 메뉴를 선택하면 이 탭에서 분석 결과를 확인할 수
                있습니다.
              </p>
            </div>
          )}

          {/* 메뉴 분석 결과 */}
          {menuResult && !menuResult.message && !menuLoading && (
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">총 매출</p>
                  <p className="text-base font-bold text-gray-900">
                    {menuResult.summary.total_amount.toLocaleString()}원
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">총 판매</p>
                  <p className="text-base font-bold text-gray-900">
                    {menuResult.summary.total_quantity}개
                  </p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">메뉴 종류</p>
                  <p className="text-base font-bold text-gray-900">
                    {menuResult.summary.menu_ranking.length}종
                  </p>
                </div>
              </div>

              {/* 메뉴 순위 */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">
                  메뉴별 매출 순위
                </h3>
                <div className="space-y-3">
                  {menuResult.summary.menu_ranking
                    .slice(0, 10)
                    .map((item, i) => {
                      const pct =
                        menuResult.summary.total_amount > 0
                          ? Math.round(
                              (item.amount / menuResult.summary.total_amount) *
                                100,
                            )
                          : 0;
                      const icon = CATEGORY_ICON[item.category] ?? "📦";
                      return (
                        <div key={item.menu_name}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400 w-4 text-right">
                              {i + 1}
                            </span>
                            <span className="text-sm">{icon}</span>
                            <span className="text-sm text-gray-800 flex-1">
                              {item.menu_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {item.quantity}개
                            </span>
                            <span className="text-sm font-bold text-gray-900 w-24 text-right">
                              {item.amount.toLocaleString()}원
                            </span>
                            <span className="text-xs text-gray-400 w-8 text-right">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-surface-200 rounded-full ml-6">
                            <div
                              className="h-1.5 bg-brand-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 카테고리별 */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">
                  카테고리별 매출 비중
                </h3>
                <div className="space-y-2">
                  {Object.entries(menuResult.summary.category_breakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amt]) => {
                      const pct =
                        menuResult.summary.total_amount > 0
                          ? Math.round(
                              (amt / menuResult.summary.total_amount) * 100,
                            )
                          : 0;
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>
                              {CATEGORY_ICON[cat] ?? "📦"} {cat}
                            </span>
                            <span>
                              {amt.toLocaleString()}원 ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 bg-surface-200 rounded-full">
                            <div
                              className="h-2 bg-brand-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* AI 추천 액션 */}
              {menuResult.insight && (
                <div className="glass-card rounded-xl p-6 border-brand-500/20 glow-blue">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-brand-500 text-lg">✦</span>
                    <h2 className="text-base font-bold text-gray-900">
                      AI 메뉴 분석
                    </h2>
                    <span className="ml-auto text-xs text-gray-400">
                      {year}년 {month}월
                    </span>
                  </div>
                  <Md text={menuResult.insight} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function InsightCard({
  insight,
  ragUsed,
  weatherUsed,
  year,
  month,
}: {
  insight: string;
  ragUsed: boolean;
  weatherUsed?: boolean;
  year: number;
  month: number;
}) {
  const normalized = insight.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 면책 고지: "본 내용은 참고용" 문장이 나오는 줄부터 분리
  const disclaimerIdx = normalized.search(/\n본 내용은 참고용/);
  const body = disclaimerIdx >= 0 ? normalized.slice(0, disclaimerIdx).trim() : normalized.trim();
  const disclaimer = disclaimerIdx >= 0 ? normalized.slice(disclaimerIdx).trim() : "";

  // 마케팅 제안 섹션 분리
  const marketingSplit = body.split(/\n(?=## 마케팅 제안)/);
  const mainBody = marketingSplit[0].trim();
  const marketingBody = marketingSplit[1]
    ? marketingSplit[1].replace(/^## 마케팅 제안\n?/, "").trim()
    : null;

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-6 border-brand-500/20 glow-blue">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-brand-500 text-lg">✦</span>
          <span className="text-base font-bold text-gray-900">
            AI 분석 결과
          </span>
          {ragUsed && (
            <span className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2 py-0.5 rounded-full font-medium">
              마포구 실데이터 반영
            </span>
          )}
          {weatherUsed && (
            <span className="text-xs bg-sky-50 text-sky-600 border border-sky-200 px-2 py-0.5 rounded-full font-medium">
              날씨 반영
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {year}년 {month}월
          </span>
        </div>

        {/* 본문 */}
        <Md text={mainBody} />

        {/* 면책 고지 */}
        {disclaimer && (
          <p className="text-xs text-gray-400 pt-4 mt-4 border-t border-surface-200 leading-relaxed">
            {disclaimer}
          </p>
        )}
      </div>

      {/* 마케팅 제안 — 별도 카드 */}
      {marketingBody && (
        <div className="rounded-xl p-6 space-y-3 border border-orange-200 bg-orange-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📣</span>
              <span className="text-base font-bold text-orange-800">
                마케팅 제안
              </span>
              <span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                이번달 데이터 기반
              </span>
            </div>
            <Link
              href="/dashboard/marketing"
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 border border-orange-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              콘텐츠 바로 만들기 →
            </Link>
          </div>
          <Md text={marketingBody} />
        </div>
      )}
    </div>
  );
}

/* ── 마크다운 렌더러 ── */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[0].startsWith("**")
        ? <strong key={m.index} className="font-semibold text-gray-900">{m[2]}</strong>
        : <em key={m.index} className="italic">{m[3]}</em>
    );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Md({ text }: { text: string | null }) {
  if (!text) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let ul: string[] = [], ol: string[] = [], k = 0;

  const flush = () => {
    if (ul.length) {
      nodes.push(<ul key={k++} className="my-3 pl-5 list-disc space-y-1.5">{ul.map((t, i) => <li key={i} className="text-sm text-gray-700 leading-7">{inline(t)}</li>)}</ul>);
      ul = [];
    }
    if (ol.length) {
      nodes.push(<ol key={k++} className="my-3 pl-5 list-decimal space-y-1.5">{ol.map((t, i) => <li key={i} className="text-sm text-gray-700 leading-7">{inline(t)}</li>)}</ol>);
      ol = [];
    }
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flush(); continue; }
    let m: RegExpMatchArray | null;
    if (/^---+$/.test(t)) { flush(); nodes.push(<hr key={k++} className="my-4 border-surface-300" />); continue; }
    if ((m = t.match(/^# (.+)/)))   { flush(); nodes.push(<h1 key={k++} className="text-base font-bold text-gray-900 mt-5 mb-2">{inline(m[1])}</h1>); continue; }
    if ((m = t.match(/^## (.+)/)))  { flush(); nodes.push(<h2 key={k++} className="text-sm font-bold text-brand-600 mt-5 mb-2 pl-3 border-l-4 border-brand-500">{inline(m[1])}</h2>); continue; }
    if ((m = t.match(/^### (.+)/))) { flush(); nodes.push(<h3 key={k++} className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4 mb-1.5">{inline(m[1])}</h3>); continue; }
    if ((m = t.match(/^[-*] (.+)/)))  { ol.length && flush(); ul.push(m[1]); continue; }
    if ((m = t.match(/^\d+\. (.+)/))) { ul.length && flush(); ol.push(m[1]); continue; }
    flush();
    nodes.push(<p key={k++} className="text-sm text-gray-700 leading-7 my-2">{inline(t)}</p>);
  }
  flush();
  return <div className="space-y-0.5">{nodes}</div>;
}

function BenchmarkCard({ benchmark }: { benchmark: BenchmarkResult }) {
  const {
    user_monthly,
    area_avg_per_store,
    ratio_pct,
    diff,
    area,
    quarter,
    store_count,
  } = benchmark;
  const isAbove = diff >= 0;
  const maxVal = Math.max(user_monthly, area_avg_per_store) || 1;
  const userBarWidth = Math.round((user_monthly / maxVal) * 100);
  const avgBarWidth = Math.round((area_avg_per_store / maxVal) * 100);
  const quarterLabel = `${quarter.slice(0, 4)}년 ${quarter.slice(4)}분기`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {area} · {quarterLabel} 기준 ({store_count}개 카페 평균)
        </span>
        {ratio_pct != null && (
          <span
            className={`font-bold text-sm ${isAbove ? "text-green-600" : "text-red-500"}`}
          >
            {isAbove ? "▲" : "▼"} 평균의 {ratio_pct}%
          </span>
        )}
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1.5">
          <span className="font-medium">내 카페</span>
          <span className="font-bold text-gray-900">
            {user_monthly.toLocaleString()}원
          </span>
        </div>
        <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${isAbove ? "bg-green-500" : "bg-red-400"}`}
            style={{ width: `${userBarWidth}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1.5">
          <span className="font-medium">상권 평균</span>
          <span className="text-gray-500">
            {area_avg_per_store.toLocaleString()}원
          </span>
        </div>
        <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
          <div
            className="h-3 bg-gray-400 rounded-full transition-all"
            style={{ width: `${avgBarWidth}%` }}
          />
        </div>
      </div>
      <div
        className={`rounded-lg px-4 py-3 text-sm font-medium ${isAbove ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
      >
        상권 평균 대비{" "}
        <span className="font-bold">{Math.abs(diff).toLocaleString()}원</span>{" "}
        {isAbove ? "초과" : "미달"}
        {user_monthly === 0 && (
          <span className="ml-2 text-xs font-normal opacity-70">
            (이번달 매출 데이터를 먼저 입력해주세요)
          </span>
        )}
      </div>
    </div>
  );
}
