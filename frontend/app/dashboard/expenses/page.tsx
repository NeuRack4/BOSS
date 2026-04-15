"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type ExpenseEntry = {
  id: string;
  date: string;
  amount: number;
  category: string;
  memo: string | null;
  created_at: string;
};

const CATEGORIES = [
  { value: "rent", label: "월세·임대료", icon: "🏠" },
  { value: "ingredient", label: "재료비", icon: "🧃" },
  { value: "labor", label: "인건비", icon: "👤" },
  { value: "utility", label: "공과금", icon: "💡" },
  { value: "other", label: "기타", icon: "📦" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  amount: "",
  category: "rent",
  memo: "",
};

export default function ExpensesPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetchEntries();
  }, []);

  const getAuthHeader = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { "X-User-Id": user.id } : {};
  };

  const fetchEntries = async () => {
    setFetching(true);
    const headers = await getAuthHeader();
    try {
      const res = await fetch(`${apiUrl}/expenses/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    }
    setFetching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;

    setLoading(true);
    setError(null);

    const headers = {
      ...(await getAuthHeader()),
      "Content-Type": "application/json",
    };
    const body = JSON.stringify({
      date: form.date,
      amount: Number(form.amount),
      category: form.category,
      memo: form.memo || null,
    });

    try {
      const url = editingId
        ? `${apiUrl}/expenses/${editingId}`
        : `${apiUrl}/expenses/`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers, body });

      if (!res.ok) throw new Error();
      if (editingId) {
        setForm(EMPTY_FORM);
      } else {
        setForm((prev) => ({ ...prev, amount: "", memo: "" }));
      }
      setEditingId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await fetchEntries();
    } catch {
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    }
    setLoading(false);
  };

  const handleEdit = (entry: ExpenseEntry) => {
    setForm({
      date: entry.date,
      amount: String(entry.amount),
      category: entry.category,
      memo: entry.memo ?? "",
    });
    setEditingId(entry.id);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const headers = await getAuthHeader();
    try {
      await fetch(`${apiUrl}/expenses/${id}`, { method: "DELETE", headers });
      if (editingId === id) {
        setForm(EMPTY_FORM);
        setEditingId(null);
      }
      await fetchEntries();
    } catch {
      setError("삭제에 실패했습니다.");
    }
    setDeletingId(null);
  };

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  // 카테고리별 합계
  const categoryTotals = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">비용 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          월세·재료비·인건비 등 지출을 기록하고 순수익을 확인하세요
        </p>
      </div>

      {/* 카테고리별 합계 카드 */}
      {!fetching && entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.filter((c) => categoryTotals[c.value]).map((cat) => (
            <div key={cat.value} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{cat.icon}</span>
                <p className="text-xs text-gray-400 font-medium">{cat.label}</p>
              </div>
              <p className="text-base font-bold text-gray-900">
                {(categoryTotals[cat.value] ?? 0).toLocaleString()}원
              </p>
            </div>
          ))}
          <div className="glass-card rounded-xl p-4 border-red-200/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">📊</span>
              <p className="text-xs text-gray-400 font-medium">총 지출</p>
            </div>
            <p className="text-base font-bold text-red-500">
              {totalAmount.toLocaleString()}원
            </p>
          </div>
        </div>
      )}

      {/* 입력/수정 폼 */}
      <div
        className={`glass-card rounded-xl p-6 ${editingId ? "border-brand-500/40 glow-blue" : ""}`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">
            {editingId ? "비용 수정" : "비용 입력"}
          </h2>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              취소
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 날짜 + 금액 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                날짜
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                금액 (원)
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="예: 800000"
                min={1}
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat.value })}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${
                      form.category === cat.value
                        ? "bg-brand-50 border-brand-500/40 text-brand-600"
                        : "border-surface-300 text-gray-500 hover:border-brand-300"
                    }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              메모 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="특이사항을 입력하세요"
              className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !form.amount}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all
              ${
                success
                  ? "bg-green-500 text-white"
                  : "bg-brand-500 hover:bg-brand-600 text-white glow-blue disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
          >
            {success
              ? "✓ 완료"
              : loading
                ? editingId
                  ? "수정 중..."
                  : "저장 중..."
                : editingId
                  ? "수정 저장"
                  : "비용 저장"}
          </button>
        </form>
      </div>

      {/* 입력 내역 */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">입력 내역</h2>
          {entries.length > 0 && (
            <span className="text-sm font-semibold text-red-500">
              합계: {totalAmount.toLocaleString()}원
            </span>
          )}
        </div>

        {fetching ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-3 text-gray-300">📦</p>
            <p className="text-sm text-gray-400">아직 입력된 비용이 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">
              위 폼에서 첫 지출을 기록해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const cat = CATEGORY_MAP[entry.category];
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors
                    ${
                      editingId === entry.id
                        ? "bg-brand-50/50 border-brand-500/30"
                        : "bg-surface-100 border-surface-300"
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center text-base flex-shrink-0">
                      {cat?.icon ?? "📦"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {entry.date} · {cat?.label ?? entry.category}
                      </p>
                      {entry.memo && (
                        <p className="text-xs text-gray-400 truncate">
                          {entry.memo}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-red-500">
                      -{entry.amount.toLocaleString()}원
                    </p>
                    <button
                      onClick={() => handleEdit(entry)}
                      className="text-gray-400 hover:text-brand-500 transition-colors p-1"
                    >
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-40"
                    >
                      {deletingId === entry.id ? (
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
