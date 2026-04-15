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
    <div className="bg-white border border-surface-300 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4
                   text-left hover:bg-surface-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-brand-500 text-lg">✦</span>
          <span className="text-gray-800 font-semibold text-sm">
            Claude 입지 분석 리포트
          </span>
        </div>
        <span className="text-gray-400 text-sm">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-surface-300 pt-4">
          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
          {disclaimer && (
            <p className="text-gray-400 text-xs border-t border-surface-200 pt-3">
              {disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
