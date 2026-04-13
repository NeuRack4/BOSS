"use client";

import { useState } from "react";

interface Props {
  report: string;
}

export default function LlmReportPanel({ report }: Props) {
  const [open, setOpen] = useState(false);

  // 면책 고지 분리
  const parts = report.split("\n\n---\n");
  const body = parts[0];
  const disclaimer = parts[1];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4
                   text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-500 text-lg">✦</span>
          <span className="text-slate-200 font-semibold text-sm">
            Claude 입지 분석 리포트
          </span>
        </div>
        <span className="text-slate-500 text-sm">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-white/10 pt-4">
          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
          {disclaimer && (
            <p className="text-slate-500 text-xs border-t border-white/10 pt-3">
              {disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
