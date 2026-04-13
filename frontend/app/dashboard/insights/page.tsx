"use client";

import { useState } from "react";
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
};

export default function InsightsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [result, setResult] = useState<InsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/insights/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, year, month }),
    });

    if (!res.ok) {
      setError("분석 중 오류가 발생했습니다. 백엔드 서버를 확인해주세요.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setResult(data);
    setLoading(false);
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
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">AI 인사이트</h1>
        <p className="text-sm text-gray-500 mt-1">
          매출 데이터를 AI가 분석해 원인과 액션을 제안합니다
        </p>
      </div>

      {/* 분석 요청 카드 */}
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
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "분석 중..." : "✦ AI 분석 시작"}
          </button>
        </div>
        {error && (
          <p className="mt-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

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

      {/* 결과 */}
      {result && !loading && (
        <>
          {/* 매출 요약 카드 */}
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
                className={`text-lg font-bold ${
                  result.summary.yoy_change_pct == null
                    ? "text-gray-400"
                    : result.summary.yoy_change_pct > 0
                      ? "text-green-600"
                      : "text-red-500"
                }`}
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

          {/* AI 인사이트 */}
          <div className="glass-card rounded-xl p-6 border-brand-500/20 glow-blue">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-brand-500 text-lg">✦</span>
              <h2 className="text-base font-bold text-gray-900">
                AI 분석 결과
              </h2>
              {result.rag_used && (
                <span className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2 py-0.5 rounded-full font-medium">
                  마포구 실데이터 반영
                </span>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {year}년 {month}월
              </span>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result.insight}
            </div>
          </div>

          {/* 카테고리 / 시간대 분석 */}
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
                        ? Math.round((amt / result.summary.current_total) * 100)
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
                        ? Math.round((amt / result.summary.current_total) * 100)
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
    </div>
  );
}
