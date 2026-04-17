"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

function parseBlogContent(content: string) {
  const lines = content.split("\n");
  let title = "";
  const tags: string[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Title: first # heading
    if (!title && trimmed.startsWith("#") && !trimmed.startsWith("##")) {
      title = trimmed.replace(/^#+\s*/, "");
      continue;
    }

    // Tags: lines that are only hashtags
    if (trimmed && trimmed.match(/^(#\S+(\s+|$))+$/)) {
      const found = trimmed.match(/#\S+/g);
      if (found) { tags.push(...found); continue; }
    }

    // Tags with prefix like "태그:" or "**태그**:"
    if (trimmed.match(/^(\*\*)?태그(\*\*)?[:：]/)) {
      const found = trimmed.match(/#\S+/g);
      if (found) { tags.push(...found); continue; }
    }

    bodyLines.push(line);
  }

  // Trim trailing empty lines from body
  while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) {
    bodyLines.pop();
  }

  return { title, tags, body: bodyLines.join("\n") };
}

function estimateReadingTime(text: string) {
  const charCount = text.replace(/\s/g, "").length;
  return Math.max(1, Math.ceil(charCount / 500));
}

export default function BlogPreview({
  content,
  cafeName,
  menuUsed,
  year,
  month,
}: {
  content: string;
  cafeName: string;
  menuUsed?: string | null;
  year: number;
  month: number;
}) {
  const { title, tags, body } = parseBlogContent(content);
  const readingTime = estimateReadingTime(content);
  const [copied, setCopied] = useState(false);

  const day = new Date().getDate();
  const dateStr = `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  const displayName = cafeName || "내 카페";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-surface-200 shadow-sm bg-white">
      {/* Naver Blog top bar */}
      <div className="flex items-center gap-2.5 px-5 py-3" style={{ backgroundColor: "#03C75A" }}>
        <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center shrink-0">
          <span className="font-black text-sm leading-none" style={{ color: "#03C75A" }}>N</span>
        </div>
        <span className="text-white font-bold text-sm">블로그</span>
        <span className="text-white/60 text-xs">미리보기</span>
        <span className="ml-auto text-white/90 text-xs font-medium truncate max-w-[120px]">{displayName}</span>
      </div>

      {/* Blog post body */}
      <div className="px-6 pt-6 pb-2 space-y-4">
        {/* Title */}
        {title && (
          <h1 className="text-[1.3rem] font-black text-gray-900 leading-snug tracking-tight">
            {title}
          </h1>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
          <span className="font-semibold text-gray-600">{displayName}</span>
          <span>·</span>
          <span>{dateStr}</span>
          <span>·</span>
          <span>읽는 시간 약 {readingTime}분</span>
          {menuUsed && (
            <>
              <span>·</span>
              <span className="font-medium" style={{ color: "#03C75A" }}>{menuUsed}</span>
            </>
          )}
        </div>

        <div className="border-t border-surface-200" />

        {/* Body content */}
        <div
          className="prose prose-sm max-w-none text-gray-700
            prose-p:my-2 prose-p:leading-[1.95]
            prose-strong:text-gray-900 prose-strong:font-bold
            prose-headings:text-gray-900 prose-headings:font-bold
            prose-headings:mt-4 prose-headings:mb-1.5
            prose-ul:my-2 prose-li:my-1 prose-ol:my-2"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {body || content}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="pt-4 border-t border-surface-200">
            <p className="text-xs font-medium text-gray-400 mb-2.5">태그</p>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1 bg-surface-50 text-gray-500 rounded-full border border-surface-200
                    hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors cursor-default"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Copy button */}
      <div className="px-6 pb-5 pt-3">
        <button
          onClick={handleCopy}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all border ${
            copied
              ? "bg-green-500 text-white border-green-500"
              : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          }`}
        >
          {copied ? "✓ 복사 완료" : "📋 블로그 내용 전체 복사"}
        </button>
      </div>
    </div>
  );
}
