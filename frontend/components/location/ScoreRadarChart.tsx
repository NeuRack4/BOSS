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

  // 레이더용 스케일링 (매출·BEP)
  // 0 기준 비율 스케일 — min-max 정규화 대신 사용해 극단값(0/100 강제) 방지
  const revenues = scores.map((s) => s.estimated_monthly_revenue);
  const beps = scores.map((s) => Math.min(s.bep_months, 120));
  const maxRev = Math.max(...revenues);
  const minBep = Math.min(...beps);

  // 매출: 최대값 대비 비율 (최고 상권만 100)
  const revScore = (v: number) =>
    maxRev === 0 ? 50 : Math.round((v / maxRev) * 100);

  // BEP: 최단 기준 비율 역산 (최단 상권만 100, 나머지는 비례)
  const bepScore = (v: number) =>
    v === 0 ? 100 : Math.round((minBep / v) * 100);

  const data = AXES.map(({ key, label }) => {
    const entry: Record<string, string | number> = { axis: label };
    scores.forEach((s) => {
      if (key === "_rev_score") {
        entry[s.district] = revScore(s.estimated_monthly_revenue);
      } else if (key === "_bep_score") {
        entry[s.district] = bepScore(Math.min(s.bep_months, 120));
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
