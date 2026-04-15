"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

// ── 타입 ────────────────────────────────────────────────────

type CardType = "text" | "textarea" | "date" | "number";

type Card = {
  id: string;
  section: string;
  field_name: string;
  description: string;
  required: boolean;
  type: CardType;
  value: string;
};

type DraftResult = {
  has_attachment: boolean;
  cards: Card[];
  disclaimer: string;
  program: { id: number; title: string; organization: string | null };
  attachment: { filename: string; file_type: string } | null;
};

// ── 유틸 ────────────────────────────────────────────────────

const groupBySection = (cards: Card[]) => {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    const list = map.get(card.section) ?? [];
    list.push(card);
    map.set(card.section, list);
  }
  return map;
};

const makeBlankCard = (): Card => ({
  id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  section: "직접 입력",
  field_name: "",
  description: "",
  required: false,
  type: "textarea",
  value: "",
});

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function SubsidyDraftPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const programId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const fetchedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!programId || fetchedRef.current) return;
    fetchedRef.current = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/subsidies/${programId}/draft`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
        const data: DraftResult = await res.json();
        setDraft(data);
        setCards(data.cards);
        if (data.cards.length > 0) setActiveId(data.cards[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "초안 생성에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [programId]);

  const triggerAutoSave = useCallback(
    (currentCards: Card[]) => {
      if (!programId) return;
      setSaveStatus("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await apiFetch(`/subsidies/${programId}/draft/answers`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cards: currentCards }),
          });
          if (!res.ok) throw new Error();
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      }, 1500);
    },
    [programId],
  );

  const updateCard = (id: string, field: keyof Card, value: string) => {
    setCards((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c,
      );
      triggerAutoSave(next);
      return next;
    });
  };

  const addCard = () => {
    const newCard = makeBlankCard();
    setCards((prev) => {
      const next = [...prev, newCard];
      triggerAutoSave(next);
      return next;
    });
    setActiveId(newCard.id);
  };

  const removeCard = (id: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) setActiveId(next[next.length - 1]?.id ?? null);
      triggerAutoSave(next);
      return next;
    });
  };

  // ── 로딩 / 에러 ────────────────────────────────────────────

  if (!programId) {
    return (
      <div className="p-8 text-center text-gray-500">
        공고 ID가 없습니다. 지원사업 목록에서 다시 시도해주세요.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-500">
        <Spinner />
        <p className="text-sm text-center">
          신청서를 분석하고 초안을 작성하는 중입니다…
          <br />
          <span className="text-xs text-gray-400">
            30~60초 소요될 수 있어요.
          </span>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button
          onClick={() => router.back()}
          className="text-brand-500 text-sm underline"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const grouped = groupBySection(cards);
  const hasAttachment = draft?.has_attachment ?? false;
  const activeCard = cards.find((c) => c.id === activeId) ?? null;

  // ── 렌더링 ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-50">
      {/* 상단 헤더 */}
      <header className="flex-none bg-white border-b border-surface-200 px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 shrink-0"
        >
          ← 돌아가기
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-gray-900 truncate leading-snug">
            {draft?.program.title ?? "신청서 초안"}
          </h1>
          {draft?.program.organization && (
            <p className="text-xs text-gray-400 truncate">
              {draft.program.organization}
            </p>
          )}
        </div>
        {saveStatus !== "idle" && (
          <span
            className={`shrink-0 text-xs ${
              saveStatus === "saving"
                ? "text-gray-400"
                : saveStatus === "saved"
                  ? "text-green-500"
                  : "text-red-400"
            }`}
          >
            {saveStatus === "saving"
              ? "저장 중…"
              : saveStatus === "saved"
                ? "저장됨"
                : "저장 실패"}
          </span>
        )}
        {hasAttachment && draft?.attachment && (
          <span className="shrink-0 text-xs text-gray-400 font-mono uppercase hidden sm:block">
            {draft.attachment.file_type}
          </span>
        )}
      </header>

      {/* 첨부파일 없음 배너 */}
      {!hasAttachment && (
        <div className="flex-none mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex gap-2 items-start text-sm">
          <span className="text-amber-500 leading-none mt-0.5">!</span>
          <div>
            <span className="font-medium text-amber-800">첨부파일 없음 — </span>
            <span className="text-amber-700">
              신청서 파일을 찾지 못했어요. 아래에서 항목을 직접 추가해주세요.
            </span>
          </div>
        </div>
      )}

      {/* 본문: 좌측 목록 + 우측 입력 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 좌측 고정 패널 ── */}
        <aside className="w-56 shrink-0 bg-white border-r border-surface-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
            {grouped.size === 0 ? (
              <p className="text-xs text-gray-400 px-2 pt-2">
                항목이 없습니다.
              </p>
            ) : (
              Array.from(grouped.entries()).map(([section, sectionCards]) => (
                <div key={section}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">
                    {section}
                  </p>
                  <ul className="space-y-0.5">
                    {sectionCards.map((card) => (
                      <li key={card.id}>
                        <button
                          onClick={() => setActiveId(card.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
                            activeId === card.id
                              ? "bg-brand-50 text-brand-600 font-medium"
                              : "text-gray-600 hover:bg-surface-100"
                          }`}
                        >
                          {card.required && (
                            <span className="text-red-400 leading-none shrink-0">
                              *
                            </span>
                          )}
                          <span className="truncate">
                            {card.field_name || "항목명 없음"}
                          </span>
                          {card.value && (
                            <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-brand-400" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* 항목 추가 버튼 */}
          <div className="flex-none border-t border-surface-200 p-2">
            <button
              onClick={addCard}
              className="w-full py-2 rounded-lg border border-dashed border-surface-300 text-xs text-gray-400 hover:border-brand-400 hover:text-brand-500 transition"
            >
              + 항목 추가
            </button>
          </div>
        </aside>

        {/* ── 우측 입력 영역 ── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {activeCard ? (
            <ActiveCardEditor
              key={activeCard.id}
              card={activeCard}
              onChange={(field, val) => updateCard(activeCard.id, field, val)}
              onRemove={
                activeCard.id.startsWith("custom_")
                  ? () => removeCard(activeCard.id)
                  : undefined
              }
              totalCards={cards.length}
              currentIndex={cards.findIndex((c) => c.id === activeId) + 1}
              onPrev={() => {
                const idx = cards.findIndex((c) => c.id === activeId);
                if (idx > 0) setActiveId(cards[idx - 1].id);
              }}
              onNext={() => {
                const idx = cards.findIndex((c) => c.id === activeId);
                if (idx < cards.length - 1) setActiveId(cards[idx + 1].id);
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              왼쪽에서 항목을 선택하거나 추가하세요.
            </div>
          )}
        </main>
      </div>

      {/* 면책 고지 */}
      {draft?.disclaimer && (
        <footer className="flex-none bg-white border-t border-surface-200 px-5 py-2">
          <p className="text-[10px] text-gray-400">{draft.disclaimer}</p>
        </footer>
      )}
    </div>
  );
}

// ── 우측 카드 에디터 ──────────────────────────────────────────

const ActiveCardEditor = ({
  card,
  onChange,
  onRemove,
  totalCards,
  currentIndex,
  onPrev,
  onNext,
}: {
  card: Card;
  onChange: (field: keyof Card, value: string) => void;
  onRemove?: () => void;
  totalCards: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) => {
  const isCustom = card.id.startsWith("custom_");
  const base =
    "w-full bg-white rounded-xl border border-surface-200 px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-brand-400 resize-y";

  return (
    <div className="flex flex-col h-full">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {/* 항목 헤더 */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">{card.section}</span>
              {card.required && (
                <span className="text-xs text-red-400 font-medium">필수</span>
              )}
            </div>
            {isCustom ? (
              <input
                type="text"
                value={card.field_name}
                onChange={(e) => onChange("field_name", e.target.value)}
                placeholder="항목명 입력"
                className="text-lg font-semibold text-gray-900 w-full bg-transparent border-b border-surface-300 pb-1 outline-none focus:border-brand-400"
              />
            ) : (
              <h2 className="text-lg font-semibold text-gray-900">
                {card.field_name}
              </h2>
            )}
            {card.description && !isCustom && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                {card.description}
              </p>
            )}
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-gray-300 hover:text-red-400 text-xl leading-none transition shrink-0"
              aria-label="항목 삭제"
            >
              ×
            </button>
          )}
        </div>

        {/* 입력 필드 */}
        {card.type === "textarea" ? (
          <textarea
            value={card.value}
            onChange={(e) => onChange("value", e.target.value)}
            rows={8}
            placeholder={
              isCustom
                ? "내용을 입력하세요"
                : `${card.field_name}을(를) 입력하세요`
            }
            className={base}
          />
        ) : card.type === "date" ? (
          <input
            type="date"
            value={card.value}
            onChange={(e) => onChange("value", e.target.value)}
            className={`${base} resize-none`}
          />
        ) : card.type === "number" ? (
          <input
            type="number"
            value={card.value}
            onChange={(e) => onChange("value", e.target.value)}
            placeholder="숫자 입력"
            className={`${base} resize-none`}
          />
        ) : (
          <input
            type="text"
            value={card.value}
            onChange={(e) => onChange("value", e.target.value)}
            placeholder={
              isCustom
                ? "내용을 입력하세요"
                : `${card.field_name}을(를) 입력하세요`
            }
            className={`${base} resize-none`}
          />
        )}
      </div>

      {/* 이전 / 다음 네비게이션 — 하단 고정 */}
      <div className="flex-none flex items-center justify-between border-t border-surface-200 bg-white px-6 py-3">
        <button
          onClick={onPrev}
          disabled={currentIndex <= 1}
          className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ← 이전
        </button>
        <span className="text-xs text-gray-400">
          {currentIndex} / {totalCards}
        </span>
        <button
          onClick={onNext}
          disabled={currentIndex >= totalCards}
          className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          다음 →
        </button>
      </div>
    </div>
  );
};

// ── 스피너 ────────────────────────────────────────────────────

const Spinner = () => (
  <svg
    className="animate-spin w-8 h-8 text-brand-400"
    viewBox="0 0 24 24"
    fill="none"
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
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);
