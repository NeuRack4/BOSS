"use client";

export type RiskClause = {
  clause: string;
  reason: string;
  severity: "High" | "Mid" | "Low";
  suggestion_from: string;
  suggestion_to: string;
};

const SEVERITY_STYLE = {
  High: {
    badge: "bg-red-100 text-red-700 border-red-200",
    label: "High — 즉시 수정 필수",
  },
  Mid: {
    badge: "bg-orange-100 text-orange-600 border-orange-200",
    label: "Mid — 협상 권장",
  },
  Low: {
    badge: "bg-yellow-100 text-yellow-600 border-yellow-200",
    label: "Low — 검토 권장",
  },
};

export type ReviewResult = {
  summary: string;
  gap_ratio: number;
  eul_ratio: number;
  risk_clauses: RiskClause[];
};

export default function ReviewResult({ result }: { result: ReviewResult }) {
  const {
    gap_ratio = 50,
    eul_ratio = 50,
    summary = "",
    risk_clauses = [],
  } = result ?? {};

  const total = gap_ratio + eul_ratio || 100;
  const gapPct = Math.round((gap_ratio / total) * 100);
  const eulPct = 100 - gapPct;

  return (
    <div className="space-y-6">
      {/* 갑:을 유리도 바 */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">계약 유불리 평가</h3>
          <span className="text-sm font-bold">
            <span className="text-blue-600">갑 {gap_ratio}</span>
            <span className="text-gray-400 mx-1">:</span>
            <span className="text-orange-500">{eul_ratio} 을</span>
          </span>
        </div>
        <div className="h-4 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${gapPct}%` }}
          />
          <div
            className="h-full bg-orange-400 transition-all flex-1"
            style={{ width: `${eulPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-blue-600 font-medium">
            갑 {gapPct}%
          </span>
          <span className="text-xs text-orange-500 font-medium">
            {eulPct}% 을
          </span>
        </div>
      </div>

      {/* 전체 요약 */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3">전체 요약</h3>
        <p className="text-sm text-gray-700 leading-7">{summary}</p>
      </div>

      {/* 위험 조항 목록 */}
      {risk_clauses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">
            위험 조항 ({risk_clauses.length}건)
          </h3>
          {risk_clauses.map((item, idx) => (
            <div
              key={idx}
              className="glass-card rounded-xl p-5 space-y-3 border-red-200/50"
            >
              {/* 조항 원문 */}
              <blockquote className="border-l-4 border-red-300 pl-4 py-1 bg-red-50/50 rounded-r-lg">
                <p className="text-sm text-gray-700 italic leading-6">
                  "{item.clause}"
                </p>
              </blockquote>

              {/* 위험도 배지 + 이유 */}
              <div className="flex items-start gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 mt-0.5 ${SEVERITY_STYLE[item.severity ?? "Mid"].badge}`}
                >
                  {SEVERITY_STYLE[item.severity ?? "Mid"].label}
                </span>
              </div>
              <p className="text-sm text-red-600 leading-6">{item.reason}</p>

              {/* 수정 제안 */}
              {(item.suggestion_from || item.suggestion_to) && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-2">
                  <span className="text-green-700 text-xs font-bold">
                    수정 제안
                  </span>
                  {item.suggestion_from && (
                    <p className="text-xs text-gray-400 line-through leading-5">
                      "{item.suggestion_from}"
                    </p>
                  )}
                  {item.suggestion_to && (
                    <p className="text-sm text-green-700 leading-6 font-medium">
                      → "{item.suggestion_to}"
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 면책 고지 */}
      <p className="text-xs text-gray-400 leading-relaxed">
        본 내용은 참고용이며 실제 계약 체결 전 전문가(법무사·변호사) 확인을
        권장합니다.
      </p>
    </div>
  );
}
