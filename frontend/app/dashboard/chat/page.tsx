"use client";

/**
 * BOSS 챗봇 페이지 — /dashboard/chat
 * ⚠️ 신규 파일 — 기존 소스 미수정
 */

import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* 헤더 */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-black text-lg">
            B
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">BOSS 챗봇</h1>
            <p className="text-xs text-gray-500">
              카페 창업 전 과정을 도와드립니다 · 법령·지원사업·세금·계약서 전문
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">PDF 서류 작성 →</span>
            <a
              href="/drafts/business-registration"
              className="text-xs px-2.5 py-1 rounded-lg border border-surface-300 text-gray-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              서류 초안
            </a>
          </div>
        </div>
      </div>

      {/* 채팅창 */}
      <div className="flex-1 bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden flex flex-col">
        <ChatWindow />
      </div>
    </div>
  );
}
