"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Prediction {
  dong_name: string;
  gu_name: string; // 상권 유형 (골목상권 / 발달상권 / 전통시장 / 관광특구)
  cafe_count: number;
  daily_floating_pop: number | null;
  monthly_revenue_label: number | null;
  predicted_monthly_revenue: number | null;
  reference_period: string;
}

const AREA_TYPE_COLOR: Record<string, string> = {
  골목상권: "#6366f1",
  발달상권: "#10b981",
  전통시장: "#f59e0b",
  관광특구: "#ef4444",
};

const AREA_TYPE_LABEL: Record<string, string> = {
  골목상권: "골목",
  발달상권: "발달",
  전통시장: "전통",
  관광특구: "관광",
};

const fmt = (v: number) =>
  v >= 10000 ? `${(v / 10000).toFixed(1)}만원` : `${v.toLocaleString()}원`;

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: Prediction & { predicted: number; actual: number | null };
  }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-surface-300 rounded-xl shadow-lg px-4 py-3 text-sm space-y-1 min-w-[200px]">
      <p className="font-semibold text-gray-800 truncate">{d.dong_name}</p>
      <p className="text-gray-500 text-xs">{d.gu_name}</p>
      <div className="border-t border-surface-200 pt-2 space-y-1">
        <p className="flex justify-between gap-4">
          <span className="text-gray-500">AI 예측</span>
          <span className="font-semibold text-brand-600">
            {d.predicted != null ? fmt(d.predicted) : "—"}/건
          </span>
        </p>
        {d.actual != null && (
          <p className="flex justify-between gap-4">
            <span className="text-gray-500">실제 데이터</span>
            <span className="text-gray-700">{fmt(d.actual)}/건</span>
          </p>
        )}
        <p className="flex justify-between gap-4">
          <span className="text-gray-500">월 거래건수</span>
          <span className="text-gray-700">
            {d.cafe_count?.toLocaleString()}건
          </span>
        </p>
        {d.daily_floating_pop != null && (
          <p className="flex justify-between gap-4">
            <span className="text-gray-500">유동인구</span>
            <span className="text-gray-700">
              {d.daily_floating_pop.toLocaleString()}명
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default function AiRevenueChart() {
  const [data, setData] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/location/ml-predictions`)
      .then((r) => r.json())
      .then((rows: Prediction[]) => setData(rows))
      .catch(() => setError("데이터 로딩 실패"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-surface-300 rounded-2xl p-6">
        <div className="h-4 w-40 bg-surface-200 rounded animate-pulse mb-6" />
        <div className="h-64 bg-surface-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-white border border-surface-300 rounded-2xl p-6 text-center text-gray-400 text-sm py-12">
        {error ?? "마포구 상권 예측 데이터가 없습니다."}
      </div>
    );
  }

  const chartData = (showAll ? data : data.slice(0, 20)).map((d) => ({
    ...d,
    name:
      d.dong_name.length > 12 ? d.dong_name.slice(0, 12) + "…" : d.dong_name,
    predicted: d.predicted_monthly_revenue ?? 0,
    actual: d.monthly_revenue_label,
  }));

  const areaTypes = Array.from(
    new Set(data.map((d) => d.gu_name).filter(Boolean)),
  );

  return (
    <div className="bg-white border border-surface-300 rounded-2xl p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-brand-500 text-xs font-semibold tracking-widest uppercase mb-1">
            AI Prediction
          </p>
          <h2 className="text-gray-900 font-bold text-base">
            마포구 상권별 거래당 매출 예측
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            XGBoost 모델 · 유동인구 + 상권 유형 기반 · 단위: 원/건
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {areaTypes.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1.5 text-xs text-gray-600 px-2 py-1
                         rounded-full border border-surface-300"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: AREA_TYPE_COLOR[t] ?? "#94a3b8" }}
              />
              {AREA_TYPE_LABEL[t] ?? t}
            </span>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer
        width="100%"
        height={Math.max(280, chartData.length * 28)}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
          barSize={14}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#f1f5f9"
          />
          <XAxis
            type="number"
            tickFormatter={(v) => fmt(v)}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={110}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="predicted" radius={[0, 6, 6, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={AREA_TYPE_COLOR[entry.gu_name] ?? "#6366f1"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 더 보기 */}
      {data.length > 20 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-xs text-gray-400 hover:text-gray-600
                     border border-surface-300 rounded-xl py-2 transition-colors"
        >
          {showAll ? "접기 ▲" : `전체 ${data.length}개 상권 보기 ▼`}
        </button>
      )}

      {/* 해석 가이드 */}
      <p className="text-gray-400 text-xs border-t border-surface-200 pt-3">
        거래당 매출 = 상권 커피 업종 월 매출 ÷ 월 거래건수. 점포 수가 아닌 거래
        단위 기준이므로 절대값보다 상권 간 상대적 비교에 활용하세요.
      </p>
    </div>
  );
}
