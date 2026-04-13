"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type SaleEntry = {
  id: string;
  date: string;
  amount: number;
  category: string;
  time_slot: string;
  memo: string;
  created_at: string;
};

const CATEGORIES = ["음료", "디저트", "기타"];
const TIME_SLOTS = ["오전", "오후", "저녁"];

export default function SalesPage() {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    category: "음료",
    time_slot: "오전",
    memo: "",
  });

  const [entries, setEntries] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 매출 내역 불러오기
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
      .limit(20);

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
    setLoading(false);
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

      {/* 입력 폼 */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">매출 입력</h2>
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
            {success ? "✓ 저장 완료" : loading ? "저장 중..." : "매출 저장"}
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
                className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-surface-300"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 text-xs font-bold">
                    {entry.category[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {entry.date} · {entry.time_slot}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.category}
                      {entry.memo && ` · ${entry.memo}`}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {entry.amount.toLocaleString()}원
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
