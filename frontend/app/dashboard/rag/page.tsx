"use client";

import { useState } from "react";
import ResultCard from "@/components/rag/ResultCard";
import LlmSummaryPanel from "@/components/rag/LlmSummaryPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "license", label: "인허가" },
  { value: "tax", label: "세금" },
  { value: "labor", label: "근로" },
  { value: "lease", label: "임대차" },
  { value: "subsidy", label: "지원사업" },
  { value: "regulation", label: "규제법령" },
];

interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, string>;
  similarity: number;
  disclaimer: string;
}

export default function RagPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setResults([]);
    setSelectedIds(new Set());
    setSummary(null);
    setSubmittedQuery(q);

    try {
      const res = await fetch(`${API_BASE}/rag/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          category: category || null,
          match_count: 8,
          match_threshold: 0.3,
        }),
      });
      if (!res.ok) throw new Error(`검색 실패 (${res.status})`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      if (data.length > 0) setDisclaimer(data[0].disclaimer);

      // 상위 3개 자동 선택 후 요약 실행
      const topIds = new Set(data.slice(0, 3).map((r) => r.id));
      setSelectedIds(topIds);
      if (data.length > 0) {
        await runSummarize(q, data.slice(0, 3));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.",
      );
    } finally {
      setSearching(false);
    }
  };

  const runSummarize = async (q: string, chunks: SearchResult[]) => {
    setSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch(`${API_BASE}/rag/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          chunks: chunks.map((c) => ({
            content: c.content,
            metadata: c.metadata,
          })),
        }),
      });
      if (!res.ok) throw new Error(`요약 실패 (${res.status})`);
      const data = await res.json();
      setSummary(data.summary);
      if (data.disclaimer) setDisclaimer(data.disclaimer);
    } catch {
      setSummary("AI 요약을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSummarizing(false);
    }
  };

  const toggleSelect = (result: SearchResult) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(result.id)) {
        next.delete(result.id);
      } else {
        next.add(result.id);
      }
      return next;
    });
  };

  const handleReSummarize = () => {
    const selected = results.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;
    runSummarize(submittedQuery, selected);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-black text-gray-900">법령 검색</h1>
        <p className="text-sm text-gray-500 mt-1">
          인허가·세금·근로·임대차 관련 법령을 검색하고 AI 해설을 받아보세요.
        </p>
      </div>

      {/* 검색바 */}
      <form onSubmit={handleSearch} className="flex flex-col gap-3">
        {/* 카테고리 필터 */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                category === cat.value
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-gray-600 border-surface-300 hover:border-brand-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 검색 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 식품위생법 영업신고, 부가세 신고 기한, 최저임금..."
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-surface-300 bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
          {error}
        </p>
      )}

      {/* 메인 2-패널 */}
      {(results.length > 0 || searching) && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* 좌측: 검색 결과 */}
          <div className="flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {results.length}건 검색됨
                {selectedIds.size > 0 && ` · ${selectedIds.size}개 선택`}
              </p>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleReSummarize}
                  disabled={summarizing}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  선택 항목 재요약 →
                </button>
              )}
            </div>

            {searching && (
              <div className="flex justify-center py-12 text-gray-400 text-sm">
                검색 중...
              </div>
            )}

            {!searching &&
              results.map((result, i) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  index={i + 1}
                  isSelected={selectedIds.has(result.id)}
                  onClick={() => toggleSelect(result)}
                />
              ))}
          </div>

          {/* 우측: AI 요약 패널 */}
          <div className="bg-white border border-surface-300 rounded-2xl p-5 overflow-y-auto">
            <LlmSummaryPanel
              query={submittedQuery}
              summary={summary}
              loading={summarizing}
              disclaimer={disclaimer}
            />
          </div>
        </div>
      )}

      {/* 초기 상태 */}
      {results.length === 0 && !searching && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
          <span className="text-5xl">⚖</span>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">
              법령을 검색해보세요
            </p>
            <p className="text-xs mt-1">
              영업신고, 식품위생법, 근로계약, 부가세 등 궁금한 키워드를
              입력하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {[
              "영업신고 절차",
              "부가세 신고 기한",
              "최저임금 2024",
              "임대차 보증금",
            ].map((hint) => (
              <button
                key={hint}
                onClick={() => {
                  setQuery(hint);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-surface-300 bg-white hover:border-brand-300 text-gray-600 transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
