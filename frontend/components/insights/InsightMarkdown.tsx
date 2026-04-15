"use client";

import React from "react";
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
        prose-h2:text-[14px] prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-brand-600 prose-h2:flex prose-h2:items-center prose-h2:gap-2 prose-h2:before:content-[''] prose-h2:before:w-1 prose-h2:before:h-4 prose-h2:before:bg-brand-500 prose-h2:before:rounded-sm
        prose-h3:text-[13px] prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-gray-800
        prose-p:my-3 prose-p:text-gray-700 prose-p:leading-[1.9]
        prose-strong:text-gray-900 prose-strong:font-semibold
        prose-ul:my-3 prose-ul:space-y-1.5 prose-ul:pl-5
        prose-ol:my-3 prose-ol:space-y-1.5 prose-ol:pl-5
        prose-li:my-0 prose-li:leading-[1.8] prose-li:text-gray-700 prose-li:marker:text-brand-500
        prose-a:text-brand-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
        prose-hr:my-5 prose-hr:border-surface-300
        prose-blockquote:not-italic prose-blockquote:border-l-4 prose-blockquote:border-brand-400 prose-blockquote:bg-brand-50/40 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-3 prose-blockquote:text-gray-600
        prose-code:text-brand-700 prose-code:bg-brand-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
        prose-table:my-4 prose-table:w-full prose-table:border prose-table:border-surface-300 prose-table:rounded-lg prose-table:overflow-hidden
        prose-thead:bg-surface-200
        prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-[12px] prose-th:font-semibold prose-th:text-gray-700 prose-th:border-b prose-th:border-surface-300
        prose-td:px-3 prose-td:py-2 prose-td:text-[12px] prose-td:text-gray-700 prose-td:border-b prose-td:border-surface-200
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
