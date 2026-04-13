"use client";

import { useState } from "react";

interface Deadline {
  id: number;
  tax_type: string;
  title: string;
  deadline_date: string;
  description: string;
  source_url: string;
  d_day: number;
}

interface Props {
  deadlines: Deadline[];
  userId: string;
}

const TAX_TYPE_LABEL: Record<string, string> = {
  vat: "부가세",
  income: "종합소득세",
  withholding: "원천세",
  etc: "기타",
};

const D_DAY_COLOR: (d: number) => string = (d) => {
  if (d <= 3) return "bg-red-100 text-red-600 border-red-200";
  if (d <= 7) return "bg-orange-100 text-orange-600 border-orange-200";
  if (d <= 14) return "bg-amber-100 text-amber-600 border-amber-200";
  return "bg-blue-50 text-brand-600 border-brand-100";
};

export default function TaxDeadlineList({ deadlines, userId }: Props) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [draftPaths, setDraftPaths] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleDraft = async (deadline: Deadline) => {
    if (deadline.id < 0) {
      setErrors((prev) => ({
        ...prev,
        [deadline.id]:
          "DB에 저장된 기한만 초안 생성이 가능합니다. /tax/deadlines/sync를 먼저 실행해 주세요.",
      }));
      return;
    }

    setLoadingId(deadline.id);
    setErrors((prev) => ({ ...prev, [deadline.id]: "" }));

    try {
      const res = await fetch(`${API_BASE}/tax/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, deadline_id: deadline.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      setDraftPaths((prev) => ({ ...prev, [deadline.id]: data.storage_path }));
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [deadline.id]: e instanceof Error ? e.message : "알 수 없는 오류",
      }));
    } finally {
      setLoadingId(null);
    }
  };

  if (deadlines.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-gray-500 text-sm">
          30일 이내 다가오는 세금 기한이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deadlines.map((d) => (
        <div key={d.id} className="glass-card rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-medium text-gray-400 bg-surface-200 px-2 py-0.5 rounded-full">
                  {TAX_TYPE_LABEL[d.tax_type] ?? d.tax_type}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${D_DAY_COLOR(d.d_day)}`}
                >
                  D-{d.d_day}
                </span>
              </div>
              <p className="text-base font-bold text-gray-800">{d.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                기한: {d.deadline_date}
              </p>
              {d.description && (
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {d.description}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {draftPaths[d.id] ? (
                <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                  ✓ 초안 생성 완료
                </span>
              ) : (
                <button
                  onClick={() => handleDraft(d)}
                  disabled={loadingId === d.id}
                  className="text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed glow-blue"
                >
                  {loadingId === d.id ? "생성 중..." : "초안 생성"}
                </button>
              )}
            </div>
          </div>

          {errors[d.id] && (
            <p className="mt-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors[d.id]}
            </p>
          )}
          {draftPaths[d.id] && (
            <p className="mt-3 text-xs text-gray-400 bg-surface-200 rounded-lg px-3 py-2 truncate">
              저장 경로: {draftPaths[d.id]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
