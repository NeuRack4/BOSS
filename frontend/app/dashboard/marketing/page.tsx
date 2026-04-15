"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type ContentType = "instagram" | "blog" | "event" | "menu_highlight";

const CONTENT_TYPES: {
  value: ContentType;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    value: "instagram",
    label: "인스타그램",
    icon: "📸",
    desc: "캡션 + 해시태그 30개",
  },
  { value: "blog", label: "블로그", icon: "✍️", desc: "네이버 블로그 포스팅" },
  { value: "event", label: "이벤트", icon: "🎉", desc: "프로모션·할인 문구" },
  {
    value: "menu_highlight",
    label: "메뉴 소개",
    icon: "☕",
    desc: "메뉴 상세 소개 게시글",
  },
];

const today = new Date();

type Menu = { id: string; name: string; category: string; is_active?: boolean };

export default function MarketingPage() {
  const [contentType, setContentType] = useState<ContentType>("instagram");
  const [targetMenu, setTargetMenu] = useState("");
  const [promotion, setPromotion] = useState("");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    content: string;
    menu_used: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      fetch(`${apiUrl}/menus/`, { headers: { "X-User-Id": user.id } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: Menu[]) =>
          setMenus(data.filter((m) => m.is_active !== false)),
        )
        .catch(() => {});
    });
  }, [apiUrl]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/marketing/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": user.id },
        body: JSON.stringify({
          content_type: contentType,
          target_menu: targetMenu || null,
          promotion: promotion || null,
          year,
          month,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult({ content: data.content, menu_used: data.menu_used });
    } catch {
      setError("콘텐츠 생성에 실패했습니다. 다시 시도해주세요.");
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setResult(null);
    handleGenerate();
  };

  const selected = CONTENT_TYPES.find((c) => c.value === contentType)!;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">마케팅 콘텐츠</h1>
        <p className="text-sm text-gray-500 mt-1">
          매출·메뉴·상권 데이터를 기반으로 AI가 SNS 콘텐츠 초안을 작성합니다
        </p>
      </div>

      {/* 콘텐츠 타입 선택 */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <h2 className="text-base font-bold text-gray-900">콘텐츠 종류</h2>
        <div className="grid grid-cols-2 gap-3">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.value}
              onClick={() => {
                setContentType(ct.value);
                setResult(null);
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all
                ${
                  contentType === ct.value
                    ? "bg-brand-50 border-brand-500/40 glow-blue"
                    : "border-surface-300 hover:border-brand-300 bg-white"
                }`}
            >
              <span className="text-2xl flex-shrink-0">{ct.icon}</span>
              <div>
                <p
                  className={`text-sm font-bold ${contentType === ct.value ? "text-brand-600" : "text-gray-800"}`}
                >
                  {ct.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{ct.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* 옵션 입력 */}
        <div className="space-y-3 pt-2 border-t border-surface-200">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              강조할 메뉴{" "}
              <span className="text-gray-400 font-normal">
                (선택 — 비우면 이번달 인기 메뉴 자동 사용)
              </span>
            </label>
            {menus.length > 0 ? (
              <select
                value={targetMenu}
                onChange={(e) => setTargetMenu(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
              >
                <option value="">이번달 인기 메뉴 자동 선택</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={targetMenu}
                onChange={(e) => setTargetMenu(e.target.value)}
                placeholder="예: 아이스 아메리카노, 딸기 라떼"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              특별 내용{" "}
              <span className="text-gray-400 font-normal">
                (선택 — 할인·이벤트·신메뉴 등)
              </span>
            </label>
            <input
              type="text"
              value={promotion}
              onChange={(e) => setPromotion(e.target.value)}
              placeholder="예: 5월 어린이날 기념 20% 할인, 신메뉴 출시"
              className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-600 text-white glow-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? `${selected.icon} Claude가 ${selected.label} 콘텐츠를 작성하고 있습니다...`
            : `${selected.icon} ${selected.label} 콘텐츠 생성`}
        </button>
      </div>

      {/* 생성 결과 */}
      {result && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selected.icon}</span>
              <h2 className="text-base font-bold text-gray-900">
                {selected.label} 초안
              </h2>
              {result.menu_used && (
                <span className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2 py-0.5 rounded-full">
                  {result.menu_used} 기반
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {year}년 {month}월 기준
            </span>
          </div>

          {/* 콘텐츠 본문 */}
          <div className="bg-surface-50 border border-surface-200 rounded-xl p-5">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
              {result.content}
            </pre>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all
                ${
                  copied
                    ? "bg-green-500 text-white border-green-500"
                    : "border-brand-500/40 text-brand-600 bg-brand-50 hover:bg-brand-100"
                }`}
            >
              {copied ? "✓ 복사 완료" : "복사하기"}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-surface-300 text-gray-600 bg-white hover:bg-surface-100 transition-all disabled:opacity-50"
            >
              {loading ? "생성 중..." : "다시 생성"}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            AI가 생성한 초안입니다. 게시 전 내용을 검토하고 수정하세요.
          </p>
        </div>
      )}

      {/* 사용 가이드 */}
      {!result && !loading && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700">사용 가이드</h3>
          <ul className="space-y-2">
            {[
              "강조할 메뉴를 비워두면 이번달 가장 많이 팔린 카테고리를 자동으로 반영합니다",
              "계절·공휴일·상권 특성이 자동으로 콘텐츠에 반영됩니다",
              "생성된 초안은 자유롭게 수정해 사용하세요",
              "마음에 들지 않으면 '다시 생성'으로 새로운 버전을 받아보세요",
            ].map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-gray-500"
              >
                <span className="text-brand-400 flex-shrink-0 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
