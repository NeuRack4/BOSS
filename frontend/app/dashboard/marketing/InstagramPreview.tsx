"use client";

import { useState, useRef } from "react";

type Props = {
  imageUrl: string;
  content: string;
  cafeName: string;
};

function parseContent(content: string) {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const hashtagIdx = lines.findIndex((l) => /^#/.test(l));
  const tipIdx = lines.findIndex(
    (l) =>
      l.includes("💡") || l.includes("게시 추천") || l.includes("게시 최적"),
  );

  let captionLines: string[];
  let hashtagText = "";
  let tip = "";

  if (hashtagIdx === -1) {
    captionLines = lines;
  } else {
    captionLines = lines.slice(0, hashtagIdx);
    const afterCaption = lines.slice(hashtagIdx);
    if (tipIdx !== -1 && tipIdx > hashtagIdx) {
      hashtagText = lines.slice(hashtagIdx, tipIdx).join(" ");
      tip = lines[tipIdx];
    } else {
      hashtagText = afterCaption.join(" ");
    }
  }

  return {
    caption: captionLines
      .join("\n")
      .replace(/^\d+\.\s*/, "")
      .trim(),
    hashtags: hashtagText,
    tip,
  };
}

export default function InstagramPreview({
  imageUrl,
  content,
  cafeName,
}: Props) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount] = useState(() => Math.floor(Math.random() * 480) + 72);
  const [copyDone, setCopyDone] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { caption, hashtags, tip } = parseContent(content);
  const username =
    cafeName
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_가-힣]/g, "")
      .toLowerCase() || "my_cafe";

  const handleSaveImage = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!previewRef.current) return;
      const canvas = await html2canvas(previewRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = "instagram_post.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // fallback: 이미지만 다운로드
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = "instagram_post.png";
      link.target = "_blank";
      link.click();
    }
  };

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(
      [caption, "", hashtags, tip ? `\n${tip}` : ""].filter(Boolean).join("\n"),
    );
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  return (
    <div className="space-y-4">
      {tip && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-sm">{tip}</span>
        </div>
      )}

      {/* 인스타그램 프리뷰 카드 */}
      <div
        ref={previewRef}
        className="bg-white border border-[#dbdbdb] rounded-xl overflow-hidden max-w-[400px] mx-auto"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {/* 프로필 아바타 */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {cafeName?.[0]?.toUpperCase() || "C"}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#262626] leading-tight">
                {username}
              </p>
              <p className="text-[11px] text-[#8e8e8e] leading-tight">
                마포구 · 서울
              </p>
            </div>
          </div>
          {/* 더보기 */}
          <button className="text-[#262626] px-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>

        {/* 이미지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="인스타그램 게시물 이미지"
          className="w-full aspect-square object-cover"
        />

        {/* 액션 버튼 */}
        <div className="px-3 pt-2.5 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {/* 좋아요 */}
              <button
                onClick={() => setLiked((v) => !v)}
                className="transition-transform active:scale-125"
              >
                {liked ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="#ed4956"
                  >
                    <path d="M12 21.593c-.525-.437-8.582-6.436-8.582-12.097C3.418 5.411 7.01 3 9.957 3c1.65 0 3.332.678 4.557 1.98C15.735 3.678 17.417 3 19.067 3 22.014 3 25.5 5.411 25.5 9.496c0 5.66-8.057 11.66-8.582 12.097L12 21.593z" />
                  </svg>
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#262626"
                    strokeWidth="1.8"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                )}
              </button>
              {/* 댓글 */}
              <button>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#262626"
                  strokeWidth="1.8"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              {/* 공유 */}
              <button>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#262626"
                  strokeWidth="1.8"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            {/* 저장 */}
            <button onClick={() => setSaved((v) => !v)}>
              {saved ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#262626">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#262626"
                  strokeWidth="1.8"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* 좋아요 수 */}
          <p className="text-[13px] font-semibold text-[#262626] mt-2">
            좋아요 {(likeCount + (liked ? 1 : 0)).toLocaleString()}개
          </p>

          {/* 캡션 */}
          <div className="mt-1 text-[13px] text-[#262626] leading-[18px]">
            <span className="font-semibold mr-1">{username}</span>
            <span className="whitespace-pre-line">{caption}</span>
          </div>

          {/* 해시태그 */}
          {hashtags && (
            <p className="mt-1.5 text-[13px] text-[#00376b] leading-[18px] break-words">
              {hashtags}
            </p>
          )}

          {/* 댓글 */}
          <p className="text-[13px] text-[#8e8e8e] mt-1.5">
            댓글 0개 모두 보기
          </p>

          {/* 시간 */}
          <p className="text-[10px] text-[#c7c7c7] mt-1 mb-2 uppercase tracking-wide">
            방금
          </p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3 max-w-[400px] mx-auto">
        <button
          onClick={handleSaveImage}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white transition-all"
        >
          게시물 이미지로 저장
        </button>
        <button
          onClick={handleCopyCaption}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
            copyDone
              ? "bg-green-500 text-white border-green-500"
              : "border-surface-300 text-gray-600 bg-white hover:bg-surface-100"
          }`}
        >
          {copyDone ? "✓ 캡션 복사됨" : "캡션 복사"}
        </button>
      </div>
    </div>
  );
}
