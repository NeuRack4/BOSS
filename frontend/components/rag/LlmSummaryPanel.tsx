interface Props {
  query: string;
  summary: string | null;
  loading: boolean;
  disclaimer: string;
}

export default function LlmSummaryPanel({
  query,
  summary,
  loading,
  disclaimer,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">✦</span>
        <h2 className="text-sm font-semibold text-gray-800">AI 법령 해설</h2>
      </div>

      {/* 질문 표시 */}
      {query && (
        <div className="mb-4 p-3 rounded-xl bg-surface-200 border border-surface-300">
          <p className="text-xs text-gray-500 mb-1">질문</p>
          <p className="text-sm text-gray-800 font-medium">{query}</p>
        </div>
      )}

      {/* 응답 영역 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="text-xs">법령을 분석 중입니다...</p>
          </div>
        )}

        {!loading && !summary && !query && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <span className="text-3xl">⚖</span>
            <p className="text-sm text-center">
              키워드를 검색하면
              <br />
              AI가 관련 법령을 해설해드립니다.
            </p>
          </div>
        )}

        {!loading && !summary && query && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <p className="text-sm">검색 결과가 없거나 요약 대기 중입니다.</p>
          </div>
        )}

        {!loading && summary && (
          <div className="space-y-4">
            {/* AI 응답 말풍선 */}
            <div className="p-4 rounded-xl bg-white border border-surface-300 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                  BOSS AI
                </span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            </div>

            {/* 면책 고지 */}
            <p className="text-xs text-gray-400 leading-relaxed px-1">
              ⚠ {disclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
