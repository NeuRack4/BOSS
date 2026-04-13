"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Summary = {
  current_total: number;
  prev_total: number;
  change_pct: number | null;
  transaction_count: number;
  daily_average: number;
  entries: { date: string; amount: number }[];
};

function formatAmount(n: number | undefined | null) {
  if (n == null) return "-";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만원`;
  return `${n.toLocaleString()}원`;
}

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(
        `${apiUrl}/sales/summary?year=${today.getFullYear()}&month=${today.getMonth() + 1}`,
        { headers: { "X-User-Id": user.id } },
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
      setLoading(false);
    };
    fetchSummary();
  }, []);

  // 일별 매출 집계
  const dailyData = (() => {
    if (!summary?.entries?.length) return [];
    const map: Record<string, number> = {};
    for (const e of summary.entries) {
      const day = e.date.slice(8, 10) + "일"; // "01일"
      map[day] = (map[day] || 0) + e.amount;
    }
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, amount]) => ({ day, amount }));
  })();

  const changeColor =
    summary?.change_pct != null
      ? summary.change_pct > 0
        ? "text-green-600"
        : "text-red-500"
      : "text-gray-400";

  const stats = summary
    ? [
        {
          label: "이번달 매출",
          value: formatAmount(summary.current_total),
          icon: "₩",
        },
        {
          label: "전달 대비",
          value:
            summary.change_pct != null
              ? `${summary.change_pct > 0 ? "▲" : "▼"} ${Math.abs(summary.change_pct)}%`
              : "-",
          icon: "↑",
          color: changeColor,
        },
        {
          label: "거래 건수",
          value: `${summary.transaction_count}건`,
          icon: "◈",
        },
        {
          label: "일 평균 매출",
          value: formatAmount(summary.daily_average),
          icon: "∼",
        },
      ]
    : [
        { label: "이번달 매출", value: "-", icon: "₩" },
        { label: "전달 대비", value: "-", icon: "↑" },
        { label: "거래 건수", value: "-", icon: "◈" },
        { label: "일 평균 매출", value: "-", icon: "∼" },
      ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          {today.getFullYear()}년 {today.getMonth() + 1}월 · 마포구 카페 운영
          현황
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon, color }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <span className="text-lg text-brand-500">{icon}</span>
            </div>
            <p className={`text-xl font-bold ${color ?? "text-gray-900"}`}>
              {loading ? <span className="text-gray-300">...</span> : value}
            </p>
          </div>
        ))}
      </div>

      {/* 일별 매출 차트 */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">일별 매출</h2>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : dailyData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            이번달 매출 데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} barSize={24}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString()}원`, "매출"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e8ecf8",
                }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {dailyData.map((_, i) => (
                  <Cell key={i} fill="#4f6ef7" fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => router.push("/dashboard/sales")}
          className="glass-card rounded-xl p-5 hover:border-brand-500/30 hover:glow-blue transition-all group text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl text-brand-500">₩</span>
            <h3 className="font-bold text-gray-900">매출 입력</h3>
          </div>
          <p className="text-sm text-gray-500">오늘의 매출을 기록하세요</p>
          <p className="text-xs text-brand-500 mt-3 group-hover:translate-x-1 transition-transform">
            바로가기 →
          </p>
        </button>

        <button
          onClick={() => router.push("/dashboard/insights")}
          className="glass-card rounded-xl p-5 hover:border-brand-500/30 hover:glow-blue transition-all group text-left"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl text-brand-500">✦</span>
            <h3 className="font-bold text-gray-900">AI 분석</h3>
          </div>
          <p className="text-sm text-gray-500">매출 데이터 기반 인사이트</p>
          <p className="text-xs text-brand-500 mt-3 group-hover:translate-x-1 transition-transform">
            바로가기 →
          </p>
        </button>
      </div>
    </div>
  );
}
