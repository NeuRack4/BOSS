"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";

type Program = {
  id: number;
  external_id: string;
  title: string;
  organization: string | null;
  region: string | null;
  program_kind: string | null;
  sub_kind: string | null;
  target: string | null;
  start_date: string | null;
  end_date: string | null;
  period_raw: string | null;
  is_ongoing: boolean;
  description: string | null;
  detail_url: string | null;
  external_url: string | null;
  hashtags: string | null;
};

type RegionLevel = null | "마포구" | "서울" | "전국";

const REGION_LEVELS: { value: Exclude<RegionLevel, null>; label: string }[] = [
  { value: "마포구", label: "마포구" },
  { value: "서울", label: "+ 서울" },
  { value: "전국", label: "+ 전국" },
];

const REGIONS_INCLUDED: Record<Exclude<RegionLevel, null>, string[]> = {
  마포구: ["마포구"],
  서울: ["마포구", "서울"],
  전국: ["마포구", "서울", "전국"],
};

const COLOR_BY_REGION: Record<string, string> = {
  마포구: "#2563eb",
  서울: "#059669",
  전국: "#9333ea",
};

const apiBase = () =>
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type SearchHit = Program & { similarity: number };

type AutoMatchResult = {
  query: string;
  results: (Program & { similarity: number })[];
};

export default function SubsidiesPage() {
  const [regionLevel, setRegionLevel] = useState<RegionLevel>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ongoing, setOngoing] = useState<Program[]>([]);
  const [selected, setSelected] = useState<Program | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [autoMatch, setAutoMatch] = useState<AutoMatchResult | null>(null);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const syncRanRef = useRef(false);
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return { from: fmtDate(from), to: fmtDate(to) };
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const [calRes, ongRes] = await Promise.all([
        fetch(`${apiBase()}/subsidies/calendar?${qs}`),
        fetch(`${apiBase()}/subsidies/ongoing`),
      ]);
      if (calRes.ok) setPrograms(await calRes.json());
      if (ongRes.ok) setOngoing(await ongRes.json());
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchAutoMatch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAutoMatchLoading(true);
    try {
      const res = await fetch(`${apiBase()}/subsidies/auto-match`, {
        headers: { "X-User-Id": user.id },
      });
      if (res.ok) setAutoMatch(await res.json());
    } finally {
      setAutoMatchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (syncRanRef.current) {
      fetchPrograms();
      return;
    }
    syncRanRef.current = true;
    (async () => {
      try {
        await fetch(`${apiBase()}/subsidies/sync-today`, { method: "POST" });
      } catch {
        // sync 실패해도 기존 DB 로 렌더
      }
      fetchPrograms();
    })();
    fetchAutoMatch();
  }, [fetchPrograms, fetchAutoMatch]);

  const visibleRegions = useMemo(
    () => (regionLevel ? REGIONS_INCLUDED[regionLevel] : []),
    [regionLevel],
  );

  const visiblePrograms = useMemo(
    () =>
      regionLevel === null
        ? []
        : programs.filter((p) => p.region && visibleRegions.includes(p.region)),
    [programs, regionLevel, visibleRegions],
  );

  const visibleOngoing = useMemo(
    () =>
      regionLevel === null
        ? []
        : ongoing.filter((p) => p.region && visibleRegions.includes(p.region)),
    [ongoing, regionLevel, visibleRegions],
  );

  const events = useMemo<EventInput[]>(
    () =>
      visiblePrograms
        .filter((p) => p.start_date && p.end_date)
        .map((p) => {
          const endExclusive = new Date(p.end_date!);
          endExclusive.setDate(endExclusive.getDate() + 1);
          return {
            id: String(p.id),
            title: p.title,
            start: p.start_date!,
            end: fmtDate(endExclusive),
            backgroundColor: COLOR_BY_REGION[p.region ?? ""] ?? "#475569",
            borderColor: COLOR_BY_REGION[p.region ?? ""] ?? "#475569",
            extendedProps: { program: p },
          };
        }),
    [visiblePrograms],
  );

  const handleEventClick = (arg: EventClickArg) => {
    const program = arg.event.extendedProps.program as Program | undefined;
    if (program) setSelected(program);
  };

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchHits(null);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${apiBase()}/subsidies/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, match_count: 15 }),
      });
      if (res.ok) setSearchHits(await res.json());
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchHits(null);
  };

  const handleDatesSet = (arg: { startStr: string; endStr: string }) => {
    const from = arg.startStr.slice(0, 10);
    const toDate = new Date(arg.endStr);
    toDate.setDate(toDate.getDate() - 1);
    const to = fmtDate(toDate);
    if (from !== range.from || to !== range.to) setRange({ from, to });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지원사업 공고</h1>
          <p className="text-sm text-gray-500 mt-1">
            창업 대분류 + 서울/전국 공고를 캘린더로 확인하고, 원문으로 바로
            이동할 수 있어요.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 mr-1">표시 범위</span>
          <div className="inline-flex rounded-lg border border-surface-300 bg-white overflow-hidden">
            <button
              onClick={() => setRegionLevel(null)}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                regionLevel === null
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-surface-100"
              }`}
            >
              숨김
            </button>
            {REGION_LEVELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRegionLevel(value)}
                className={`px-3 py-1.5 text-sm font-medium border-l border-surface-300 transition ${
                  regionLevel === value
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:bg-surface-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 맞춤 추천 섹션 */}
      <section className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">✦ 내 상황에 맞는 추천</h2>
            {autoMatch && (
              <p className="text-xs text-gray-400 mt-0.5">
                검색 쿼리: <span className="text-brand-500">{autoMatch.query}</span>
              </p>
            )}
          </div>
          <button
            onClick={fetchAutoMatch}
            disabled={autoMatchLoading}
            className="text-xs text-brand-500 hover:text-brand-700 disabled:opacity-50"
          >
            {autoMatchLoading ? "분석 중…" : "새로고침"}
          </button>
        </div>

        {autoMatchLoading && !autoMatch && (
          <p className="text-sm text-gray-400">프로필 기반으로 지원사업을 분석하고 있습니다…</p>
        )}

        {autoMatch && autoMatch.results.length === 0 && (
          <p className="text-sm text-gray-500">현재 조건에 맞는 추천 지원사업이 없습니다.</p>
        )}

        {autoMatch && autoMatch.results.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {autoMatch.results.slice(0, 6).map((p) => (
              <li
                key={p.id}
                onClick={() => setSelected(p)}
                className="cursor-pointer border border-surface-300 rounded-lg px-4 py-3 bg-white hover:border-brand-500 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-brand-500 font-medium">
                    {p.region ?? "지역 미지정"}
                    {p.sub_kind ? ` · ${p.sub_kind}` : ""}
                  </span>
                  {p.similarity > 0 && (
                    <span className="ml-auto text-gray-400">
                      매칭 {(p.similarity * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2">{p.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {p.period_raw ?? (p.start_date && p.end_date ? `${p.start_date} ~ ${p.end_date}` : "기간 미정")}
                  {p.organization ? ` · ${p.organization}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col md:flex-row gap-2 md:items-center bg-white border border-surface-300 rounded-xl px-4 py-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="예) 여성 창업, ICT 스타트업, 소상공인 자금"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
        />
        <div className="flex gap-2">
          <button
            onClick={runSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {searching ? "검색 중…" : "검색"}
          </button>
          {searchHits !== null && (
            <button
              onClick={clearSearch}
              className="px-3 py-1.5 rounded-lg border border-surface-300 text-sm"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {searchHits !== null && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            검색 결과{" "}
            <span className="text-gray-400 font-normal">
              ({searchHits.length})
            </span>
          </h2>
          {searchHits.length === 0 ? (
            <p className="text-sm text-gray-500">일치하는 공고가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {searchHits.map((p) => (
                <li
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer border border-surface-300 rounded-lg px-4 py-3 bg-white hover:border-brand-500 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-brand-500 font-medium">
                      {p.region ?? "지역 미지정"}
                      {p.sub_kind ? ` · ${p.sub_kind}` : ""}
                    </span>
                    {p.similarity > 0 && (
                      <span className="ml-auto text-gray-400">
                        유사도 {(p.similarity * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {p.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {p.period_raw ??
                      (p.start_date && p.end_date
                        ? `${p.start_date} ~ ${p.end_date}`
                        : "기간 미정")}
                    {p.organization ? ` · ${p.organization}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <LegendDot color={COLOR_BY_REGION.마포구} label="마포구" />
        <LegendDot color={COLOR_BY_REGION.서울} label="서울" />
        <LegendDot color={COLOR_BY_REGION.전국} label="전국" />
        {loading && (
          <span className="ml-auto text-brand-500">불러오는 중…</span>
        )}
        <span className="ml-auto text-gray-400">
          {regionLevel === null
            ? "범위를 선택하면 공고가 표시돼요"
            : `캘린더 ${visiblePrograms.length}건 · 상시 ${visibleOngoing.length}건`}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-surface-300 p-3 md:p-4 subsidy-calendar">
        <FullCalendar
          key={isMobile ? "list" : "month"}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? "listMonth" : "dayGridMonth"}
          locale="ko"
          height="auto"
          firstDay={0}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: isMobile ? "" : "dayGridMonth,listMonth",
          }}
          buttonText={{ today: "오늘", month: "월간", list: "리스트" }}
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          displayEventTime={false}
          noEventsText="이 기간에 등록된 공고가 없습니다."
          dayMaxEvents={isMobile ? false : 3}
        />
      </div>

      {visibleOngoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            상시 모집{" "}
            <span className="text-gray-400 font-normal">
              ({visibleOngoing.length})
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            '예산 소진시까지', '추후 공지' 등 기간이 지정되지 않은 공고는 별도로
            모아 보여드려요.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleOngoing.map((p) => (
              <li
                key={p.id}
                onClick={() => setSelected(p)}
                className="cursor-pointer border border-surface-300 rounded-lg px-4 py-3 bg-white hover:border-brand-500 hover:shadow-sm transition"
              >
                <p className="text-xs text-brand-500 font-medium">
                  {p.region ?? "지역 미지정"}
                  {p.sub_kind ? ` · ${p.sub_kind}` : ""}
                </p>
                <p className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2">
                  {p.title}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {p.period_raw ?? "상시"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <DetailDrawer program={selected} onClose={() => setSelected(null)} />
      )}

      <style jsx global>{`
        .subsidy-calendar .fc-daygrid-event {
          padding: 0 4px;
          margin: 1px 2px;
          font-size: 11px;
          line-height: 1.25;
          border-radius: 3px;
          border-width: 0;
        }
        .subsidy-calendar .fc-daygrid-event .fc-event-main {
          padding: 0;
        }
        .subsidy-calendar .fc-daygrid-event .fc-event-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
          padding: 1px 0;
        }
        .subsidy-calendar .fc-daygrid-day-events {
          margin-top: 1px;
        }
        .subsidy-calendar .fc-list-event:hover td {
          background: #eff6ff;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
    {label}
  </span>
);

const DetailDrawer = ({
  program,
  onClose,
}: {
  program: Program;
  onClose: () => void;
}) => {
  const router = useRouter();
  const period = program.period_raw
    ? program.period_raw
    : program.start_date && program.end_date
      ? `${program.start_date} ~ ${program.end_date}`
      : "기간 미정";

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        className="w-full md:w-[460px] bg-white h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-surface-300 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs text-brand-500 font-medium mb-1">
              {program.region ?? "지역 미지정"}
              {program.sub_kind ? ` · ${program.sub_kind}` : ""}
            </p>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">
              {program.title}
            </h2>
            {program.organization && (
              <p className="text-xs text-gray-500 mt-1">
                {program.organization}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="접수 기간" value={period} />
            {program.target && (
              <Info label="지원 대상" value={program.target} />
            )}
            {program.program_kind && (
              <Info label="분야" value={program.program_kind} />
            )}
          </div>
          {program.description && (
            <div>
              <p className="text-xs text-gray-400 mb-1">내용</p>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {program.description}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                onClose();
                router.push(`/drafts/subsidy?id=${program.id}`);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
            >
              ✦ 신청서 초안 자동 작성
            </button>
            <div className="flex gap-2">
              {program.detail_url && (
                <a
                  href={program.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg border border-surface-300 text-sm font-medium hover:bg-surface-100"
                >
                  기업마당 원문 ↗
                </a>
              )}
              {program.external_url && (
                <a
                  href={program.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg border border-surface-300 text-sm font-medium hover:bg-surface-100"
                >
                  주관기관 ↗
                </a>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 pt-4 border-t border-surface-200">
            본 내용은 기업마당 공공 API 에서 수집된 공고 참고용이며, 신청 전
            원문을 반드시 확인하세요.
          </p>
        </div>
      </aside>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-gray-400 mb-0.5">{label}</p>
    <p className="font-medium text-gray-800">{value}</p>
  </div>
);
