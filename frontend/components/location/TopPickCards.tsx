import type { DistrictScore } from "./LocationDashboard";

const RISK_STYLE: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MED: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-red-50 text-red-700 border-red-200",
};

const RISK_LABEL: Record<string, string> = {
  LOW: "안전",
  MED: "보통",
  HIGH: "고위험",
};

const RANK_LABEL = ["1위", "2위", "3위"];

interface Props {
  scores: DistrictScore[];
  topPick: string;
}

export default function TopPickCards({ scores, topPick }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {scores.map((s, i) => (
        <div
          key={s.district}
          className={`relative rounded-2xl border p-5 space-y-4 transition-colors
            ${
              s.district === topPick
                ? "border-brand-500/50 bg-brand-50"
                : "border-surface-300 bg-white"
            }`}
        >
          {/* 랭크 + 위험도 */}
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold tracking-wider
                ${s.district === topPick ? "text-brand-500" : "text-gray-400"}`}
            >
              {RANK_LABEL[i]}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_STYLE[s.risk_level]}`}
            >
              {RISK_LABEL[s.risk_level]}
            </span>
          </div>

          {/* 상권명 + 종합 스코어 */}
          <div>
            <h3 className="text-lg font-bold text-gray-900">{s.district}</h3>
            <div className="flex items-end gap-1 mt-1">
              <span
                className={`text-3xl font-extrabold
                  ${s.district === topPick ? "text-brand-500" : "text-gray-700"}`}
              >
                {s.total_score}
              </span>
              <span className="text-gray-400 text-sm pb-1">/ 100점</span>
            </div>
          </div>

          {/* 지표 3종 요약 */}
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between">
              <span className="text-gray-500">예상 월매출</span>
              <span className="text-gray-800 font-medium">
                {(s.estimated_monthly_revenue / 10_000).toFixed(0)}만원
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-500">BEP</span>
              <span className="text-gray-800 font-medium">
                {s.bep_months < 120 ? `${s.bep_months}개월` : "산출 불가"}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-500">생존율 스코어</span>
              <span className="text-gray-800 font-medium">
                {s.survival_score}점
              </span>
            </li>
          </ul>
        </div>
      ))}
    </div>
  );
}
