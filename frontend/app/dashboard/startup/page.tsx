"use client";

import { useState } from "react";

type AreaResult = {
  area_id: string;
  area_name: string;
  avg_deposit: number;
  avg_interior: number;
  avg_equipment: number;
  avg_total: number;
  min_total: number;
  survival_rate: number;
  monthly_revenue: number;
  foot_traffic: number;
  rent_monthly: number;
  affordable: boolean;
  score: number;
};

type RecommendResult = {
  capital: number;
  is_youth: boolean;
  results: AreaResult[];
  message?: string;
};

type SubsidyResult = {
  query: string;
  results: { title: string; content: string; score: number }[];
};

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function fmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function StartupPage() {
  const [capital, setCapital] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [subsidies, setSubsidies] = useState<SubsidyResult | null>(null);
  const [subsidyLoading, setSubsidyLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!capital) return;
    setLoading(true);
    setResult(null);
    setSubsidies(null);

    const params = new URLSearchParams({ capital });
    if (age) params.append("age", age);

    const res = await fetch(`${apiUrl()}/recommend/areas?${params}`);
    if (res.ok) setResult(await res.json());
    setLoading(false);

    // 지원사업 매칭 병렬 실행
    setSubsidyLoading(true);
    const sRes = await fetch(`${apiUrl()}/recommend/subsidies?${params}`);
    if (sRes.ok) setSubsidies(await sRes.json());
    setSubsidyLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">
          창업 준비 시뮬레이터
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          보유 자본을 입력하면 마포구에서 진입 가능한 상권을 추천해드립니다
        </p>
      </div>

      {/* 입력 폼 */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <h2 className="text-base font-bold text-gray-900">내 상황 입력</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              보유 자본 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="예: 8000"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-surface-300 bg-white text-sm focus:outline-none focus:border-brand-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                만원
              </span>
            </div>
            {capital && (
              <p className="text-xs text-brand-500 mt-1">
                {fmt(Number(capital))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              나이 (선택)
            </label>
            <div className="relative">
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="예: 32"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-surface-300 bg-white text-sm focus:outline-none focus:border-brand-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                세
              </span>
            </div>
            {age && Number(age) <= 39 && (
              <p className="text-xs text-green-500 mt-1">
                청년창업 지원사업 대상
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !capital}
          className="w-full py-3 rounded-xl font-bold text-sm bg-brand-500 hover:bg-brand-600 text-white glow-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "분석 중…" : "상권 추천 받기"}
        </button>
      </div>

      {/* 추천 결과 */}
      {result && (
        <>
          {result.message ? (
            <div className="glass-card rounded-xl p-6 text-center">
              <p className="text-2xl mb-3">😢</p>
              <p className="text-sm text-gray-600">{result.message}</p>
              <p className="text-xs text-gray-400 mt-2">
                마포구 최소 창업비용은 약 3,800만원(아현·신수동 기준)입니다
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  추천 상권 TOP {Math.min(result.results.length, 3)}
                </h2>
                <span className="text-xs text-gray-400">
                  보유 자본 {fmt(result.capital)} 기준 ·{" "}
                  {result.is_youth ? "청년창업" : "일반창업"}
                </span>
              </div>

              {result.results.slice(0, 3).map((area, i) => (
                <div
                  key={area.area_id}
                  className={`glass-card rounded-xl p-5 space-y-4 ${i === 0 ? "border border-brand-300 glow-blue" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{MEDALS[i]}</span>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          {area.area_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              area.affordable
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {area.affordable
                              ? "✓ 평균 창업비용 내"
                              : "⚠ 최소비용 가능"}
                          </span>
                          <span className="text-xs text-gray-400">
                            생존율 {area.survival_rate}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">종합 점수</p>
                      <p className="text-lg font-black text-brand-600">
                        {(area.score * 100).toFixed(0)}점
                      </p>
                    </div>
                  </div>

                  {/* 통계 그리드 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">
                        상권 매출 규모
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {fmt(area.monthly_revenue)}원
                      </p>
                    </div>
                    <div className="bg-surface-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">유동인구</p>
                      <p className="text-sm font-bold text-gray-900">
                        {area.foot_traffic.toLocaleString()}명
                      </p>
                    </div>
                    <div className="bg-surface-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">월세 추정</p>
                      <p className="text-sm font-bold text-gray-900">
                        {area.rent_monthly}만원
                      </p>
                    </div>
                  </div>

                  {/* 창업 비용 */}
                  <div className="border-t border-surface-200 pt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      예상 창업 비용
                    </p>
                    <div className="flex gap-4 text-xs">
                      <span className="text-gray-600">
                        보증금{" "}
                        <span className="font-bold text-gray-900">
                          {fmt(area.avg_deposit)}
                        </span>
                      </span>
                      <span className="text-gray-400">+</span>
                      <span className="text-gray-600">
                        인테리어{" "}
                        <span className="font-bold text-gray-900">
                          {fmt(area.avg_interior)}
                        </span>
                      </span>
                      <span className="text-gray-400">+</span>
                      <span className="text-gray-600">
                        기기{" "}
                        <span className="font-bold text-gray-900">
                          {fmt(area.avg_equipment)}
                        </span>
                      </span>
                      <span className="text-gray-400">=</span>
                      <span className="text-brand-600 font-bold">
                        총 {fmt(area.avg_total)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>최소 {fmt(area.min_total)}</span>
                        <span>평균 {fmt(area.avg_total)}</span>
                        <span>보유 자본 {fmt(result.capital)}</span>
                      </div>
                      <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${area.affordable ? "bg-brand-500" : "bg-yellow-400"}`}
                          style={{
                            width: `${Math.min(100, (result.capital / area.avg_total) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* 나머지 상권 요약 */}
              {result.results.length > 3 && (
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-3">
                    기타 진입 가능 상권
                  </p>
                  <div className="space-y-2">
                    {result.results.slice(3).map((area) => (
                      <div
                        key={area.area_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700">{area.area_name}</span>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>총 {fmt(area.avg_total)}</span>
                          <span>생존율 {area.survival_rate}%</span>
                          <span className="font-bold text-gray-700">
                            {(area.score * 100).toFixed(0)}점
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 지원사업 매칭 */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">
              활용 가능한 정부 지원사업
              {result.is_youth && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  청년창업 포함
                </span>
              )}
            </h2>
            {subsidyLoading ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                지원사업 매칭 중…
              </p>
            ) : subsidies?.results.length ? (
              <div className="space-y-3">
                {subsidies.results.slice(0, 4).map((s, i) => (
                  <div
                    key={i}
                    className="border border-surface-200 rounded-lg p-4"
                  >
                    <p className="text-sm font-bold text-gray-900 mb-1">
                      {s.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {s.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                매칭된 지원사업이 없습니다.
              </p>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            * 창업비용·생존율은 소상공인시장진흥공단 시장조사 기반 추정치이며
            실제와 다를 수 있습니다. 실제 창업 전 전문가 상담을 권장합니다.
          </p>
        </>
      )}
    </div>
  );
}
