"use client";

import { useState } from "react";

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── 타입 정의 ──────────────────────────────────────────────────────────────
type MenuIngredient = {
  menu_name: string;
  ingredients: string[];
  complexity_score: number;
  complexity_label: string;
  complexity_reason: string;
  is_removal_candidate: boolean;
  removal_reason: string | null;
};

type IngredientOverlap = {
  ingredient: string;
  menus: string[];
  count: number;
  storage_type: string;
  storage_tip: string;
  overlap_insight: string;
};

type ComplexitySummary = {
  level: string;
  warning: boolean;
  total_menus: number;
  total_unique_ingredients: number;
  avg_ingredients_per_menu: number;
  main_issues: string[];
  removal_candidates: string[];
  removal_benefit: string;
};

type SimplificationGroup = {
  group_name: string;
  menus: string[];
  shared_ingredients: string[];
  each_unique: Record<string, string[]>;
  consolidation_tip: string;
  expected_benefit: string;
};

type DerivedSuggestion = {
  name: string;
  base_ingredients: string[];
  new_ingredient: string | null;
  operational_benefit: string;
  target_customer: string;
  reason: string;
};

type AnalysisResult = {
  overall_insight: string;
  menu_ingredients: MenuIngredient[];
  ingredient_overlap: IngredientOverlap[];
  complexity_summary: ComplexitySummary;
  simplification_groups: SimplificationGroup[];
  derived_suggestions: DerivedSuggestion[];
};

type Props = {
  getHeaders: () => Promise<Record<string, string>>;
};

// ── 복잡도 점수 색상 ───────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score <= 2)
    return {
      bar: "bg-green-400",
      text: "text-green-700",
      bg: "bg-green-50 border-green-200",
    };
  if (score === 3)
    return {
      bar: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    };
  return {
    bar: "bg-red-400",
    text: "text-red-700",
    bg: "bg-red-50 border-red-200",
  };
}

function storageColor(type: string) {
  if (type === "냉동") return "bg-blue-100 text-blue-700";
  if (type === "냉장") return "bg-cyan-100 text-cyan-700";
  return "bg-orange-100 text-orange-700";
}

// ── 섹션 컨테이너 ──────────────────────────────────────────────────────────
function Section({
  title,
  badge,
  badgeColor = "bg-surface-100 border-surface-300 text-gray-500",
  open,
  onToggle,
  children,
}: {
  title: string;
  badge: string;
  badgeColor?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <span
            className={`text-xs border px-2 py-0.5 rounded-full ${badgeColor}`}
          >
            {badge}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function MenuAnalysisPanel({ getHeaders }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("complexity");

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiUrl()}/menu-analysis/analyze`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "분석에 실패했습니다.");
      }
      setResult(await res.json());
      setOpenSection("complexity");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
    }
    setLoading(false);
  };

  const toggle = (key: string) =>
    setOpenSection((prev) => (prev === key ? null : key));

  return (
    <div className="space-y-6">
      {/* 분석 시작 */}
      <div className="glass-card rounded-xl p-6 text-center space-y-3">
        <p className="text-sm text-gray-500">
          등록된 메뉴를 AI가 심층 분석합니다 — 재료 중복·복잡도·재고 단순화
          3가지 핵심 분석
        </p>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              AI 분석 중...
            </span>
          ) : (
            "메뉴 분석 시작"
          )}
        </button>
        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {result && (
        <>
          {/* ── 종합 인사이트 ── */}
          <div className="glass-card rounded-xl p-5 border-brand-500/20 bg-brand-50/30">
            <p className="text-xs font-bold text-brand-600 mb-2">
              AI 종합 평가
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {result.overall_insight}
            </p>
          </div>

          {/* ── 1. 메뉴 복잡도 경고 ── */}
          <Section
            title="메뉴 복잡도 분석"
            badge={result.complexity_summary.level}
            badgeColor={
              result.complexity_summary.warning
                ? "bg-red-100 border-red-300 text-red-600"
                : "bg-green-100 border-green-300 text-green-600"
            }
            open={openSection === "complexity"}
            onToggle={() => toggle("complexity")}
          >
            {/* 요약 수치 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                {
                  label: "총 메뉴 수",
                  value: `${result.complexity_summary.total_menus}개`,
                },
                {
                  label: "총 재료 종류",
                  value: `${result.complexity_summary.total_unique_ingredients}종`,
                },
                {
                  label: "메뉴당 평균 재료",
                  value: `${result.complexity_summary.avg_ingredients_per_menu}가지`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-surface-50 border border-surface-200 rounded-lg p-3 text-center"
                >
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-lg font-bold text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            {/* 주요 문제점 */}
            {result.complexity_summary.main_issues.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <p className="text-xs font-bold text-amber-700 mb-2">
                  주요 문제점
                </p>
                {result.complexity_summary.main_issues.map((issue, i) => (
                  <p key={i} className="text-sm text-amber-800 flex gap-2">
                    <span className="shrink-0">·</span>
                    {issue}
                  </p>
                ))}
              </div>
            )}

            {/* 제거 권장 */}
            {result.complexity_summary.removal_candidates.length > 0 && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-bold text-red-700 mb-2">
                  제거 권장 메뉴
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {result.complexity_summary.removal_candidates.map((m) => (
                    <span
                      key={m}
                      className="text-xs bg-white border border-red-300 text-red-600 px-2.5 py-1 rounded-lg font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-red-600">
                  {result.complexity_summary.removal_benefit}
                </p>
              </div>
            )}

            {/* 메뉴별 복잡도 */}
            <p className="text-xs font-bold text-gray-500 mb-3">
              메뉴별 복잡도
            </p>
            <div className="space-y-2">
              {[...result.menu_ingredients]
                .sort((a, b) => b.complexity_score - a.complexity_score)
                .map((item) => {
                  const c = scoreColor(item.complexity_score);
                  return (
                    <div
                      key={item.menu_name}
                      className={`p-3 rounded-lg border ${item.is_removal_candidate ? "border-red-200 bg-red-50" : "border-surface-200 bg-surface-50"}`}
                    >
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
                          {item.menu_name}
                        </span>
                        {item.is_removal_candidate && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full shrink-0">
                            제거 권장
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold shrink-0 ${c.text}`}
                        >
                          {item.complexity_label} ({item.complexity_score}/5)
                        </span>
                      </div>
                      {/* 복잡도 바 */}
                      <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className={`h-1.5 flex-1 rounded-full ${n <= item.complexity_score ? c.bar : "bg-surface-200"}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        {item.complexity_reason}
                      </p>
                      {item.is_removal_candidate && item.removal_reason && (
                        <p className="text-xs text-red-500 mt-1">
                          → {item.removal_reason}
                        </p>
                      )}
                      {/* 재료 태그 */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.ingredients.map((ing) => (
                          <span
                            key={ing}
                            className="text-xs bg-white border border-surface-300 text-gray-500 px-1.5 py-0.5 rounded"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </Section>

          {/* ── 2. 재료 중복 분석 ── */}
          <Section
            title="재료 중복 분석"
            badge={`${result.ingredient_overlap.length}개 공유 재료`}
            open={openSection === "overlap"}
            onToggle={() => toggle("overlap")}
          >
            {result.ingredient_overlap.length === 0 ? (
              <p className="text-sm text-gray-400">공유 재료가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {result.ingredient_overlap.map((item) => (
                  <div
                    key={item.ingredient}
                    className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">
                        {item.ingredient}
                      </span>
                      <span className="text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full font-medium">
                        {item.count}개 메뉴 공유
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${storageColor(item.storage_type)}`}
                      >
                        {item.storage_type}
                      </span>
                    </div>
                    {/* 공유 메뉴 */}
                    <div className="flex flex-wrap gap-1.5">
                      {item.menus.map((m) => (
                        <span
                          key={m}
                          className="text-xs bg-white border border-surface-300 text-gray-600 px-2 py-0.5 rounded-md"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                    {/* 인사이트 */}
                    <p className="text-xs text-gray-600 bg-white border border-surface-200 rounded px-3 py-2">
                      💡 {item.overlap_insight}
                    </p>
                    {/* 보관 팁 */}
                    <p className="text-xs text-gray-400">
                      📦 {item.storage_tip}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── 3. 재고 단순화 제안 ── */}
          <Section
            title="재고 단순화 제안"
            badge={`${result.simplification_groups.length}개 그룹`}
            open={openSection === "simplify"}
            onToggle={() => toggle("simplify")}
          >
            {result.simplification_groups.length === 0 ? (
              <p className="text-sm text-gray-400">단순화 제안이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {result.simplification_groups.map((group) => (
                  <div
                    key={group.group_name}
                    className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">
                        {group.group_name}
                      </span>
                      <span className="text-xs bg-surface-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {group.menus.length}개 메뉴
                      </span>
                    </div>

                    {/* 공유 재료 */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">공유 재료</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.shared_ingredients.map((ing) => (
                          <span
                            key={ing}
                            className="text-xs bg-brand-50 border border-brand-200 text-brand-700 px-2 py-0.5 rounded-md font-medium"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 메뉴별 고유 재료 */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">
                        메뉴별 고유 재료
                      </p>
                      <div className="space-y-1.5">
                        {group.menus.map((menu) => (
                          <div key={menu} className="flex items-start gap-2">
                            <span className="text-xs font-medium text-gray-700 w-28 shrink-0 pt-0.5">
                              {menu}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {(group.each_unique?.[menu] ?? []).map((ing) => (
                                <span
                                  key={ing}
                                  className="text-xs bg-white border border-surface-300 text-gray-500 px-1.5 py-0.5 rounded"
                                >
                                  {ing}
                                </span>
                              ))}
                              {(!group.each_unique?.[menu] ||
                                group.each_unique[menu].length === 0) && (
                                <span className="text-xs text-gray-300">
                                  고유 재료 없음
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 통합 팁 + 기대 효과 */}
                    <div className="bg-white border border-surface-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-bold text-gray-600">
                        통합 전략
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {group.consolidation_tip}
                      </p>
                      <div className="pt-1 border-t border-surface-100">
                        <p className="text-xs text-brand-600 font-medium">
                          ✓ {group.expected_benefit}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── 4. 파생 메뉴 추천 ── */}
          <Section
            title="파생 메뉴 추천"
            badge={`${result.derived_suggestions.length}개 제안`}
            open={openSection === "derived"}
            onToggle={() => toggle("derived")}
          >
            {result.derived_suggestions.length === 0 ? (
              <p className="text-sm text-gray-400">
                파생 메뉴 제안이 없습니다.
              </p>
            ) : (
              <div className="space-y-4">
                {result.derived_suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-gray-900">
                        {item.name}
                      </span>
                      {item.new_ingredient ? (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          + {item.new_ingredient} 추가 필요
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                          추가 재료 불필요
                        </span>
                      )}
                    </div>

                    {/* 기존 재료 활용 */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">
                        활용 재료 (현재 보유)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.base_ingredients.map((ing) => (
                          <span
                            key={ing}
                            className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-md"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-surface-200 rounded-lg p-3 space-y-2">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 mb-0.5">
                            운영 이점
                          </p>
                          <p className="text-xs text-gray-700">
                            {item.operational_benefit}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 mb-0.5">
                            타겟 고객
                          </p>
                          <p className="text-xs text-gray-700">
                            {item.target_customer}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-surface-100">
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {item.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
