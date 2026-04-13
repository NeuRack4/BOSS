"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type SaleEntry = {
  id: string;
  date: string;
  amount: number;
  category: string;
  time_slot: string;
  memo: string | null;
  created_at: string;
};

const CATEGORIES = ["음료", "디저트", "기타"];
const TIME_SLOTS = ["오전", "오후", "저녁"];

const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  amount: "",
  category: "음료",
  time_slot: "오전",
  memo: "",
};

export default function SalesPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [entries, setEntries] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setError("데이터를 불러오지 못했습니다.");
    } else {
      setEntries(data ?? []);
    }
    setFetching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;

    setLoading(true);
    setError(null);

    if (editingId) {
      // 수정 모드
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          date: form.date,
          amount: Number(form.amount),
          category: form.category,
          time_slot: form.time_slot,
          memo: form.memo || null,
        })
        .eq("id", editingId);

      if (updateError) {
        setError("수정에 실패했습니다. 다시 시도해주세요.");
      } else {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        await fetchEntries();
      }
    } else {
      // 신규 입력 모드
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("sales").insert({
        user_id: user?.id,
        date: form.date,
        amount: Number(form.amount),
        category: form.category,
        time_slot: form.time_slot,
        memo: form.memo || null,
      });

      if (insertError) {
        setError("저장에 실패했습니다. 다시 시도해주세요.");
      } else {
        setForm((prev) => ({ ...prev, amount: "", memo: "" }));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        await fetchEntries();
      }
    }
    setLoading(false);
  };

  const handleEdit = (entry: SaleEntry) => {
    setForm({
      date: entry.date,
      amount: String(entry.amount),
      category: entry.category,
      time_slot: entry.time_slot,
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
    const { error: deleteError } = await supabase
      .from("sales")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError("삭제에 실패했습니다. 다시 시도해주세요.");
    } else {
      if (editingId === id) {
        setForm(EMPTY_FORM);
        setEditingId(null);
      }
      await fetchEntries();
    }
    setDeletingId(null);
  };

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">매출 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          일별 매출을 기록하고 추적하세요
        </p>
      </div>

      {/* 입력/수정 폼 */}
      <div
        className={`glass-card rounded-xl p-6 ${editingId ? "border-brand-500/40 glow-blue" : ""}`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">
            {editingId ? "매출 수정" : "매출 입력"}
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
                매출액 (원)
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="예: 150000"
                min={1}
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>
          </div>

          {/* 카테고리 + 시간대 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                카테고리
              </label>
              <div className="flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                      ${
                        form.category === cat
                          ? "bg-brand-50 border-brand-500/40 text-brand-600"
                          : "border-surface-300 text-gray-500 hover:border-brand-300"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                시간대
              </label>
              <div className="flex gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setForm({ ...form, time_slot: slot })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                      ${
                        form.time_slot === slot
                          ? "bg-brand-50 border-brand-500/40 text-brand-600"
                          : "border-surface-300 text-gray-500 hover:border-brand-300"
                      }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
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

          {/* 에러 메시지 */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* 제출 버튼 */}
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
                  : "매출 저장"}
          </button>
        </form>
      </div>

      {/* 입력 내역 */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">입력 내역</h2>
          {entries.length > 0 && (
            <span className="text-sm font-semibold text-brand-600">
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
            <p className="text-3xl mb-3 text-gray-300">₩</p>
            <p className="text-sm text-gray-400">아직 입력된 매출이 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">
              위 폼에서 첫 매출을 기록해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
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
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 text-xs font-bold flex-shrink-0">
                    {entry.category[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {entry.date} · {entry.time_slot}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {entry.category}
                      {entry.memo && ` · ${entry.memo}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">
                    {entry.amount.toLocaleString()}원
                  </p>
                  {/* 수정 버튼 */}
                  <button
                    onClick={() => handleEdit(entry)}
                    className="text-gray-400 hover:text-brand-500 transition-colors p-1"
                    title="수정"
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
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-40"
                    title="삭제"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
