"use client";

/**
 * ChatWindow — BOSS 챗봇 UI 컴포넌트
 * ⚠️ 신규 파일 — 기존 소스 미수정
 *
 * 토큰 절약 설계:
 *   - 최대 MAX_TURNS 턴 제한 → 컨텍스트 폭발 방지
 *   - 대화 초기화 버튼 → 언제든 새 세션 시작
 *   - PDF 생성 기능 없음 → /drafts 페이지 유도만
 *   - 세션 비저장 (React state만) → DB 저장 없음
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";
import { exportMarkdownAsPdf } from "@/lib/chatbot/pdf_export";

// ── 상수 ─────────────────────────────────────────────────────────────────────
/** 사용자 발화 최대 턴 수. 초과 시 새 대화 요청. */
const MAX_TURNS = 15;
/** 경고 표시 시작 턴 (MAX_TURNS - 2) */
const WARN_TURNS = MAX_TURNS - 2;

const INITIAL_MESSAGE = {
  role: "assistant" as const,
  content:
    "안녕하세요! BOSS 창업 도우미입니다.\n\n" +
    "사업자등록, 식품위생신고, 세금, 지원사업, 입지분석, 근로계약 등 **카페 창업과 운영**에 관한 질문에 답변드립니다.\n\n" +
    "서류 초안(PDF)은 상단 메뉴 **[서류 초안]** 에서 직접 작성할 수 있습니다.",
};

// ── 타입 ────────────────────────────────────────────────────────────────────
export interface DocumentPayload {
  doc_type: "job_posting" | "labor_contract" | string;
  title: string;
  draft_id: string | null;
  content: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  docCard?: DocumentPayload;
}

// ── 빠른 카테고리 버튼 (PDF 관련 제외) ───────────────────────────────────────
const QUICK_CATEGORIES = [
  {
    label: "사업자등록",
    icon: "📋",
    q: "사업자등록 신청 절차와 필요 서류를 알려주세요",
  },
  {
    label: "식품위생신고",
    icon: "🍽",
    q: "카페 식품위생 영업신고 절차를 알려주세요",
  },
  {
    label: "지원사업",
    icon: "📢",
    q: "카페 창업자가 받을 수 있는 지원사업은 무엇인가요?",
  },
  {
    label: "세금 일정",
    icon: "💰",
    q: "카페 운영 시 납부해야 할 세금 종류와 기한을 알려주세요",
  },
  {
    label: "입지분석",
    icon: "📍",
    q: "카페 창업에 유리한 상권을 알려주세요",
  },
  {
    label: "근로계약",
    icon: "📝",
    q: "카페 아르바이트 근로계약 시 주의사항을 알려주세요",
  },
];

const SUGGESTED_QUESTIONS = [
  "사업자등록 어떻게 신청하나요?",
  "카페 식품위생 신고 절차가 궁금해요",
  "지원사업 매칭은 어떻게 하나요?",
  "부가세 신고 기한이 언제인가요?",
  "최저임금과 주휴수당 계산법을 알려주세요",
  "어느 상권이 카페 창업에 유리한가요?",
  "임대차 확정일자 받는 방법이 뭔가요?",
  "4대보험 가입 의무와 절차를 알려주세요",
];

// ── 서류 다운로드 카드 ────────────────────────────────────────────────────────
const JOB_TABS = [
  { key: "karrot", label: "당근마켓" },
  { key: "alba", label: "알바천국" },
  { key: "saramin", label: "사람인" },
] as const;

function DocumentCard({ doc }: { doc: DocumentPayload }) {
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const isJobPosting = doc.doc_type === "job_posting";

  // 채용공고: "## 플랫폼명" 헤더 위치 기준으로 3개 섹션 분리
  const sections: string[] = isJobPosting
    ? (() => {
        const markers = ["## 당근마켓", "## 알바천국", "## 사람인"];
        return markers.map((marker, i) => {
          const start = doc.content.indexOf(marker);
          if (start === -1) return "";
          const lineEnd = doc.content.indexOf("\n", start);
          const contentStart =
            lineEnd === -1 ? start + marker.length : lineEnd + 1;
          const nextMarker = markers[i + 1];
          const end = nextMarker
            ? doc.content.indexOf(nextMarker, contentStart)
            : doc.content.length;
          return doc.content
            .slice(contentStart, end === -1 ? undefined : end)
            .trim();
        });
      })()
    : [];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportMarkdownAsPdf(doc.content, doc.title);
    } finally {
      setDownloading(false);
    }
  };

  const icon = doc.doc_type === "labor_contract" ? "📄" : "📝";
  const typeLabel =
    doc.doc_type === "labor_contract" ? "근로계약서" : "채용공고";

  return (
    <div className="mt-2 bg-brand-50 border border-brand-200 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 bg-white">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">
            {doc.title}
          </p>
          <p className="text-[10px] text-brand-500">
            {typeLabel} 초안{doc.draft_id ? " · 서류함 저장 완료" : ""}
          </p>
        </div>
      </div>

      {/* 채용공고: 플랫폼 탭 */}
      {isJobPosting && sections.length > 0 && (
        <>
          <div className="flex border-y border-brand-200 bg-surface-100">
            {JOB_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                  activeTab === i
                    ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="px-3 py-2.5 max-h-52 overflow-y-auto bg-white">
            {sections[activeTab] ? (
              <div className="prose prose-xs max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:text-gray-900 text-[12px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {sections[activeTab]}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 py-4 text-center">
                해당 플랫폼 초안을 생성하지 못했습니다.
                <br />
                다운로드 후 전체 내용을 확인해 주세요.
              </p>
            )}
          </div>
        </>
      )}

      {/* 근로계약서: 내용 미리보기 */}
      {!isJobPosting && (
        <div className="px-3 py-2.5 max-h-52 overflow-y-auto bg-white border-t border-brand-100">
          <div className="prose prose-xs max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:text-gray-900 text-[12px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content.slice(0, 600) +
                (doc.content.length > 600 ? "\n\n..." : "")}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* 다운로드 버튼 */}
      <div className="px-3 pb-3 pt-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full px-3 py-1.5 bg-brand-500 text-white text-xs font-semibold rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {downloading ? "생성 중..." : "⬇ 다운로드"}
        </button>
      </div>
    </div>
  );
}

// ── 메시지 버블 ──────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1
          ${isUser ? "bg-brand-500 text-white" : "bg-gray-800 text-white"}`}
      >
        {isUser ? "나" : "B"}
      </div>

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${
            isUser
              ? "bg-brand-500 text-white rounded-tr-sm"
              : "bg-white border border-surface-300 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : msg.content === "" && msg.isStreaming ? (
          /* 스트리밍 시작 전 — dots만 표시 */
          <div className="flex gap-1 py-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:text-gray-900">
            {msg.docCard && <DocumentCard doc={msg.docCard} />}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  if (href?.startsWith("/")) {
                    return (
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 px-3 py-1.5 my-0.5 bg-brand-50 border border-brand-200 text-brand-600 rounded-lg text-xs font-semibold no-underline hover:bg-brand-100 hover:border-brand-400 transition-colors"
                      >
                        {children}
                        <span className="text-brand-400">→</span>
                      </Link>
                    );
                  }
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 underline hover:text-brand-700"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-gray-400 rounded-sm animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 턴 카운터 배지 ────────────────────────────────────────────────────────────
function TurnBadge({ turns }: { turns: number }) {
  if (turns === 0) return null;

  const isWarn = turns >= WARN_TURNS;
  const isMax = turns >= MAX_TURNS;

  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
        isMax
          ? "bg-red-100 text-red-600"
          : isWarn
            ? "bg-yellow-100 text-yellow-700"
            : "bg-surface-200 text-gray-400"
      }`}
    >
      {turns}/{MAX_TURNS} 턴
    </span>
  );
}

// ── sessionStorage 키 ────────────────────────────────────────────────────────
const SESSION_KEY = "boss_chat_session";

const ERROR_MSG = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

function saveSession(messages: ChatMessage[], turns: number) {
  try {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.content === ERROR_MSG) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, turns }));
  } catch {
    // sessionStorage 접근 불가 시 무시 (SSR 등)
  }
}

function loadSession(): { messages: ChatMessage[]; turns: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadSession();
    return saved
      ? saved.messages.map((m) => ({ ...m, isStreaming: false }))
      : [INITIAL_MESSAGE];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(() => {
    const saved = loadSession();
    return saved ? saved.messages.length <= 1 : true;
  });
  /** 사용자 발화 횟수 (assistant 메시지 제외) */
  const [userTurns, setUserTurns] = useState(() => {
    const saved = loadSession();
    return saved ? saved.turns : 0;
  });
  /** 도구 실행 중 상태 메시지 */
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingDocRef = useRef<DocumentPayload | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 메시지·턴 변경 시 sessionStorage에 저장
  useEffect(() => {
    saveSession(messages, userTurns);
  }, [messages, userTurns]);

  /** 대화 완전 초기화 — 새 세션 시작 */
  const resetChat = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setIsLoading(false);
    setShowSuggestions(true);
    setUserTurns(0);
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      if (userTurns >= MAX_TURNS) return; // 턴 초과 시 전송 차단

      setShowSuggestions(false);
      setInput("");
      setIsLoading(true);
      setToolStatus("답변 준비 중...");

      const nextTurns = userTurns + 1;
      setUserTurns(nextTurns);

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", isStreaming: true },
      ]);

      try {
        // history: 초기 환영 메시지 제외, 최근 30개 (15턴) 전송 — 발표자료 기준 통일
        const history = messages
          .slice(1)
          .filter((m) => !m.isStreaming)
          .slice(-30)
          .map(({ role, content }) => ({ role, content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history, userId }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const parsed = JSON.parse(raw);

              if (parsed.type === "status") {
                // 서버에서 오는 실시간 도구 상태 메시지
                setToolStatus(parsed.text);
              } else if (parsed.type === "document") {
                // 서류 생성 완료 → ref에 즉시 저장 (스트림 종료 시 텍스트 메시지에 합침)
                pendingDocRef.current = parsed as DocumentPayload;
              } else if (parsed.type === "text" || parsed.text) {
                // 첫 텍스트 수신 시 status 숨김
                setToolStatus(null);
                accumulated += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: accumulated,
                    isStreaming: true,
                  };
                  return updated;
                });
              }
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }

        const capturedDoc = pendingDocRef.current;
        pendingDocRef.current = null;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulated || "응답을 받지 못했습니다.",
            isStreaming: false,
            ...(capturedDoc ? { docCard: capturedDoc } : {}),
          };
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            isStreaming: false,
          };
          return updated;
        });
      } finally {
        setIsLoading(false);
        setToolStatus(null);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading, userTurns],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const isAtLimit = userTurns >= MAX_TURNS;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 — 턴 카운터 + 초기화 버튼 */}
      {userTurns > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-surface-200 bg-surface-50">
          <TurnBadge turns={userTurns} />
          <button
            onClick={resetChat}
            className="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            새 대화 시작
          </button>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* 추천 질문 (초기 상태) */}
        {showSuggestions && messages.length === 1 && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => sendMessage(cat.q)}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-surface-300 rounded-xl text-xs font-medium text-gray-700 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors text-left"
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 px-1">자주 묻는 질문</p>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left px-3 py-2 bg-surface-100 hover:bg-surface-200 rounded-lg text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* toolStatus 표시 — dots는 MessageBubble 내부에서 처리 */}
        {isLoading && toolStatus && (
          <div className="flex gap-3">
            <div className="w-8 h-8 flex-shrink-0" />
            <span className="text-xs text-gray-400 self-center">
              {toolStatus}
            </span>
          </div>
        )}

        {/* 턴 한도 초과 알림 */}
        {isAtLimit && (
          <div className="mx-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 text-center space-y-2">
            <p className="font-medium">대화가 길어져 새 세션이 필요합니다.</p>
            <p className="text-orange-500">
              컨텍스트가 길어지면 응답 품질이 저하될 수 있습니다.
            </p>
            <button
              onClick={resetChat}
              className="mt-1 px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
            >
              새 대화 시작하기
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="border-t border-surface-300 bg-white px-4 py-3">
        {/* 경고 배너 (한도 임박) */}
        {userTurns >= WARN_TURNS && !isAtLimit && (
          <p className="text-[10px] text-yellow-600 mb-2 px-1">
            ⚠️ 대화 한도까지 {MAX_TURNS - userTurns}턴 남았습니다. 핵심 질문을
            우선 해주세요.
          </p>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isAtLimit
                ? "대화 한도에 도달했습니다. '새 대화 시작'을 눌러주세요."
                : "창업 관련 무엇이든 물어보세요... (Shift+Enter 줄바꿈)"
            }
            rows={1}
            disabled={isLoading || isAtLimit}
            className="flex-1 resize-none rounded-xl border border-surface-300 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 placeholder:text-gray-400 disabled:opacity-50 disabled:bg-surface-100 max-h-[120px] overflow-y-auto"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim() || isAtLimit}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          ※ AI 답변은 참고용입니다. 법률·세금 관련 사항은 전문가 확인을
          권장합니다.
        </p>
      </div>
    </div>
  );
}
