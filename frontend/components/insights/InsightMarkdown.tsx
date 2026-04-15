import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
}

export default function InsightMarkdown({ children }: Props) {
  return (
    <div
      className="
        text-[13px] text-gray-700 leading-[1.9]
        prose prose-sm max-w-none
        prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight
        prose-h1:text-[15px] prose-h1:mt-6 prose-h1:mb-3 prose-h1:pb-2 prose-h1:border-b prose-h1:border-surface-200
        prose-h2:text-[14px] prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-brand-600
        prose-h3:text-[13px] prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-gray-800
        prose-p:my-3 prose-p:text-gray-700 prose-p:leading-[1.9]
        prose-strong:text-gray-900 prose-strong:font-semibold
        prose-ul:my-3 prose-ul:space-y-1.5 prose-ul:pl-5
        prose-ol:my-3 prose-ol:space-y-1.5 prose-ol:pl-5
        prose-li:my-0 prose-li:leading-[1.8] prose-li:text-gray-700 prose-li:marker:text-brand-500
        prose-hr:my-5 prose-hr:border-surface-300
        prose-blockquote:not-italic prose-blockquote:border-l-4 prose-blockquote:border-brand-400
        prose-blockquote:bg-brand-50/40 prose-blockquote:rounded-r-lg
        prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-3 prose-blockquote:text-gray-600
        prose-code:text-brand-700 prose-code:bg-brand-50 prose-code:px-1.5 prose-code:py-0.5
        prose-code:rounded prose-code:text-[12px] prose-code:font-medium
        prose-code:before:content-none prose-code:after:content-none
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
