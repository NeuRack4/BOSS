"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import InstagramPreview from "./InstagramPreview";
import BlogPreview from "./BlogPreview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ContentType = "instagram" | "blog" | "naver_place" | "menu_highlight";
type NaverPlaceType = "review_reply" | "notice";
type Tab = "strategy" | "content";

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
  {
    value: "naver_place",
    label: "네이버 플레이스",
    icon: "🗺️",
    desc: "리뷰 답글 · 공지사항",
  },
  {
    value: "menu_highlight",
    label: "메뉴 소개",
    icon: "☕",
    desc: "메뉴 상세 소개 게시글",
  },
];

const NOTICE_TYPES = [
  "임시 휴무",
  "영업시간 변경",
  "이벤트·할인",
  "신메뉴 출시",
  "기타 공지",
];

const URGENCY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};
const URGENCY_LABEL: Record<string, string> = {
  high: "이번 주",
  medium: "이번 달",
  low: "장기",
};

const today = new Date();

type Menu = { id: string; name: string; category: string; is_active?: boolean };

type Strategy = {
  title: string;
  reason: string;
  action: string;
  content_type: ContentType;
  target_menu: string | null;
  urgency: "high" | "medium" | "low";
  timing: string;
};

type StrategyResult = {
  overall_tip: string;
  strategies: Strategy[];
};

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("strategy");
  const [contentType, setContentType] = useState<ContentType>("instagram");
  const [targetMenu, setTargetMenu] = useState("");
  const [promotion, setPromotion] = useState("");
  // 네이버 플레이스 전용
  const [naverPlaceType, setNaverPlaceType] =
    useState<NaverPlaceType>("review_reply");
  const [starRating, setStarRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [noticeType, setNoticeType] = useState(NOTICE_TYPES[0]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [cafeName, setCafeName] = useState("");
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);

  // 이미지 생성
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // 전략 추천
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(
    null,
  );
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  // 콘텐츠 생성
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    content: string;
    menu_used: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 네이버 블로그 업로드
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ post_url: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      // 카페 이름 조회
      fetch(`${apiUrl}/founders/${user.id}/business-info`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.business_name) setCafeName(d.business_name);
        })
        .catch(() => {});
    });
  }, [apiUrl]);

  // ── 전략 추천 ────────────────────────────────────────────────────────────
  const handleStrategy = async () => {
    setStrategyLoading(true);
    setStrategyError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStrategyError("로그인이 필요합니다.");
      setStrategyLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/marketing/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": user.id },
      });
      if (!res.ok) throw new Error();
      setStrategyResult(await res.json());
    } catch {
      setStrategyError("전략 분석에 실패했습니다. 다시 시도해주세요.");
    }
    setStrategyLoading(false);
  };

  // 전략 카드 클릭 → 콘텐츠 생성 탭으로 이동 + 자동 생성
  const handleStrategyClick = async (strategy: Strategy) => {
    setActiveTab("content");
    setContentType(strategy.content_type);
    setTargetMenu(strategy.target_menu ?? "");
    setResult(null);
    // 탭 전환 후 자동 생성
    setTimeout(
      () => generateContent(strategy.content_type, strategy.target_menu ?? ""),
      100,
    );
  };

  // ── 콘텐츠 생성 ──────────────────────────────────────────────────────────
  const generateContent = async (
    ct: ContentType = contentType,
    menu: string = targetMenu,
  ) => {
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
          content_type: ct,
          target_menu: menu || null,
          promotion: promotion || null,
          year,
          month,
          ...(ct === "naver_place" && {
            naver_place_type: naverPlaceType,
            star_rating:
              naverPlaceType === "review_reply" ? starRating : undefined,
            review_content:
              naverPlaceType === "review_reply" ? reviewContent || null : null,
            notice_type: naverPlaceType === "notice" ? noticeType : undefined,
          }),
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

  const handleGenerate = () => {
    setImageUrl(null);
    setImageError(null);
    generateContent();
  };

  const handleGenerateImage = async () => {
    setImageLoading(true);
    setImageError(null);
    setImageUrl(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setImageError("로그인이 필요합니다.");
      setImageLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/marketing/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": user.id },
        body: JSON.stringify({
          target_menu: targetMenu || null,
          promotion: promotion || null,
          content_type: contentType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "이미지 생성에 실패했습니다.");
      }
      const data = await res.json();
      setImageUrl(data.image_url);
    } catch (e) {
      setImageError(
        e instanceof Error ? e.message : "이미지 생성에 실패했습니다.",
      );
    }
    setImageLoading(false);
  };

  const handleNaverUpload = async () => {
    if (!result) return;
    setUploadLoading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const res = await fetch(`${apiUrl}/marketing/blog/upload-naver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: result.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "업로드에 실패했습니다.");
      setUploadResult(data);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    }
    setUploadLoading(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selected = CONTENT_TYPES.find((c) => c.value === contentType)!;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">마케팅</h1>
        <p className="text-sm text-gray-500 mt-1">
          매출·메뉴·상권 데이터를 기반으로 AI가 마케팅 전략을 추천하고 콘텐츠
          초안을 작성합니다
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-surface-100 p-1 rounded-xl border border-surface-300 w-fit">
        {(["strategy", "content"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-white text-brand-600 shadow-sm border border-surface-300"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "strategy" ? "전략 추천" : "콘텐츠 생성"}
          </button>
        ))}
      </div>

      {/* ── 전략 추천 탭 ── */}
      {activeTab === "strategy" && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 text-center space-y-3">
            <p className="text-sm text-gray-500">
              내 매출·메뉴·공휴일 데이터를 분석해 지금 실행해야 할 마케팅 전략을
              추천합니다
            </p>
            <button
              onClick={handleStrategy}
              disabled={strategyLoading}
              className="px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {strategyLoading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  AI 분석 중...
                </span>
              ) : (
                "마케팅 전략 분석"
              )}
            </button>
            {strategyError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {strategyError}
              </p>
            )}
          </div>

          {strategyResult && (
            <>
              {/* 전체 방향 */}
              <div className="glass-card rounded-xl p-5 bg-brand-50/30 border-brand-500/20">
                <p className="text-xs font-bold text-brand-600 mb-2">
                  이번달 마케팅 방향
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {strategyResult.overall_tip}
                </p>
              </div>

              {/* 전략 카드들 */}
              <div className="space-y-4">
                {strategyResult.strategies.map((s, i) => (
                  <div key={i} className="glass-card rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">
                          {s.title}
                        </span>
                        <span
                          className={`text-xs border px-2 py-0.5 rounded-full font-medium ${URGENCY_STYLE[s.urgency]}`}
                        >
                          {URGENCY_LABEL[s.urgency]}
                        </span>
                        {s.target_menu && (
                          <span className="text-xs bg-surface-100 border border-surface-300 text-gray-600 px-2 py-0.5 rounded-full">
                            {s.target_menu}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {s.timing}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="bg-surface-50 border border-surface-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-gray-500 mb-1">
                          추천 이유
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {s.reason}
                        </p>
                      </div>
                      <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-brand-600 mb-1">
                          지금 해야 할 것
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {s.action}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStrategyClick(s)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white transition-all"
                    >
                      {
                        CONTENT_TYPES.find((c) => c.value === s.content_type)
                          ?.icon
                      }{" "}
                      {
                        CONTENT_TYPES.find((c) => c.value === s.content_type)
                          ?.label
                      }{" "}
                      콘텐츠 바로 생성
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {!strategyResult && !strategyLoading && (
            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-700">
                이런 것들을 추천해드립니다
              </h3>
              <ul className="space-y-2">
                {[
                  "이번달 공휴일·기념일에 맞는 이벤트 타이밍",
                  "매출이 부진한 메뉴를 SNS로 밀어야 할지 판단",
                  "계절에 맞는 신메뉴 파생 및 마케팅 방향",
                  "지금 당장 인스타·블로그에 올려야 할 콘텐츠",
                ].map((tip, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-gray-500"
                  >
                    <span className="text-brand-400 shrink-0 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── 콘텐츠 생성 탭 ── */}
      {activeTab === "content" && (
        <div className="space-y-6">
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
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
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

            <div className="space-y-3 pt-2 border-t border-surface-200">
              {contentType === "naver_place" ? (
                <>
                  {/* 서브타입 선택 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      종류
                    </label>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "review_reply", label: "💬 리뷰 답글" },
                          { value: "notice", label: "📢 공지사항" },
                        ] as { value: NaverPlaceType; label: string }[]
                      ).map((t) => (
                        <button
                          key={t.value}
                          onClick={() => {
                            setNaverPlaceType(t.value);
                            setResult(null);
                          }}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                            naverPlaceType === t.value
                              ? "bg-brand-50 border-brand-500/40 text-brand-600"
                              : "border-surface-300 text-gray-500 hover:border-brand-300"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {naverPlaceType === "review_reply" ? (
                    <>
                      {/* 별점 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          별점
                        </label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              onClick={() => setStarRating(s)}
                              className="text-2xl transition-transform hover:scale-110"
                            >
                              {s <= starRating ? "⭐" : "☆"}
                            </button>
                          ))}
                          <span className="ml-2 text-sm text-gray-500 self-center">
                            {starRating}점
                          </span>
                        </div>
                      </div>
                      {/* 리뷰 내용 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          고객 리뷰 내용{" "}
                          <span className="text-gray-400 font-normal">
                            (선택 — 비우면 별점만 반영)
                          </span>
                        </label>
                        <textarea
                          value={reviewContent}
                          onChange={(e) => setReviewContent(e.target.value)}
                          placeholder="네이버 플레이스에서 받은 리뷰를 붙여넣으세요"
                          rows={3}
                          className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 resize-none focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 공지 종류 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          공지 종류
                        </label>
                        <select
                          value={noticeType}
                          onChange={(e) => setNoticeType(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                        >
                          {NOTICE_TYPES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* 특별 내용 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          공지 내용{" "}
                          <span className="text-gray-400 font-normal">
                            (날짜·시간·혜택 등 구체적으로)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={promotion}
                          onChange={(e) => setPromotion(e.target.value)}
                          placeholder="예: 4/30(화) 종일 휴무, 5/5 어린이날 전 메뉴 20% 할인"
                          className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
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

              {contentType === "blog" ? (
                <BlogPreview
                  content={result.content}
                  cafeName={cafeName}
                  menuUsed={result.menu_used}
                  year={year}
                  month={month}
                />
              ) : (
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-5">
                  <div
                    className="prose prose-sm max-w-none text-gray-800 leading-relaxed
                    prose-p:my-1.5 prose-strong:text-gray-900 prose-headings:text-gray-900
                    prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1
                    prose-ul:my-1 prose-li:my-0.5 prose-ol:my-1"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {contentType !== "blog" && (
                  <button
                    onClick={handleCopy}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      copied
                        ? "bg-green-500 text-white border-green-500"
                        : "border-brand-500/40 text-brand-600 bg-brand-50 hover:bg-brand-100"
                    }`}
                  >
                    {copied ? "✓ 복사 완료" : "복사하기"}
                  </button>
                )}
                <button
                  onClick={() => { setResult(null); setUploadResult(null); setUploadError(null); generateContent(); }}
                  disabled={loading}
                  className={`${contentType === "blog" ? "flex-1" : "flex-1"} py-2.5 rounded-xl text-sm font-bold border border-surface-300 text-gray-600 bg-white hover:bg-surface-100 transition-all disabled:opacity-50`}
                >
                  {loading ? "생성 중..." : "다시 생성"}
                </button>
                {contentType === "blog" && (
                  <button
                    onClick={handleNaverUpload}
                    disabled={uploadLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#03C75A] hover:bg-[#02a84c] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadLoading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        업로드 중...
                      </span>
                    ) : (
                      "N 네이버 블로그 업로드"
                    )}
                  </button>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}

              {uploadResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-sm font-bold">✓ 네이버 블로그에 발행됐습니다</span>
                  </div>
                  <a
                    href={uploadResult.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
                  >
                    포스트 보기 →
                  </a>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                AI가 생성한 초안입니다. 게시 전 내용을 검토하고 수정하세요.
              </p>
            </div>
          )}

          {/* 이미지 생성 — 인스타그램·메뉴소개 콘텐츠 생성 후에만 표시 */}
          {result &&
            (contentType === "instagram" ||
              contentType === "menu_highlight") && (
              <div className="glass-card rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      인스타그램 이미지 생성
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      DALL-E 3가 메뉴·계절·카페 분위기를 반영한 사진을
                      생성합니다
                    </p>
                  </div>
                  <span className="text-xs bg-surface-100 border border-surface-300 text-gray-500 px-2 py-1 rounded-lg">
                    약 55원/장
                  </span>
                </div>

                {!imageUrl && (
                  <button
                    onClick={handleGenerateImage}
                    disabled={imageLoading}
                    className="w-full py-3 rounded-xl font-bold text-sm border-2 border-brand-500 text-brand-600 hover:bg-brand-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {imageLoading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                        DALL-E 3 이미지 생성 중... (10~20초)
                      </span>
                    ) : (
                      "📸 이미지 생성"
                    )}
                  </button>
                )}

                {imageError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {imageError}
                  </p>
                )}

                {imageUrl && result && (
                  <div className="space-y-4">
                    <InstagramPreview
                      imageUrl={imageUrl}
                      content={result.content}
                      cafeName={cafeName}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleGenerateImage}
                        disabled={imageLoading}
                        className="px-4 py-2 rounded-xl text-sm font-bold border border-surface-300 text-gray-600 bg-white hover:bg-surface-100 transition-all disabled:opacity-50"
                      >
                        {imageLoading ? "생성 중..." : "이미지 다시 생성"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 text-center">
                      이미지 URL은 1시간 후 만료됩니다. 게시물 이미지로 저장 후
                      사용하세요.
                    </p>
                  </div>
                )}
              </div>
            )}

          {!result && !loading && contentType === "naver_place" && (
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-700">
                이렇게 사용하세요
              </h3>

              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-blue-700">
                    💬 리뷰 답글
                  </p>
                  <ol className="space-y-1.5">
                    {[
                      "네이버 플레이스에서 받은 리뷰를 복사합니다",
                      "별점을 선택하고 리뷰 내용을 붙여넣습니다",
                      "생성 버튼을 누르면 별점에 맞는 톤으로 답글이 작성됩니다",
                      "생성된 답글을 복사해 네이버 플레이스에 그대로 붙여넣으세요",
                    ].map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-gray-600"
                      >
                        <span className="bg-blue-200 text-blue-700 rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[10px]">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="text-[11px] text-blue-500 mt-1">
                    ⭐⭐⭐⭐⭐ 감사 / ⭐⭐⭐ 개선의지 / ⭐⭐ 이하 정중한 사과로
                    톤이 자동 조절됩니다
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-700">
                    📢 공지사항
                  </p>
                  <ol className="space-y-1.5">
                    {[
                      "공지 종류를 선택합니다 (임시휴무 / 영업시간변경 / 이벤트 등)",
                      "날짜·시간·혜택 등 구체적인 내용을 입력합니다",
                      "생성된 공지를 네이버 플레이스 공지사항에 등록하세요",
                    ].map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-gray-600"
                      >
                        <span className="bg-amber-200 text-amber-700 rounded-full w-4 h-4 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[10px]">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}

          {!result && !loading && contentType !== "naver_place" && (
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
                    <span className="text-brand-400 flex-shrink-0 mt-0.5">
                      •
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
