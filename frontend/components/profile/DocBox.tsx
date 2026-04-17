"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { exportMarkdownAsPdf } from "@/lib/chatbot/pdf_export";

interface DraftRow {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const DOC_TYPE_LABEL: Record<string, { label: string; icon: string }> = {
  job_posting:          { label: "채용공고",     icon: "📝" },
  labor_contract:       { label: "근로계약서",   icon: "📄" },
  employment_contract:  { label: "근로계약서",   icon: "📄" },
  business_reg:         { label: "사업자등록",   icon: "📋" },
  food_biz_license:     { label: "식품위생신고", icon: "🍽" },
  lease_contract:       { label: "임대차계약서", icon: "🏠" },
};

const FILTER_TYPES = ["전체", "채용공고", "근로계약서", "사업자등록", "식품위생신고", "임대차계약서"];
const FILTER_TYPE_MAP: Record<string, string[]> = {
  "채용공고":     ["job_posting"],
  "근로계약서":   ["labor_contract", "employment_contract"],
  "사업자등록":   ["business_reg"],
  "식품위생신고": ["food_biz_license"],
  "임대차계약서": ["lease_contract"],
};

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

function getDocLabel(type: string) {
  return DOC_TYPE_LABEL[type] ?? { label: type, icon: "📁" };
}

export default function DocBox() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("전체");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("drafts")
      .select("id, type, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setDrafts((data as DraftRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 서류를 삭제하시겠습니까?")) return;
    setDeletingId(id);
    await supabase.from("drafts").delete().eq("id", id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setDeletingId(null);
  };

  const handleDownload = async (draft: DraftRow) => {
    const meta = draft.metadata ?? {};
    const title = (meta.title as string) ?? draft.type;

    if (draft.type === "labor_contract" || draft.type === "employment_contract") {
      const content = (meta.draft as string) ?? "";
      await exportMarkdownAsPdf(content, title);
    } else {
      const platforms = meta.platforms as Record<string, string> | undefined;
      const content = platforms
        ? `## 당근마켓\n\n${platforms.karrot ?? ""}\n\n---\n\n## 알바천국\n\n${platforms.alba ?? ""}\n\n---\n\n## 사람인\n\n${platforms.saramin ?? ""}`
        : JSON.stringify(meta, null, 2);
      await exportMarkdownAsPdf(content, title);
    }
  };

  const filtered = filter === "전체"
    ? drafts
    : drafts.filter((d) => (FILTER_TYPE_MAP[filter] ?? []).includes(d.type));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        서류 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TYPES.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-brand-500 text-white"
                : "bg-surface-100 text-gray-500 hover:bg-surface-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 서류 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          <p className="text-3xl mb-3">📂</p>
          <p>저장된 서류가 없습니다.</p>
          <p className="text-xs mt-2 text-gray-300">
            챗봇에서 채용공고·근로계약서를 생성하거나<br />
            채용 메뉴에서 서류를 작성하면 이곳에 저장됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((draft) => {
            const { label, icon } = getDocLabel(draft.type);
            const title = (draft.metadata?.title as string) ?? label;
            return (
              <div
                key={draft.id}
                className="flex items-center gap-3 p-3 bg-white border border-surface-200 rounded-xl hover:border-brand-200 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                  <p className="text-xs text-gray-400">
                    {label} · {formatDate(draft.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(draft)}
                    className="px-3 py-1.5 bg-brand-50 border border-brand-200 text-brand-600 text-xs font-medium rounded-lg hover:bg-brand-100 transition-colors"
                  >
                    ⬇ 다운로드
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    disabled={deletingId === draft.id}
                    className="px-2 py-1.5 text-gray-300 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-300 text-center pt-2">
        챗봇·채용 메뉴에서 생성한 모든 서류가 저장됩니다.
      </p>
    </div>
  );
}
