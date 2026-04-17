"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import ReviewResult, {
  type ReviewResult as ReviewResultType,
} from "./ReviewResult";

export type HistoryItem = {
  id: string;
  title: string;
  doc_type: string;
  user_role: string;
  gap_ratio: number | null;
  eul_ratio: number | null;
  created_at: string;
};

type DetailData = {
  id: string;
  title: string;
  doc_type: string;
  review_result: ReviewResultType;
  created_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DOC_TYPE_LABEL: Record<string, string> = {
  계약서: "계약서",
  제안서: "제안서",
  기타: "기타",
};

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  "갑(고용인/발주자)": {
    label: "갑",
    className: "bg-blue-50 text-blue-600 border-blue-200",
  },
  "을(피고용인/수주자)": {
    label: "을",
    className: "bg-orange-50 text-orange-600 border-orange-200",
  },
  미지정: {
    label: "미지정",
    className: "bg-gray-50 text-gray-400 border-gray-200",
  },
};

const getRoleBadge = (role: string) =>
  ROLE_BADGE[role] ?? {
    label: role,
    className: "bg-gray-50 text-gray-500 border-gray-200",
  };

export default function ReviewHistory({ userId }: { userId: string }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, DetailData>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/doc-review/history`, {
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) throw new Error("이력을 불러오지 못했습니다.");
      setItems(await res.json());
    } catch {
      setError("이력을 불러오지 못했습니다.");
    } finally {
      setFetching(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleToggle = async (item: HistoryItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (detailMap[item.id]) return;

    setDetailLoading(item.id);
    try {
      const res = await fetch(`${API_BASE}/doc-review/${item.id}`, {
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) throw new Error();
      const data: DetailData = await res.json();
      setDetailMap((prev) => ({ ...prev, [item.id]: data }));
    } catch {
      setError("상세 결과를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/doc-review/${id}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      if (expandedId === id) setExpandedId(null);
      setDetailMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchHistory();
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  if (fetching) {
    return (
      <div className="glass-card rounded-xl p-10 text-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-6">
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-xl p-10 text-center space-y-3">
        <FileText size={36} className="mx-auto text-gray-200" />
        <p className="text-sm text-gray-400">아직 검토 이력이 없습니다</p>
        <p className="text-xs text-gray-400">
          새 검토 탭에서 서류를 분석해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        const detail = detailMap[item.id];
        const isLoadingDetail = detailLoading === item.id;
        const isDeleting = deletingId === item.id;
        const total = (item.gap_ratio ?? 0) + (item.eul_ratio ?? 0) || 100;
        const gapPct =
          item.gap_ratio != null
            ? Math.round((item.gap_ratio / total) * 100)
            : null;

        return (
          <div
            key={item.id}
            className="border border-surface-200 rounded-xl overflow-hidden"
          >
            {/* 목록 행 */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 bg-surface-50 hover:bg-surface-100 cursor-pointer transition-colors"
              onClick={() => handleToggle(item)}
            >
              <FileText size={16} className="text-gray-400 shrink-0" />

              {/* 제목 + 유형 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {DOC_TYPE_LABEL[item.doc_type] ?? item.doc_type}
                  <span>·</span>
                  {(() => {
                    const badge = getRoleBadge(item.user_role);
                    return (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                  <span>·</span>
                  {formatDate(item.created_at)}
                </p>
              </div>

              {/* 이득/손해 비율 미니 바 */}
              {gapPct != null && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden flex bg-surface-200">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${gapPct}%` }}
                    />
                    <div className="h-full bg-orange-400 flex-1" />
                  </div>
                  <span className="text-[10px] whitespace-nowrap">
                    <span className="text-blue-500 font-medium">
                      갑{item.gap_ratio}
                    </span>
                    <span className="text-gray-300 mx-0.5">:</span>
                    <span className="text-orange-400 font-medium">
                      {item.eul_ratio}을
                    </span>
                  </span>
                </div>
              )}

              {/* 삭제 버튼 */}
              <button
                onClick={(e) => handleDelete(item.id, e)}
                disabled={isDeleting}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-40 shrink-0"
                title="삭제"
              >
                {isDeleting ? (
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
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                ) : (
                  <Trash2 size={15} />
                )}
              </button>

              {/* 펼치기/접기 */}
              <span className="text-gray-400 shrink-0">
                {isExpanded ? (
                  <ChevronUp size={15} />
                ) : (
                  <ChevronDown size={15} />
                )}
              </span>
            </div>

            {/* 상세 결과 (인라인 펼치기) */}
            {isExpanded && (
              <div className="border-t border-surface-200 bg-white px-4 py-5">
                {isLoadingDetail ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 text-brand-500">
                      <span className="animate-pulse text-xl">✦</span>
                      <p className="text-sm">결과를 불러오고 있습니다...</p>
                    </div>
                  </div>
                ) : detail ? (
                  <ReviewResult result={detail.review_result} />
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">
                    결과를 불러오지 못했습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
