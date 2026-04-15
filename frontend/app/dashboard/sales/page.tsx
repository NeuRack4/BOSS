"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Menu = {
  id: string;
  name: string;
  category: string;
  price: number | null;
};

type CartItem = {
  menu: Menu;
  quantity: number;
};

type SaleItemEntry = {
  id: string;
  receipt_id: string | null;
  menu_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
  date: string;
  time_slot: string;
  source: string;
  created_at: string;
};

type ReceiptGroup = {
  receipt_id: string;
  date: string;
  time_slot: string;
  source: string;
  total: number;
  items: SaleItemEntry[];
};

type OcrItem = {
  name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  menu_id: string | null;
  matched_name: string | null;
  is_matched: boolean;
  category: string;
};

type OcrResult = {
  date: string | null;
  time_slot: string;
  items: OcrItem[];
  total: number | null;
};

type CsvRow = {
  date: string;
  time_slot: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  category: string;
  menu_id: string | null;
  selected: boolean;
};

type CsvImportResult = {
  total_rows: number;
  parsed_rows: number;
  skipped_rows: number;
  columns_detected: Record<string, string | null>;
  rows: Omit<CsvRow, "selected">[];
};

const TIME_SLOTS: { value: string; label: string }[] = [
  { value: "09:00-11:30", label: "9-11:30" },
  { value: "11:30-14:00", label: "11:30-14" },
  { value: "14:00-16:30", label: "14-16:30" },
  { value: "16:30-19:00", label: "16:30-19" },
  { value: "19:00-21:30", label: "19-21:30" },
];
const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SalesPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [timeSlot, setTimeSlot] = useState("09:00-11:30");
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [qty, setQty] = useState(1);

  const [entries, setEntries] = useState<SaleItemEntry[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [savingOcr, setSavingOcr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV/Excel 파일 가져오기
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvSaving, setCsvSaving] = useState(false);

  useEffect(() => {
    fetchMenus();
    fetchEntries();
  }, []);

  const getAuthHeader = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { "X-User-Id": user?.id ?? "" };
  };

  const fetchMenus = async () => {
    const h = await getAuthHeader();
    const res = await fetch(`${apiUrl()}/menus/`, { headers: h });
    if (res.ok) setMenus(await res.json());
  };

  const fetchEntries = async () => {
    setFetching(true);
    const h = await getAuthHeader();
    const res = await fetch(`${apiUrl()}/sales-items/?`, { headers: h });
    if (res.ok) setEntries(await res.json());
    setFetching(false);
  };

  const addToCart = () => {
    if (!selectedMenu) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.menu.id === selectedMenu.id);
      if (existing) {
        return prev.map((c) =>
          c.menu.id === selectedMenu.id
            ? { ...c, quantity: c.quantity + qty }
            : c,
        );
      }
      return [...prev, { menu: selectedMenu, quantity: qty }];
    });
    setSelectedMenu(null);
    setQty(1);
  };

  const removeFromCart = (menuId: string) => {
    setCart((prev) => prev.filter((c) => c.menu.id !== menuId));
  };

  const cartTotal = cart.reduce(
    (s, c) => s + (c.menu.price ?? 0) * c.quantity,
    0,
  );

  const handleSave = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);

    const h = await getAuthHeader();
    const payload = {
      items: cart.map((c) => ({
        menu_id: c.menu.id,
        menu_name: c.menu.name,
        category: c.menu.category,
        date,
        quantity: c.quantity,
        unit_price: c.menu.price ?? 0,
        amount: (c.menu.price ?? 0) * c.quantity,
        time_slot: timeSlot,
        source: "manual",
      })),
    };

    const res = await fetch(`${apiUrl()}/sales-items/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...h },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setCart([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await fetchEntries();
    } else {
      setError("저장에 실패했습니다.");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const h = await getAuthHeader();
    await fetch(`${apiUrl()}/sales-items/${id}`, {
      method: "DELETE",
      headers: h,
    });
    await fetchEntries();
  };

  // OCR
  const handleReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);

    const h = await getAuthHeader();
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl()}/ocr/receipt`, {
        method: "POST",
        headers: h,
        body: formData,
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).detail ?? "OCR 실패",
        );
      setOcrResult(await res.json());
    } catch (err: unknown) {
      setOcrError(
        err instanceof Error ? err.message : "OCR 처리에 실패했습니다.",
      );
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOcrSave = async () => {
    if (!ocrResult?.items.length) return;
    setSavingOcr(true);
    const h = await getAuthHeader();
    const today = new Date().toISOString().split("T")[0];
    const payload = {
      items: ocrResult.items.map((item) => ({
        menu_id: item.menu_id,
        menu_name: item.matched_name ?? item.name,
        category: item.category,
        date: ocrResult.date ?? today,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        time_slot: ocrResult.time_slot,
        source: "ocr",
      })),
    };
    try {
      const res = await fetch(`${apiUrl()}/sales-items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setOcrResult(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await fetchEntries();
    } catch {
      setOcrError("저장에 실패했습니다.");
    } finally {
      setSavingOcr(false);
    }
  };

  // CSV/Excel 파일 업로드 핸들러
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    setCsvError(null);
    setCsvResult(null);
    setCsvRows([]);

    const h = await getAuthHeader();
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl()}/ocr/sales-file`, {
        method: "POST",
        headers: h,
        body: formData,
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).detail ?? "파일 분석 실패",
        );
      const data: CsvImportResult = await res.json();
      setCsvResult(data);
      setCsvRows(data.rows.map((r) => ({ ...r, selected: true })));
    } catch (err) {
      setCsvError(
        err instanceof Error ? err.message : "파일 처리에 실패했습니다.",
      );
    } finally {
      setCsvLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const handleCsvSave = async () => {
    const selected = csvRows.filter((r) => r.selected);
    if (!selected.length) return;
    setCsvSaving(true);

    const h = await getAuthHeader();
    // receipt_id를 공유해 같은 날짜 파일 묶음으로 인식
    const payload = {
      items: selected.map((r) => ({
        menu_id: r.menu_id,
        menu_name: r.menu_name,
        category: r.category,
        date: r.date,
        quantity: r.quantity,
        unit_price: r.unit_price,
        amount: r.amount,
        time_slot: r.time_slot,
        source: "manual",
      })),
    };

    try {
      const res = await fetch(`${apiUrl()}/sales-items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...h },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setCsvResult(null);
      setCsvRows([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await fetchEntries();
    } catch {
      setCsvError("저장에 실패했습니다.");
    } finally {
      setCsvSaving(false);
    }
  };

  const toggleAllCsvRows = () => {
    const allSelected = csvRows.every((r) => r.selected);
    setCsvRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  // receipt_id 기준으로 입력 내역 그룹핑
  // receipt_id 없는 구데이터는 created_at 초 단위 + date + time_slot 으로 묶음
  const receiptGroups: ReceiptGroup[] = Object.values(
    entries.reduce(
      (acc, entry) => {
        const key =
          entry.receipt_id ??
          `${entry.date}_${entry.time_slot}_${entry.source}_${entry.created_at.slice(0, 19)}`;
        if (!acc[key]) {
          acc[key] = {
            receipt_id: key,
            date: entry.date,
            time_slot: entry.time_slot,
            source: entry.source,
            total: 0,
            items: [],
          };
        }
        acc[key].items.push(entry);
        acc[key].total += entry.amount;
        return acc;
      },
      {} as Record<string, ReceiptGroup>,
    ),
  ).sort((a, b) => b.items[0].created_at.localeCompare(a.items[0].created_at));

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteGroup = async (group: ReceiptGroup) => {
    const h = await getAuthHeader();
    await Promise.all(
      group.items.map((item) =>
        fetch(`${apiUrl()}/sales-items/${item.id}`, {
          method: "DELETE",
          headers: h,
        }),
      ),
    );
    await fetchEntries();
  };

  // 카테고리별 메뉴 그룹
  const menuGroups = ["음료", "디저트", "기타"].reduce(
    (acc, cat) => {
      acc[cat] = menus.filter((m) => m.category === cat);
      return acc;
    },
    {} as Record<string, Menu[]>,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">매출 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          메뉴를 선택해 매출을 기록하거나 영수증으로 입력하세요
        </p>
      </div>

      {/* 입력 폼 */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">매출 입력</h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleReceiptUpload}
            />
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleCsvUpload}
            />
            <button
              type="button"
              onClick={() => {
                setCsvResult(null);
                setCsvRows([]);
                setCsvError(null);
                csvInputRef.current?.click();
              }}
              disabled={csvLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              {csvLoading ? "분석 중…" : "📊 파일로 가져오기"}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-50"
            >
              {ocrLoading ? "분석 중…" : "📷 영수증으로 입력"}
            </button>
          </div>
        </div>

        {ocrError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {ocrError}
          </p>
        )}
        {ocrLoading && (
          <p className="text-xs text-brand-500 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
            영수증을 분석하고 있습니다…
          </p>
        )}

        {/* CSV/Excel 가져오기 로딩 */}
        {csvLoading && (
          <div className="border border-green-200 rounded-xl bg-green-50/50 p-4 text-center">
            <p className="text-sm text-green-700 font-medium animate-pulse">
              📊 AI가 파일 구조를 분석하고 있습니다…
            </p>
            <p className="text-xs text-green-500 mt-1">
              컬럼명이 달라도 자동으로 인식합니다
            </p>
          </div>
        )}
        {csvError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {csvError}
          </p>
        )}

        {/* CSV 미리보기 */}
        {csvResult && csvRows.length > 0 && (
          <div className="border border-green-200 rounded-xl bg-green-50/30 p-4 space-y-3">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-800">
                  파일 분석 완료 — {csvResult.parsed_rows}개 항목 인식
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  {csvResult.skipped_rows > 0 &&
                    `${csvResult.skipped_rows}개 행 건너뜀 · `}
                  감지된 컬럼:{" "}
                  {Object.entries(csvResult.columns_detected)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}→${v}`)
                    .join(", ")}
                </p>
              </div>
              <button
                onClick={() => {
                  setCsvResult(null);
                  setCsvRows([]);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ 취소
              </button>
            </div>

            {/* 행 목록 */}
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              <div className="flex items-center justify-between text-xs text-gray-500 px-2 mb-2">
                <button
                  onClick={toggleAllCsvRows}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  {csvRows.every((r) => r.selected) ? "전체 해제" : "전체 선택"}
                </button>
                <span>{csvRows.filter((r) => r.selected).length}개 선택됨</span>
              </div>
              {csvRows.map((row, idx) => (
                <div
                  key={idx}
                  onClick={() =>
                    setCsvRows((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, selected: !r.selected } : r,
                      ),
                    )
                  }
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    row.selected
                      ? "bg-white border-green-200"
                      : "bg-surface-50 border-surface-200 opacity-50"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
                      row.selected
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-surface-300"
                    }`}
                  >
                    {row.selected && "✓"}
                  </span>
                  <span className="text-gray-400 text-xs w-20 flex-shrink-0">
                    {row.date}
                  </span>
                  <span className="text-gray-400 text-xs w-20 flex-shrink-0">
                    {row.time_slot.split("-")[0]}
                  </span>
                  <span className="flex-1 font-medium text-gray-800 truncate">
                    {row.menu_name}
                  </span>
                  <span className="text-xs text-gray-400 w-8">
                    {row.quantity > 1 ? `×${row.quantity}` : ""}
                  </span>
                  <span className="text-gray-700 font-medium w-20 text-right flex-shrink-0">
                    {row.amount.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>

            {/* 합계 + 저장 */}
            <div className="flex items-center justify-between pt-2 border-t border-green-200">
              <p className="text-xs text-gray-600">
                선택 합계:{" "}
                <span className="font-bold text-gray-900">
                  {csvRows
                    .filter((r) => r.selected)
                    .reduce((s, r) => s + r.amount, 0)
                    .toLocaleString()}
                  원
                </span>
              </p>
              <button
                onClick={handleCsvSave}
                disabled={csvSaving || csvRows.every((r) => !r.selected)}
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {csvSaving
                  ? "저장 중…"
                  : `${csvRows.filter((r) => r.selected).length}개 저장`}
              </button>
            </div>
          </div>
        )}

        {/* OCR 결과 */}
        {ocrResult && (
          <div className="border border-brand-200 rounded-xl bg-brand-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-brand-700">
                영수증 분석 결과
                {ocrResult.date && (
                  <span className="ml-2 font-normal text-brand-500">
                    {ocrResult.date}
                  </span>
                )}
              </p>
              <button
                onClick={() => setOcrResult(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ 취소
              </button>
            </div>
            <div className="space-y-1.5">
              {ocrResult.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-surface-200 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {item.is_matched ? (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                        매칭
                      </span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                        미매칭
                      </span>
                    )}
                    <span className="text-gray-800 font-medium">
                      {item.matched_name ?? item.name}
                    </span>
                    {item.matched_name && item.matched_name !== item.name && (
                      <span className="text-xs text-gray-400">
                        ← {item.name}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-600">
                    {item.quantity > 1 && (
                      <span className="text-gray-400 mr-1">
                        {item.quantity}개 ×
                      </span>
                    )}
                    {item.amount.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-brand-200">
              <p className="text-xs text-gray-500">
                합계:{" "}
                <span className="font-bold text-gray-800">
                  {(
                    ocrResult.total ??
                    ocrResult.items.reduce((s, i) => s + i.amount, 0)
                  ).toLocaleString()}
                  원
                </span>
                {ocrResult.items.some((i) => !i.is_matched) && (
                  <span className="ml-2 text-yellow-600">
                    · 미매칭 항목은 메뉴 관리에서 등록하세요
                  </span>
                )}
              </p>
              <button
                onClick={handleOcrSave}
                disabled={savingOcr}
                className="px-4 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 disabled:opacity-50"
              >
                {savingOcr ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        )}

        {/* 날짜·시간대 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              시간대
            </label>
            <div className="flex gap-1.5">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => setTimeSlot(slot.value)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-medium border transition-colors
                    ${timeSlot === slot.value ? "bg-brand-50 border-brand-500/40 text-brand-600" : "border-surface-300 text-gray-500 hover:border-brand-300"}`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 메뉴 선택 */}
        {menus.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-surface-300 rounded-xl">
            <p className="text-sm text-gray-400">등록된 메뉴가 없습니다</p>
            <a
              href="/dashboard/menus"
              className="text-xs text-brand-500 hover:underline mt-1 block"
            >
              메뉴 관리에서 메뉴를 추가하세요 →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500">
              메뉴 선택
            </label>
            {Object.entries(menuGroups).map(([cat, items]) => {
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <p className="text-xs text-gray-400 mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMenu(m)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                          ${selectedMenu?.id === m.id ? "bg-brand-50 border-brand-500 text-brand-700 font-medium" : "border-surface-300 text-gray-600 hover:border-brand-300 bg-white"}`}
                      >
                        {m.name}
                        {m.price && (
                          <span className="ml-1 text-xs text-gray-400">
                            {m.price.toLocaleString()}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {selectedMenu && (
              <div className="flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-brand-700 flex-1">
                  {selectedMenu.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-7 h-7 rounded-full border border-brand-300 text-brand-600 font-bold hover:bg-brand-100 text-sm"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-gray-800">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(qty + 1)}
                    className="w-7 h-7 rounded-full border border-brand-300 text-brand-600 font-bold hover:bg-brand-100 text-sm"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addToCart}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-bold hover:bg-brand-600"
                >
                  추가
                </button>
              </div>
            )}
          </div>
        )}

        {/* 장바구니 */}
        {cart.length > 0 && (
          <div className="border border-surface-300 rounded-xl divide-y divide-surface-200">
            {cart.map((c) => (
              <div
                key={c.menu.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">
                    {c.menu.name}
                  </span>
                  <span className="text-xs text-gray-400">{c.quantity}개</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">
                    {((c.menu.price ?? 0) * c.quantity).toLocaleString()}원
                  </span>
                  <button
                    onClick={() => removeFromCart(c.menu.id)}
                    className="text-gray-400 hover:text-red-500 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-50">
              <span className="text-sm font-bold text-gray-700">합계</span>
              <span className="text-base font-black text-brand-600">
                {cartTotal.toLocaleString()}원
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={loading || cart.length === 0}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all
            ${success ? "bg-green-500 text-white" : "bg-brand-500 hover:bg-brand-600 text-white glow-blue disabled:opacity-50 disabled:cursor-not-allowed"}`}
        >
          {success
            ? "✓ 저장 완료"
            : loading
              ? "저장 중..."
              : `매출 저장 (${cart.length}개 항목)`}
        </button>
      </div>

      {/* 입력 내역 */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">입력 내역</h2>
        {fetching ? (
          <p className="text-sm text-gray-400 text-center py-8">
            불러오는 중...
          </p>
        ) : entries.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-3 text-gray-300">☕</p>
            <p className="text-sm text-gray-400">아직 입력된 매출이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receiptGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.receipt_id);
              return (
                <div
                  key={group.receipt_id}
                  className="border border-surface-200 rounded-xl overflow-hidden"
                >
                  {/* 요약 행 */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors"
                    onClick={() => toggleGroup(group.receipt_id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">
                        {group.source === "ocr"
                          ? "🧾"
                          : (() => {
                              const cats = Array.from(
                                new Set(group.items.map((i) => i.category)),
                              );
                              if (cats.length === 1) {
                                return cats[0] === "음료"
                                  ? "☕"
                                  : cats[0] === "디저트"
                                    ? "🍰"
                                    : "📦";
                              }
                              return "🛒";
                            })()}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {group.date}
                          <span className="ml-2 text-xs text-gray-400">
                            {group.time_slot}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">
                            · {group.source === "ocr" ? "영수증" : "직접입력"}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">
                            · {group.items.length}개 메뉴
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900 mr-10">
                        {group.total.toLocaleString()}원
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1"
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
                      <span className="text-gray-400 text-xs">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* 상세 내역 */}
                  {isExpanded && (
                    <div className="divide-y divide-surface-100 border-t border-surface-200">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-5 py-2.5 bg-white"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">
                              {item.category === "음료"
                                ? "☕"
                                : item.category === "디저트"
                                  ? "🍰"
                                  : "📦"}
                            </span>
                            <span className="text-sm text-gray-700">
                              {item.menu_name}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-xs text-gray-400">
                                × {item.quantity}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-700">
                            {item.amount.toLocaleString()}원
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
