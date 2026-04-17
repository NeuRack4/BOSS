"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import MenuAnalysisPanel from "./MenuAnalysisPanel";

type Menu = {
  id: string;
  name: string;
  category: "음료" | "디저트" | "기타";
  price: number | null;
  is_active: boolean;
};

const CATEGORIES: Menu["category"][] = ["음료", "디저트", "기타"];
const CAT_ICONS: Record<string, string> = {
  음료: "☕",
  디저트: "🍰",
  기타: "📦",
};

const EMPTY_FORM = {
  name: "",
  category: "음료" as Menu["category"],
  price: "",
};

type OcrMenuItem = {
  name: string;
  category: "음료" | "디저트" | "기타";
  price: number | null;
  selected: boolean;
};

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "list" | "analysis";

export default function MenusPage() {
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // OCR 메뉴판 등록
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrItems, setOcrItems] = useState<OcrMenuItem[]>([]);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSaving, setOcrSaving] = useState(false);

  useEffect(() => {
    fetchMenus();
  }, []);

  const getHeaders = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { "Content-Type": "application/json", "X-User-Id": user?.id ?? "" };
  };

  const fetchMenus = async () => {
    setFetching(true);
    const headers = await getHeaders();
    const res = await fetch(`${apiUrl()}/menus/?include_inactive=true`, {
      headers,
    });
    if (res.ok) setMenus(await res.json());
    setFetching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError(null);

    const headers = await getHeaders();
    const body = {
      name: form.name.trim(),
      category: form.category,
      price: form.price ? Number(form.price) : null,
    };

    const res = editingId
      ? await fetch(`${apiUrl()}/menus/${editingId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        })
      : await fetch(`${apiUrl()}/menus/`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

    if (res.ok) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await fetchMenus();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.detail ?? "저장에 실패했습니다.");
    }
    setLoading(false);
  };

  const handleEdit = (menu: Menu) => {
    setForm({
      name: menu.name,
      category: menu.category,
      price: menu.price ? String(menu.price) : "",
    });
    setEditingId(menu.id);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const headers = await getHeaders();
    await fetch(`${apiUrl()}/menus/${id}`, { method: "DELETE", headers });
    await fetchMenus();
  };

  const handleToggleActive = async (menu: Menu) => {
    const headers = await getHeaders();
    await fetch(`${apiUrl()}/menus/${menu.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ is_active: !menu.is_active }),
    });
    await fetchMenus();
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrItems([]);

    const headers = await getHeaders();
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${apiUrl()}/ocr/menu`, {
        method: "POST",
        headers: { "X-User-Id": headers["X-User-Id"] },
        body: formData,
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).detail ?? "분석 실패",
        );
      const data = await res.json();
      const items: OcrMenuItem[] = (data.items ?? []).map(
        (item: { name: string; category?: string; price?: number | null }) => ({
          name: item.name,
          category: (["음료", "디저트", "기타"].includes(item.category ?? "")
            ? item.category
            : "기타") as OcrMenuItem["category"],
          price: item.price ?? null,
          selected: true,
        }),
      );
      setOcrItems(items);
      if (items.length === 0)
        setOcrError(
          "메뉴를 찾지 못했습니다. 선명한 사진으로 다시 시도해주세요.",
        );
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "분석에 실패했습니다.");
    }
    setOcrLoading(false);
    e.target.value = "";
  };

  const handleOcrSave = async () => {
    const selected = ocrItems.filter((i) => i.selected);
    if (!selected.length) return;
    setOcrSaving(true);
    const headers = await getHeaders();
    let saved = 0;
    for (const item of selected) {
      const res = await fetch(`${apiUrl()}/menus/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: item.name,
          category: item.category,
          price: item.price,
        }),
      });
      if (res.ok) saved++;
    }
    await fetchMenus();
    setOcrItems([]);
    setOcrOpen(false);
    if (saved > 0) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
    setOcrSaving(false);
  };

  const grouped = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = menus.filter((m) => m.category === cat);
      return acc;
    },
    {} as Record<string, Menu[]>,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">메뉴 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          카페 메뉴를 등록하면 영수증 분석 시 자동으로 매칭됩니다
        </p>
      </div>

      {/* 탭 + 메뉴판 사진 등록 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-surface-100 p-1 rounded-xl border border-surface-300">
          {(["list", "analysis"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-white text-brand-600 shadow-sm border border-surface-300"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "list" ? "메뉴 목록" : "메뉴 분석"}
            </button>
          ))}
        </div>
        {activeTab === "list" && (
          <button
            onClick={() => {
              setOcrOpen((v) => !v);
              setOcrItems([]);
              setOcrError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              ocrOpen
                ? "bg-brand-50 border-brand-500/40 text-brand-600"
                : "border-surface-300 text-gray-600 hover:border-brand-300 bg-white"
            }`}
          >
            📸 메뉴판 사진으로 등록
          </button>
        )}
      </div>

      {activeTab === "analysis" && (
        <MenuAnalysisPanel getHeaders={getHeaders} />
      )}

      {activeTab === "list" && (
        <>
          {/* 메뉴판 OCR 패널 */}
          {ocrOpen && (
            <div className="glass-card rounded-xl p-6 space-y-4 border-brand-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  메뉴판 사진 분석
                </h2>
                <span className="text-xs text-gray-400">
                  Claude Vision으로 메뉴를 자동 추출합니다
                </span>
              </div>

              {/* 업로드 버튼 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleOcrUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="w-full py-10 rounded-xl border-2 border-dashed border-surface-300 hover:border-brand-400 text-sm text-gray-400 hover:text-brand-500 transition-all disabled:opacity-50 flex flex-col items-center gap-2"
              >
                {ocrLoading ? (
                  <>
                    <span className="animate-pulse text-2xl">📸</span>
                    <span>메뉴판 분석 중...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📷</span>
                    <span>사진을 클릭해 업로드하세요</span>
                    <span className="text-xs text-gray-400">
                      JPG · PNG · WEBP · 최대 5MB
                    </span>
                  </>
                )}
              </button>

              {ocrError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {ocrError}
                </p>
              )}

              {/* 추출 결과 */}
              {ocrItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {ocrItems.length}개 메뉴 추출됨
                    </p>
                    <button
                      onClick={() =>
                        setOcrItems((prev) =>
                          prev.map((i) => ({
                            ...i,
                            selected: !prev.every((p) => p.selected),
                          })),
                        )
                      }
                      className="text-xs text-brand-500 hover:text-brand-600"
                    >
                      {ocrItems.every((i) => i.selected)
                        ? "전체 해제"
                        : "전체 선택"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {ocrItems.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() =>
                          setOcrItems((prev) =>
                            prev.map((i, j) =>
                              j === idx ? { ...i, selected: !i.selected } : i,
                            ),
                          )
                        }
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          item.selected
                            ? "bg-brand-50 border-brand-500/40"
                            : "bg-white border-surface-200 opacity-60"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                            item.selected
                              ? "bg-brand-500 border-brand-500 text-white"
                              : "border-surface-300"
                          }`}
                        >
                          {item.selected && "✓"}
                        </span>
                        <span className="text-sm">
                          {CAT_ICONS[item.category] ?? "📦"}
                        </span>
                        <span className="flex-1 text-sm font-medium text-gray-800">
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.category}
                        </span>
                        <span className="text-sm font-medium text-gray-700 w-20 text-right">
                          {item.price != null
                            ? `${item.price.toLocaleString()}원`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleOcrSave}
                    disabled={ocrSaving || ocrItems.every((i) => !i.selected)}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ocrSaving
                      ? "등록 중..."
                      : `선택한 ${ocrItems.filter((i) => i.selected).length}개 메뉴 등록`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 입력 폼 */}
          <div
            className={`glass-card rounded-xl p-6 ${editingId ? "border-brand-500/40 glow-blue" : ""}`}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">
                {editingId ? "메뉴 수정" : "메뉴 추가"}
              </h2>
              {editingId && (
                <button
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setEditingId(null);
                    setError(null);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  취소
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    메뉴명
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="예: 아이스 아메리카노"
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    기본 가격 (원)
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="예: 4500"
                    min={0}
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  />
                </div>
              </div>

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
                      {CAT_ICONS[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !form.name.trim()}
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
                    ? "저장 중..."
                    : editingId
                      ? "수정 저장"
                      : "메뉴 추가"}
              </button>
            </form>
          </div>

          {/* 메뉴 목록 */}
          {fetching ? (
            <p className="text-sm text-gray-400 text-center py-8">
              불러오는 중...
            </p>
          ) : menus.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-3xl mb-3">☕</p>
              <p className="text-sm text-gray-500">등록된 메뉴가 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">
                위 폼에서 직접 추가하거나, 우측 상단{" "}
                <span className="text-brand-500">📸 메뉴판 사진으로 등록</span>{" "}
                버튼을 사용하세요
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 items-start">
              {CATEGORIES.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                return (
                  <div
                    key={cat}
                    className="glass-card rounded-xl p-5 w-[calc(50%-0.5rem)]"
                  >
                    <h3 className="text-sm font-bold text-gray-700 mb-3">
                      {CAT_ICONS[cat]} {cat}{" "}
                      <span className="text-gray-400 font-normal">
                        ({items.length})
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {items.map((menu) => (
                        <div
                          key={menu.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
                        ${menu.is_active ? "bg-white border-surface-300" : "bg-surface-50 border-surface-200 opacity-50"}`}
                        >
                          {/* 메뉴명 */}
                          <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                            {menu.name}
                          </span>
                          {/* 가격 — 중앙 고정 */}
                          <span className="w-20 text-center text-xs text-gray-400 shrink-0 -translate-x-3">
                            {menu.price != null
                              ? `${menu.price.toLocaleString()}원`
                              : "—"}
                          </span>
                          {!menu.is_active && (
                            <span className="text-xs text-gray-400 shrink-0">
                              (비활성)
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(menu)}
                              className="text-gray-400 hover:text-brand-500 p-1 transition-colors"
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
                              onClick={() => handleDelete(menu.id)}
                              className="text-gray-400 hover:text-red-500 p-1 transition-colors"
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
