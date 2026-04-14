import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
              <div
                className="
                  text-[13px] text-gray-800 leading-[1.9]
                  prose prose-sm max-w-none
                  prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight
                  prose-h1:text-[15px] prose-h1:mt-10 prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-surface-300
                  prose-h2:text-[14px] prose-h2:mt-10 prose-h2:mb-4 prose-h2:flex prose-h2:items-center prose-h2:gap-2 prose-h2:before:content-[''] prose-h2:before:w-1 prose-h2:before:h-4 prose-h2:before:bg-brand-500 prose-h2:before:rounded-sm
                  prose-h3:text-[13px] prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-gray-800
                  prose-p:my-4 prose-p:text-gray-700 prose-p:leading-[1.9]
                  prose-strong:text-gray-900 prose-strong:font-semibold
                  prose-ul:my-4 prose-ul:space-y-2 prose-ul:pl-5
                  prose-ol:my-4 prose-ol:space-y-2 prose-ol:pl-5
                  prose-li:my-0 prose-li:leading-[1.8] prose-li:text-gray-700 prose-li:marker:text-brand-500
                  prose-a:text-brand-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                  prose-hr:my-8 prose-hr:border-surface-300
                  prose-blockquote:not-italic prose-blockquote:border-l-4 prose-blockquote:border-brand-400 prose-blockquote:bg-brand-50/40 prose-blockquote:rounded-r-lg prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:my-5 prose-blockquote:text-gray-700
                  prose-code:text-brand-700 prose-code:bg-brand-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                  prose-table:my-5 prose-table:w-full prose-table:border prose-table:border-surface-300 prose-table:rounded-lg prose-table:overflow-hidden
                  prose-thead:bg-surface-200
                  prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-[12px] prose-th:font-semibold prose-th:text-gray-700 prose-th:border-b prose-th:border-surface-300
                  prose-td:px-3 prose-td:py-2 prose-td:text-[12px] prose-td:text-gray-700 prose-td:border-b prose-td:border-surface-200
                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                "
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summary}
                </ReactMarkdown>
              </div>
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
