"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { DistrictScore } from "./LocationDashboard";

const COLORS = ["#4f6ef7", "#34d399", "#f59e0b"];

const AXES = [
  { key: "survival_score", label: "생존율" },
  { key: "growth_score", label: "성장성" },
  { key: "total_score", label: "종합점수" },
  { key: "_rev_score", label: "매출잠재력" }, // estimated_monthly_revenue 정규화
  { key: "_bep_score", label: "BEP 효율" }, // bep 역산
];

interface Props {
  scores: DistrictScore[];
}

export default function ScoreRadarChart({ scores }: Props) {
  if (scores.length === 0) return null;

  // 레이더용 정규화 (매출·BEP)
  const revenues = scores.map((s) => s.estimated_monthly_revenue);
  const beps = scores.map((s) => Math.min(s.bep_months, 120));
  const maxRev = Math.max(...revenues);
  const minRev = Math.min(...revenues);
  const maxBep = Math.max(...beps);
  const minBep = Math.min(...beps);

  const norm = (v: number, mn: number, mx: number) =>
    mx === mn ? 50 : Math.round(((v - mn) / (mx - mn)) * 100);
  const normInv = (v: number, mn: number, mx: number) =>
    mx === mn ? 50 : Math.round((1 - (v - mn) / (mx - mn)) * 100);

  const data = AXES.map(({ key, label }) => {
    const entry: Record<string, string | number> = { axis: label };
    scores.forEach((s) => {
      if (key === "_rev_score") {
        entry[s.district] = norm(s.estimated_monthly_revenue, minRev, maxRev);
      } else if (key === "_bep_score") {
        entry[s.district] = normInv(
          Math.min(s.bep_months, 120),
          minBep,
          maxBep,
        );
      } else {
        entry[s.district] = (s as unknown as Record<string, number>)[key] ?? 0;
      }
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: "#1e2235",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#e2e8f0",
            fontSize: 12,
          }}
        />
        {scores.map((s, i) => (
          <Radar
            key={s.district}
            name={s.district}
            dataKey={s.district}
            stroke={COLORS[i]}
            fill={COLORS[i]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
