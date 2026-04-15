"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type AreaStat = {
  id: string;
  name: string;
  area: string;
  area_id: string;
  lat: number;
  lng: number;
  monthly_revenue: number;
  foot_traffic: number;
  rent_estimate: number;
  rent_is_real: boolean;
};

type RecommendArea = {
  area_id: string;
  area_name: string;
  score: number;
  survival_rate: number;
  avg_total: number;
  min_total: number;
  affordable: boolean;
};

type TabKey = "revenue" | "traffic" | "rent";

const TAB_LABELS: Record<TabKey, string> = {
  revenue: "월 매출 규모",
  traffic: "유동인구",
  rent:    "월세 추정",
};

const MEDALS = ["🥇", "🥈", "🥉"];
const RECOMMEND_COLORS = ["#16a34a", "#2563eb", "#9333ea"];
const RECOMMEND_BORDER = ["#15803d", "#1d4ed8", "#7e22ce"];

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function fmt(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString();
}

function fmtMan(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

function getColor(ratio: number): string {
  if (ratio > 0.8) return "#f97316";
  if (ratio > 0.6) return "#fb923c";
  if (ratio > 0.4) return "#fbbf24";
  if (ratio > 0.2) return "#60a5fa";
  return "#93c5fd";
}

export default function MapView() {
  const [areas, setAreas] = useState<AreaStat[]>([]);
  const [tab, setTab] = useState<TabKey>("revenue");
  const [selected, setSelected] = useState<AreaStat | null>(null);
  const [loading, setLoading] = useState(true);

  // 추천 레이어
  const [capital, setCapital] = useState("");
  const [age, setAge] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendArea[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recMode, setRecMode] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl()}/map/overview`)
      .then((r) => r.json())
      .then((data) => { setAreas(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fetchRecommendations = async () => {
    if (!capital) return;
    setRecLoading(true);
    const params = new URLSearchParams({ capital });
    if (age) params.append("age", age);
    const res = await fetch(`${apiUrl()}/recommend/areas?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRecommendations(data.results?.slice(0, 3) ?? []);
      setRecMode(true);
    }
    setRecLoading(false);
  };

  const clearRecommendations = () => {
    setRecommendations([]);
    setRecMode(false);
    setCapital("");
    setAge("");
  };

  const getRecommendRank = (areaId: string): number =>
    recommendations.findIndex((r) => r.area_id === areaId);

  const getValue = (a: AreaStat): number => {
    if (tab === "revenue") return a.monthly_revenue;
    if (tab === "traffic") return a.foot_traffic;
    return a.rent_estimate * 10_000;
  };

  const maxVal = Math.max(...areas.map(getValue), 1);

  const getMarkerStyle = (area: AreaStat) => {
    const rank = getRecommendRank(area.area_id);
    const isSelected = selected?.id === area.id;

    if (recMode && rank >= 0) {
      return {
        fillColor: RECOMMEND_COLORS[rank],
        fillOpacity: 0.9,
        color: isSelected ? "#000" : RECOMMEND_BORDER[rank],
        weight: isSelected ? 4 : 3,
        radius: 18 + (2 - rank) * 6,
      };
    }
    if (recMode) {
      // 추천 아닌 곳은 흐리게
      return {
        fillColor: "#9ca3af",
        fillOpacity: 0.3,
        color: "#d1d5db",
        weight: 1,
        radius: 10,
      };
    }
    const ratio = getValue(area) / maxVal;
    return {
      fillColor: getColor(ratio),
      fillOpacity: 0.75,
      color: isSelected ? "#1d4ed8" : "#fff",
      weight: isSelected ? 3 : 1.5,
      radius: 12 + ratio * 28,
    };
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">마포구 상권 지도</h1>
        <p className="text-sm text-gray-500 mt-1">
          실데이터 기반 32개 상권 포인트 — 소상공인진흥공단·서울 열린데이터
        </p>
      </div>

      {/* 추천 레이어 입력 */}
      <div className={`glass-card rounded-xl p-4 transition-colors ${recMode ? "border border-green-300 bg-green-50/30" : ""}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold text-gray-800">🚀 내 자본으로 추천 상권 보기</span>
          {recMode && (
            <button onClick={clearRecommendations}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-0.5 rounded">
              초기화
            </button>
          )}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">보유 자본 (만원)</label>
            <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
              placeholder="예: 8000"
              className="w-full px-3 py-2 rounded-lg border border-surface-300 bg-white text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div className="w-24">
            <label className="block text-xs text-gray-500 mb-1">나이 (선택)</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
              placeholder="예: 32"
              className="w-full px-3 py-2 rounded-lg border border-surface-300 bg-white text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <button onClick={fetchRecommendations} disabled={recLoading || !capital}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 disabled:opacity-50 whitespace-nowrap">
            {recLoading ? "분석 중…" : "지도에 표시"}
          </button>
        </div>

        {/* 추천 결과 뱃지 */}
        {recMode && recommendations.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {recommendations.map((r, i) => (
              <span key={r.area_id}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
                style={{ backgroundColor: RECOMMEND_COLORS[i] }}>
                {MEDALS[i]} {r.area_name}
                <span className="opacity-80 font-normal">· {(r.score * 100).toFixed(0)}점 · 생존율 {r.survival_rate}%</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 탭 (추천 모드가 아닐 때만) */}
      {!recMode && (
        <div className="flex gap-2">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${tab === k
                  ? "bg-brand-50 border-brand-500/40 text-brand-600"
                  : "border-surface-300 text-gray-500 hover:border-brand-300 bg-white"}`}>
              {TAB_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 지도 */}
        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden" style={{ height: 500 }}>
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">데이터 불러오는 중…</div>
          ) : (
            <MapContainer center={[37.552, 126.935]} zoom={13}
              style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {areas.map((area) => {
                const style = getMarkerStyle(area);
                const rank = getRecommendRank(area.area_id);
                return (
                  <CircleMarker key={area.id} center={[area.lat, area.lng]}
                    radius={style.radius}
                    pathOptions={{
                      fillColor: style.fillColor, fillOpacity: style.fillOpacity,
                      color: style.color, weight: style.weight,
                    }}
                    eventHandlers={{ click: () => setSelected(area) }}>
                    <Tooltip permanent direction="top" offset={[0, -8]}
                      className="!bg-transparent !border-0 !shadow-none !p-0">
                      <span className="text-xs font-bold text-gray-800 bg-white/80 px-1 rounded">
                        {recMode && rank >= 0 ? `${MEDALS[rank]} ` : ""}{area.area === area.name ? area.area : area.area}
                      </span>
                    </Tooltip>
                    <Popup>
                      <div className="text-sm space-y-1 min-w-[160px]">
                        <p className="font-bold text-gray-900">{area.name}</p>
                        {recMode && rank >= 0 && (
                          <p className="text-xs font-bold" style={{ color: RECOMMEND_COLORS[rank] }}>
                            {MEDALS[rank]} 추천 {rank + 1}위 · {(recommendations[rank].score * 100).toFixed(0)}점
                          </p>
                        )}
                        <p className="text-gray-600">월 매출 규모: <span className="font-semibold text-gray-900">{fmt(area.monthly_revenue)}원</span></p>
                        <p className="text-gray-600">유동인구: <span className="font-semibold text-gray-900">{area.foot_traffic.toLocaleString()}명</span></p>
                        <p className="text-gray-600">월세: <span className="font-semibold text-gray-900">{area.rent_estimate}만원</span>
                          {!area.rent_is_real && <span className="text-gray-400 text-xs ml-1">(추정)</span>}
                        </p>
                        {recMode && rank >= 0 && (
                          <p className="text-gray-600">창업비용: <span className="font-semibold text-gray-900">
                            최소 {fmtMan(recommendations[rank].min_total)} ~ 평균 {fmtMan(recommendations[rank].avg_total)}
                          </span></p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* 사이드 패널 */}
        <div className="space-y-3">
          {recMode ? (
            /* 추천 모드 패널 */
            <div className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500">추천 상권 상세</p>
              {recommendations.map((r, i) => (
                <div key={r.area_id} className="rounded-lg p-3 border"
                  style={{ borderColor: RECOMMEND_COLORS[i] + "66", backgroundColor: RECOMMEND_COLORS[i] + "0d" }}>
                  <p className="text-sm font-bold text-gray-900 mb-2">{MEDALS[i]} {r.area_name}</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>종합 점수</span>
                      <span className="font-bold" style={{ color: RECOMMEND_COLORS[i] }}>{(r.score * 100).toFixed(0)}점</span>
                    </div>
                    <div className="flex justify-between">
                      <span>생존율</span>
                      <span className="font-bold text-gray-900">{r.survival_rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>창업비용</span>
                      <span className="font-bold text-gray-900">{fmtMan(r.min_total)}~{fmtMan(r.avg_total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>자본 여유</span>
                      <span className={`font-bold ${r.affordable ? "text-green-600" : "text-yellow-600"}`}>
                        {r.affordable ? "✓ 평균 이내" : "⚠ 최소 가능"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 일반 모드 순위 패널 */
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 mb-3">{TAB_LABELS[tab]} 순위</p>
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {[...areas].sort((a, b) => getValue(b) - getValue(a)).slice(0, 10).map((area, i) => {
                  const ratio = getValue(area) / maxVal;
                  const val = getValue(area);
                  return (
                    <button key={area.id} onClick={() => setSelected(area)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                        ${selected?.id === area.id ? "bg-brand-50 border border-brand-200" : "hover:bg-surface-50"}`}>
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getColor(ratio) }} />
                      <span className="flex-1 text-xs font-medium text-gray-800 truncate">{area.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {tab === "rent" ? `${area.rent_estimate}만` : fmt(val)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 선택 상권 상세 */}
          {selected && (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">{selected.name}</p>
                <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">월 매출 규모</span>
                  <span className="font-bold text-gray-900">{fmt(selected.monthly_revenue)}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">유동인구</span>
                  <span className="font-bold text-gray-900">{selected.foot_traffic.toLocaleString()}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">월세 추정</span>
                  <span className="font-bold text-gray-900">
                    {selected.rent_estimate}만원
                    {!selected.rent_is_real && <span className="text-xs text-gray-400 ml-1">(추정)</span>}
                  </span>
                </div>
                <div className="flex justify-between border-t border-surface-200 pt-2">
                  <span className="text-gray-500">추정 순수익</span>
                  <span className="font-bold text-brand-600">
                    {fmt(Math.max(0, selected.monthly_revenue * 0.25 - selected.rent_estimate * 10_000))}원
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400">* 순수익 = 매출×25% - 월세 (단순 추정)</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-right">
        출처: 소상공인진흥공단 상권분석서비스 (2024년 3·4분기) · 월세는 한국부동산원·서울 상가임대차 시장조사 기반
      </p>
    </div>
  );
}
