"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  business_type: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  detail_url: string | null;
};

const REGION_OPTIONS = ["전체", "마포구", "서울", "전국"];
const BIZ_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "전체 업종" },
  { value: "cafe", label: "카페" },
  { value: "bakery", label: "베이커리" },
  { value: "snack", label: "분식" },
];

const COLOR_BY_REGION: Record<string, string> = {
  마포구: "#2563eb",
  서울: "#059669",
  전국: "#9333ea",
};

const apiBase = () =>
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function SubsidiesPage() {
  const [region, setRegion] = useState("전체");
  const [bizType, setBizType] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selected, setSelected] = useState<Program | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (region !== "전체") params.set("region", region);
      if (bizType) params.set("business_type", bizType);
      const res = await fetch(`${apiBase()}/subsidies/calendar?${params}`);
      if (res.ok) setPrograms(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range, region, bizType]);

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
        // sync 실패해도 기존 DB 로 표시
      }
      fetchPrograms();
    })();
  }, [fetchPrograms]);

  const events = useMemo<EventInput[]>(
    () =>
      programs
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
    [programs],
  );

  const handleEventClick = (arg: EventClickArg) => {
    const program = arg.event.extendedProps.program as Program | undefined;
    if (program) setSelected(program);
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
            마포구 카페 대상 지원사업을 캘린더로 확인하고, 공고 원문으로 바로
            이동할 수 있어요.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="border border-surface-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={bizType}
            onChange={(e) => setBizType(e.target.value)}
            className="border border-surface-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {BIZ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <LegendDot color={COLOR_BY_REGION.마포구} label="마포구" />
        <LegendDot color={COLOR_BY_REGION.서울} label="서울" />
        <LegendDot color={COLOR_BY_REGION.전국} label="전국" />
        {loading && (
          <span className="ml-auto text-brand-500">불러오는 중…</span>
        )}
        <span className="ml-auto text-gray-400">{programs.length}건</span>
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

      {selected && (
        <DetailDrawer program={selected} onClose={() => setSelected(null)} />
      )}

      <style jsx global>{`
        .subsidy-calendar .fc-event-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
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
  const period =
    program.start_date && program.end_date
      ? `${program.start_date} ~ ${program.end_date}`
      : program.end_date
        ? `~ ${program.end_date}`
        : "기간 미정";

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        className="w-full md:w-[420px] bg-white h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-surface-300 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs text-brand-500 font-medium mb-1">
              {program.region ?? "지역 미지정"}
              {program.business_type ? ` · ${program.business_type}` : ""}
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
          <div>
            <p className="text-xs text-gray-400 mb-1">접수 기간</p>
            <p className="font-medium text-gray-800">{period}</p>
          </div>
          {program.description && (
            <div>
              <p className="text-xs text-gray-400 mb-1">설명</p>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {program.description}
              </p>
            </div>
          )}
          {program.detail_url && (
            <a
              href={program.detail_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
            >
              원문 보기 ↗
            </a>
          )}
          <p className="text-[11px] text-gray-400 pt-4 border-t border-surface-200">
            본 내용은 기업마당 공공 API에서 수집된 공고 참고용이며, 신청 전
            원문을 반드시 확인하세요.
          </p>
        </div>
      </aside>
    </div>
  );
};
