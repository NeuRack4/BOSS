"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import TaxDeadlineList from "@/components/tax/TaxDeadlineList";

interface Deadline {
  id: number;
  tax_type: string;
  title: string;
  deadline_date: string;
  description: string;
  source_url: string;
  d_day: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function TaxPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daysAhead, setDaysAhead] = useState(30);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchDeadlines = async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/tax/deadlines?days_ahead=${days}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setDeadlines(data.deadlines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/tax/deadlines/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`동기화 실패 (${res.status})`);
      await fetchDeadlines(daysAhead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "동기화 실패");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchDeadlines(daysAhead);
  }, [daysAhead]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">세금 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            다가오는 세금 기한과 신고서 초안을 관리합니다.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs font-medium text-brand-600 border border-brand-500/30 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {syncing ? "동기화 중..." : "↻ 데이터 동기화"}
        </button>
      </div>

      {/* 기간 필터 */}
      <div className="flex gap-2">
        {[14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDaysAhead(d)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors
              ${
                daysAhead === d
                  ? "bg-brand-500 text-white border-brand-500 glow-blue"
                  : "text-gray-500 border-surface-300 hover:bg-surface-200"
              }`}
          >
            D-{d} 이내
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-5 animate-pulse h-24"
            />
          ))}
        </div>
      )}

      {/* 목록 */}
      {!loading && (
        <>
          <p className="text-xs text-gray-400">
            {daysAhead}일 이내 기한 {deadlines.length}건
          </p>
          <TaxDeadlineList deadlines={deadlines} userId={userId} />
        </>
      )}

      {/* 면책 고지 */}
      <p className="text-xs text-gray-400 text-center pt-2">
        본 내용은 참고용이며 실제 신고 전 전문가 확인을 권장합니다.
      </p>
    </div>
  );
}
