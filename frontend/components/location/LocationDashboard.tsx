"use client";

import { useState, useEffect } from "react";
import DistrictSelector from "./DistrictSelector";
import TopPickCards from "./TopPickCards";
import ScoreRadarChart from "./ScoreRadarChart";
import SurvivalBarChart from "./SurvivalBarChart";
import LlmReportPanel from "./LlmReportPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface DistrictScore {
  district: string;
  saturation_index: number;
  estimated_monthly_revenue: number;
  bep_months: number;
  survival_score: number;
  growth_score: number;
  total_score: number;
  risk_level: "LOW" | "MED" | "HIGH";
}

export interface AnalyzeResult {
  top_pick: string;
  scores: DistrictScore[];
  llm_report: string;
  cached: boolean;
  analyzed_at: string;
}

interface HistoryRecord {
  id: number;
  districts: string[];
  top_pick: string | null;
  searched_at: string;
}

export default function LocationDashboard() {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/location/history`);
      if (res.ok) {
        const data: HistoryRecord[] = await res.json();
        setHistory(data);
      }
    } catch {
      // 이력 로딩 실패는 조용히 처리
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/location/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districts: selected.length > 0 ? selected : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `서버 오류 (${res.status})`);
      }
      const data: AnalyzeResult = await res.json();
      setResult(data);
      fetchHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 상권 선택 + 분석 버튼 */}
      <div className="bg-surface-200/10 border border-white/10 rounded-2xl p-6 space-y-5">
        <DistrictSelector selected={selected} onChange={setSelected} />
        <div className="flex items-center gap-4">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50
                       disabled:cursor-not-allowed text-white font-semibold rounded-xl
                       transition-colors text-sm"
          >
            {loading ? "분석 중…" : "분석 실행"}
          </button>
          {selected.length > 0 && (
            <span className="text-slate-400 text-sm">
              {selected.length}개 상권 선택됨
            </span>
          )}
          {selected.length === 0 && !loading && (
            <span className="text-slate-500 text-sm">
              선택 없이 실행하면 마포구 전체를 분석합니다
            </span>
          )}
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
      </div>

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* 결과 */}
      {result && !loading && (
        <>
          {result.cached && (
            <p className="text-slate-500 text-xs text-right">
              캐시된 결과 (7일 이내) ·{" "}
              {new Date(result.analyzed_at).toLocaleString("ko-KR")}
            </p>
          )}

          {/* TOP 3 카드 */}
          <TopPickCards
            scores={result.scores.slice(0, 3)}
            topPick={result.top_pick}
          />

          {/* 차트 2개 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">
                5개 지표 레이더 비교 (상위 3개 상권)
              </h2>
              <ScoreRadarChart scores={result.scores.slice(0, 3)} />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">
                상권별 생존율 비교
              </h2>
              <SurvivalBarChart scores={result.scores} />
            </div>
          </div>

          {/* Claude 리포트 */}
          <LlmReportPanel report={result.llm_report} />
        </>
      )}

      {/* 검색 이력 */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">
          최근 검색 이력
        </h2>
        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-slate-600 text-sm">아직 검색 이력이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((rec) => (
              <li
                key={rec.id}
                className="flex items-center justify-between gap-4
                           bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           hover:border-brand-500/40 transition-colors cursor-pointer group"
                onClick={() => setSelected(rec.districts)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-500 text-xs shrink-0">
                    {new Date(rec.searched_at).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {rec.districts.map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 text-xs"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                {rec.top_pick && (
                  <span className="shrink-0 text-xs text-brand-400 font-medium">
                    1위: {rec.top_pick}
                  </span>
                )}
                <span className="shrink-0 text-slate-600 text-xs group-hover:text-slate-400 transition-colors">
                  다시 선택 →
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
