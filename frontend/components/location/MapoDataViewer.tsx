"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SEOUL_DISTRICTS = [
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구",
];

const fmtRevenue = (v: number | null | undefined) => {
  if (!v) return "—";
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만원`;
  return `${v.toLocaleString()}원`;
};

const fmtPop = (v: number | null | undefined) => {
  if (!v) return "—";
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  return v.toLocaleString();
};

const fmtRate = (v: number | null | undefined) =>
  v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";

interface SbizRow {
  dong_name: string;
  monthly_revenue_avg: number | null;
  store_count: number | null;
  reference_month: string | null;
}

interface FeatureRow {
  dong_name: string;
  daily_floating_pop: number | null;
  pop_age_20: number | null;
  pop_age_30: number | null;
  pop_weekend: number | null;
  monthly_txn_count: number | null;
  zone_cluster: string | null;
  survival_rate: number | null;
  new_stores_1y: number | null;
  closed_stores_1y: number | null;
}

interface RentRow {
  gu_name: string;
  rent_per_sqm: number;
  quarter: string;
}

interface SeoulStatsData {
  rent: RentRow | null;
  rent_all: RentRow[];
  sbiz: SbizRow[];
  features: FeatureRow[];
  gu: string | null;
}

type Tab = "sbiz" | "flpop";

export default function SeoulDataViewer() {
  const [selectedGu, setSelectedGu] = useState<string>("");
  const [data, setData] = useState<SeoulStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("sbiz");

  const fetchData = useCallback((gu: string) => {
    setLoading(true);
    const params = gu ? `?gu=${encodeURIComponent(gu)}` : "";
    fetch(`${API_BASE}/location/seoul-stats${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData(selectedGu);
  }, [selectedGu, fetchData]);

  const quarterLabel = (() => {
    const q = data?.sbiz[0]?.reference_month ?? data?.rent?.quarter ?? "";
    return q ? `${q.slice(0, 4)}년 ${q.slice(4)}분기` : "";
  })();

  // 전체 보기일 때 reb_rent 테이블에서 해당 구 임대료 찾기
  const getRentForGu = (gu: string): RentRow | undefined =>
    data?.rent_all.find((r) => r.gu_name === gu);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <p className="text-brand-500 text-xs font-semibold tracking-widest uppercase mb-1">
            Seoul Commercial Data
          </p>
          <h2 className="text-gray-900 font-bold text-base">
            {selectedGu ? `${selectedGu} 상권 데이터` : "서울 전체 상권 데이터"}
          </h2>
        </div>
        {quarterLabel && (
          <span className="text-xs text-gray-400">{quarterLabel} 기준</span>
        )}
      </div>

      {/* 구 선택기 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGu("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            selectedGu === ""
              ? "bg-brand-500 border-brand-500 text-white"
              : "bg-white border-surface-300 text-gray-600 hover:border-brand-400"
          }`}
        >
          서울 전체
        </button>
        {SEOUL_DISTRICTS.map((gu) => (
          <button
            key={gu}
            onClick={() => setSelectedGu(gu === selectedGu ? "" : gu)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selectedGu === gu
                ? "bg-brand-500 border-brand-500 text-white"
                : "bg-white border-surface-300 text-gray-600 hover:border-brand-400"
            }`}
          >
            {gu}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 bg-surface-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 임대료 */}
            {selectedGu && data.rent ? (
              <>
                <div className="bg-white border border-surface-300 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">
                    {selectedGu} 임대료
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {data.rent.rent_per_sqm.toLocaleString()}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      천원/㎡
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    한국부동산원 기준
                  </p>
                </div>
                <div className="bg-white border border-surface-300 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">30㎡ 기준 월세</p>
                  <p className="text-xl font-bold text-gray-900">
                    {Math.round(
                      (data.rent.rent_per_sqm * 30) / 10,
                    ).toLocaleString()}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      만원
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    약 10평 소규모 카페
                  </p>
                </div>
              </>
            ) : !selectedGu && data.rent_all.length > 0 ? (
              <>
                <div className="bg-white border border-surface-300 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">최고 임대료</p>
                  <p className="text-xl font-bold text-gray-900">
                    {Math.max(
                      ...data.rent_all.map((r) => r.rent_per_sqm),
                    ).toLocaleString()}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      천원/㎡
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {
                      data.rent_all.reduce((a, b) =>
                        a.rent_per_sqm > b.rent_per_sqm ? a : b,
                      ).gu_name
                    }
                  </p>
                </div>
                <div className="bg-white border border-surface-300 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">평균 임대료</p>
                  <p className="text-xl font-bold text-gray-900">
                    {Math.round(
                      data.rent_all.reduce((s, r) => s + r.rent_per_sqm, 0) /
                        data.rent_all.length,
                    ).toLocaleString()}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      천원/㎡
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    서울 25개 구 기준
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-white border border-surface-300 rounded-xl p-4 col-span-2">
                <p className="text-xs text-gray-400">임대료 데이터 없음</p>
              </div>
            )}

            <div className="bg-white border border-surface-300 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">카페 매출 상권</p>
              <p className="text-xl font-bold text-gray-900">
                {data.sbiz.length}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  개
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1">sbiz 데이터 보유</p>
            </div>
            <div className="bg-white border border-surface-300 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">유동인구 상권</p>
              <p className="text-xl font-bold text-gray-900">
                {data.features.length}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  개
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1">ML 피처 보유</p>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-2">
            {(
              [
                { key: "sbiz", label: "카페 매출 현황" },
                { key: "flpop", label: "유동인구 · 생존율" },
              ] as { key: Tab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  tab === key
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "bg-white border-surface-300 text-gray-600 hover:border-brand-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 카페 매출 테이블 */}
          {tab === "sbiz" && (
            <div className="bg-white border border-surface-300 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-8">
                        #
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                        상권명
                      </th>
                      {!selectedGu && (
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                          구
                        </th>
                      )}
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">
                        월평균매출
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">
                        거래건수
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sbiz.map((row, i) => {
                      const rent = !selectedGu
                        ? getRentForGu(
                            SEOUL_DISTRICTS.find(
                              (g) =>
                                (data.rent_all.find((r) => r.gu_name === g) &&
                                  row.dong_name.includes(
                                    g.replace("구", ""),
                                  )) ??
                                false,
                            ) ?? "",
                          )
                        : undefined;
                      return (
                        <tr
                          key={`${row.dong_name}-${i}`}
                          className={`border-b border-surface-100 hover:bg-surface-50 transition-colors ${
                            i === 0 ? "bg-amber-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-800">
                              {row.dong_name}
                            </span>
                          </td>
                          {!selectedGu && (
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                              {row.gu_name || "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-semibold text-brand-600 whitespace-nowrap">
                            {fmtRevenue(row.monthly_revenue_avg)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                            {row.store_count?.toLocaleString() ?? "—"}건
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.sbiz.length === 0 && (
                <p className="text-center py-10 text-gray-400 text-sm">
                  데이터 없음
                </p>
              )}
            </div>
          )}

          {/* 유동인구 · 생존율 테이블 */}
          {tab === "flpop" && (
            <div className="bg-white border border-surface-300 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-8">
                        #
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        상권명
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        권역
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        일 유동인구
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        20대
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        30대
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        주말
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                        생존율
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.features.map((row, i) => (
                      <tr
                        key={`${row.dong_name}-${i}`}
                        className="border-b border-surface-100 hover:bg-surface-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {row.dong_name}
                        </td>
                        <td className="px-4 py-3">
                          {row.zone_cluster ? (
                            <span className="text-xs text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                              {row.zone_cluster}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                          {fmtPop(row.daily_floating_pop)}명
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                          {fmtPop(row.pop_age_20)}명
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                          {fmtPop(row.pop_age_30)}명
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                          {fmtPop(row.pop_weekend)}명
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {row.survival_rate != null ? (
                            <span
                              className={`font-semibold ${
                                Number(row.survival_rate) >= 0.7
                                  ? "text-emerald-600"
                                  : Number(row.survival_rate) >= 0.5
                                    ? "text-amber-500"
                                    : "text-red-500"
                              }`}
                            >
                              {fmtRate(row.survival_rate)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.features.length === 0 && (
                <p className="text-center py-10 text-gray-400 text-sm">
                  데이터 없음
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 text-right">
            출처: 서울시 상권분석서비스(sbiz) · 한국부동산원(reb) · 서울
            열린데이터광장
          </p>
        </>
      )}
    </div>
  );
}
