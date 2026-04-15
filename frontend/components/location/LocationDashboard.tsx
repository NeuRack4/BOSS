"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import MapoDataViewer from "./MapoDataViewer";
import PersonalAnalysisForm from "./PersonalAnalysisForm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface HistoryRecord {
  id: number;
  districts: string[];
  top_pick: string | null;
  searched_at: string;
}

export default function LocationDashboard() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/location/history`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: HistoryRecord[]) => setHistory(data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* ── 메인: 개인 조건 기반 Top 20 ── */}
      <PersonalAnalysisForm userId={userId} />

      {/* ── 보조: 마포구 상권 데이터 뷰어 ── */}
      <details className="group">
        <summary
          className="cursor-pointer select-none list-none flex items-center gap-2
                            text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span
            className="border border-surface-300 rounded-lg px-3 py-1.5 bg-white
                           group-open:border-brand-300 group-open:text-brand-600 transition-colors"
          >
            상권 데이터 ▾
          </span>
        </summary>

        <div className="mt-4">
          <div className="bg-white border border-surface-300 rounded-2xl p-6">
            <MapoDataViewer />
          </div>
        </div>
      </details>

      {/* 검색 이력 */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">
          최근 검색 이력
        </h2>
        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-surface-200 animate-pulse"
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
                           bg-white border border-surface-300 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-gray-400 text-xs shrink-0">
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
                        className="px-2 py-0.5 rounded-md bg-surface-200 text-gray-600 text-xs"
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
