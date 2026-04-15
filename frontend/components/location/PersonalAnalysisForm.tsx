"use client";

import { useState, useEffect, useRef } from "react";

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

interface RankedDistrict {
  rank: number;
  district: string;
  area_type: string;
  zone_cluster: string;
  predicted_monthly_revenue: number;
  daily_floating_pop: number | null;
}

const fmt = (v: number) =>
  v >= 100000000
    ? `${(v / 100000000).toFixed(1)}억원`
    : v >= 10000
      ? `${(v / 10000).toFixed(0)}만원`
      : `${v.toLocaleString()}원`;

const fmtPop = (v: number | null) =>
  v == null
    ? "—"
    : v >= 10000
      ? `${(v / 10000).toFixed(0)}만명`
      : `${v.toLocaleString()}명`;

const RANK_STYLE = (rank: number) => {
  if (rank === 1) return "bg-amber-400 text-white";
  if (rank === 2) return "bg-gray-400 text-white";
  if (rank === 3) return "bg-orange-700 text-white";
  return "bg-surface-200 text-gray-500";
};

export default function PersonalAnalysisForm({ userId }: { userId?: string }) {
  const [seats, setSeats] = useState("");
  const [hours, setHours] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  const [selectedGu, setSelectedGu] = useState("");

  const [ranking, setRanking] = useState<RankedDistrict[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!seats || !hours || !price || !days) {
      setRanking([]);
      setFetched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          seat_count: seats,
          operating_hours: hours,
          avg_price: price,
          operating_days: days,
          limit: "20",
        });
        if (selectedGu) params.set("admin_gu", selectedGu);
        const res = await fetch(`${API_BASE}/location/top20?${params}`);
        if (res.ok) {
          setRanking(await res.json());
          setFetched(true);
        }
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [seats, hours, price, days, selectedGu]);

  const maxRevenue = ranking[0]?.predicted_monthly_revenue ?? 1;

  return (
    <div className="space-y-6">
      {/* 입력 조건 */}
      <div className="bg-white border border-surface-300 rounded-2xl p-6">
        <p className="text-brand-500 text-xs font-semibold tracking-widest uppercase mb-1">
          내 매장 조건
        </p>
        <h2 className="text-gray-900 font-bold text-base mb-4">
          조건을 입력하면 서울 상권 Top 20을 AI가 예측합니다
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "좌석 수",
              placeholder: "예: 20",
              value: seats,
              set: setSeats,
              unit: "석",
            },
            {
              label: "일 영업시간",
              placeholder: "예: 10",
              value: hours,
              set: setHours,
              unit: "h",
            },
            {
              label: "객단가",
              placeholder: "예: 6000",
              value: price,
              set: setPrice,
              unit: "원",
            },
            {
              label: "월 영업일",
              placeholder: "예: 26",
              value: days,
              set: setDays,
              unit: "일",
            },
          ].map(({ label, placeholder, value, set, unit }) => (
            <div key={label} className="space-y-1">
              <label className="text-xs text-gray-500">{label}</label>
              <div className="relative">
                <input
                  type="number"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm
                             pr-8 focus:outline-none focus:border-brand-400 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 위치 필터 */}
        <div className="mt-4 space-y-1">
          <label className="text-xs text-gray-500">희망 위치 (선택)</label>
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
        </div>
        {seats && hours && price && days && (
          <p className="text-xs text-gray-400 mt-3">
            추정 월 거래건수{" "}
            <span className="font-semibold text-gray-600">
              {Math.round(
                parseInt(seats) *
                  parseFloat(hours) *
                  (60 / 90) *
                  0.6 *
                  parseInt(days),
              ).toLocaleString()}
              건
            </span>
            <span className="ml-1">(체류시간 90분 · 점유율 60% 기준)</span>
          </p>
        )}
      </div>

      {/* Top 20 랭킹 */}
      <div className="bg-white border border-surface-300 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-brand-500 text-xs font-semibold tracking-widest uppercase mb-1">
              AI Revenue Ranking
            </p>
            <h2 className="text-gray-900 font-bold text-base">
              {selectedGu
                ? `${selectedGu} 상권 예측 매출 Top 20`
                : "서울 상권 예측 매출 Top 20"}
            </h2>
          </div>
          {loading && (
            <span className="inline-block w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {!fetched && !loading && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏙️</p>
            <p className="text-sm">
              좌석 수 · 영업시간 · 객단가 · 영업일을 입력하면
            </p>
            <p className="text-sm">
              서울 전체 상권 AI 매출 예측 순위가 나타납니다
            </p>
          </div>
        )}

        {loading && ranking.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 bg-surface-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {ranking.length > 0 && (
          <div className="space-y-2">
            {ranking.map((item) => {
              const barWidth = Math.round(
                (item.predicted_monthly_revenue / maxRevenue) * 100,
              );
              return (
                <div key={item.district} className="relative group">
                  {/* 배경 바 */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-xl bg-brand-50 transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="relative flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-200 hover:border-brand-300 transition-colors">
                    {/* 순위 뱃지 */}
                    <span
                      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE(item.rank)}`}
                    >
                      {item.rank}
                    </span>

                    {/* 상권 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm truncate">
                          {item.district}
                        </span>
                        {item.zone_cluster && (
                          <span className="shrink-0 text-xs text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded font-medium">
                            {item.zone_cluster}
                          </span>
                        )}
                        {item.area_type && (
                          <span className="shrink-0 text-xs text-gray-400 bg-surface-100 px-1.5 py-0.5 rounded">
                            {item.area_type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        일 유동인구 {fmtPop(item.daily_floating_pop)}
                      </p>
                    </div>

                    {/* 예측 매출 */}
                    <span className="shrink-0 font-bold text-brand-600 text-sm">
                      {fmt(item.predicted_monthly_revenue)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fetched && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            ML 모델 단독 예측 · 체류시간 90분 · 좌석 점유율 60% 가정 · 참고용
          </p>
        )}
      </div>
    </div>
  );
}
