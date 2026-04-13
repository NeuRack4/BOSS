interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, string>;
  similarity: number;
  disclaimer: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  license: "인허가",
  tax: "세금",
  labor: "근로",
  lease: "임대차",
  subsidy: "지원사업",
  regulation: "규제법령",
};

const CATEGORY_COLORS: Record<string, string> = {
  license: "bg-orange-50 text-orange-700 border-orange-200",
  tax: "bg-blue-50 text-blue-700 border-blue-200",
  labor: "bg-green-50 text-green-700 border-green-200",
  lease: "bg-purple-50 text-purple-700 border-purple-200",
  subsidy: "bg-brand-50 text-brand-700 border-brand-200",
  regulation: "bg-gray-50 text-gray-700 border-gray-200",
};

interface Props {
  result: SearchResult;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

export default function ResultCard({
  result,
  index,
  isSelected,
  onClick,
}: Props) {
  const category = result.metadata?.category ?? "";
  const source = result.metadata?.source ?? result.metadata?.law ?? "출처 미상";
  const article = result.metadata?.article ?? "";
  const similarityPct = Math.round(result.similarity * 100);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? "border-brand-400 bg-brand-50 shadow-sm"
          : "border-surface-300 bg-white hover:border-brand-300 hover:shadow-sm"
      }`}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400">#{index}</span>
          {category && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                CATEGORY_COLORS[category] ?? CATEGORY_COLORS.regulation
              }`}
            >
              {CATEGORY_LABELS[category] ?? category}
            </span>
          )}
          <span className="text-xs text-gray-500 font-medium">
            {source}
            {article && ` · ${article}`}
          </span>
        </div>
        <span className="shrink-0 text-xs font-bold text-brand-500">
          {similarityPct}%
        </span>
      </div>

      {/* 원문 미리보기 */}
      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
        {result.content}
      </p>

      {isSelected && (
        <p className="mt-2 text-xs text-brand-500 font-medium">
          AI 요약에 포함됨 ✓
        </p>
      )}
    </button>
  );
}
