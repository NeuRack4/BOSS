"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Users,
  FileText,
  TrendingUp,
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Download,
  ImageIcon,
  RefreshCw,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────────────────────

type Tab = "status" | "job-posting" | "labor-contract";

type HireStatus = {
  profile: {
    business_name: string;
    stage: string;
    sub_stage: string;
    district: string;
    months_since_open: number;
    employee_count: number;
  };
  sales_summary: {
    recent_90d_revenue: number;
    monthly_avg: number;
    peak_time_slot: string | null;
    record_count: number;
  } | null;
  has_sales_data: boolean;
  season_signal: { type: string; message: string } | null;
  min_wage_2025: number;
};

type InferenceResult = {
  triggered: boolean;
  reason: string;
  suggested_hire_type: string | null;
  suggested_weekly_hours: number | null;
};

type JobPostingResult = {
  draft_type: string;
  platforms: { karrot: string; alba: string; saramin: string };
  wage_simulation: WageSim;
  calculated_at: string;
};

type LaborContractResult = {
  draft_type: string;
  draft: string;
  wage_simulation: WageSim;
  calculated_at: string;
};

type VisualResult = {
  html: string;
  calculated_at: string;
};

type WageSim = {
  hourly_wage: number;
  weekly_hours: number;
  weekly_holiday_pay: number;
  monthly_base_pay: number;
  monthly_holiday_pay: number;
  monthly_total: number;
  four_insurance_required: boolean;
  note: string;
};

// ── 상수 ──────────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  karrot: "당근마켓",
  alba: "알바천국",
  saramin: "사람인",
};

const NEIGHBORHOODS = [
  "마포구",
  "홍대입구",
  "합정",
  "연남동",
  "망원동",
  "공덕",
  "성산동",
];

const STAGE_KO: Record<string, string> = {
  setup: "창업 준비",
  early_ops: "초기 운영",
  growth: "성장기",
  hiring_preparation: "채용 준비",
  hiring_in_progress: "채용 중",
  hiring_contract: "계약서 작성",
};

// ── 인건비 시뮬레이션 카드 ───────────────────────────────────────────────────

const WageCard = ({ sim }: { sim: WageSim }) => (
  <div className="rounded-xl border border-surface-300 bg-surface-50 p-4 mt-4">
    <p className="text-xs font-semibold text-gray-500 mb-3">
      인건비 시뮬레이션
    </p>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-gray-400 text-xs">시급</span>
        <p className="font-semibold">{sim.hourly_wage.toLocaleString()}원</p>
      </div>
      <div>
        <span className="text-gray-400 text-xs">주 근무시간</span>
        <p className="font-semibold">{sim.weekly_hours}시간</p>
      </div>
      <div>
        <span className="text-gray-400 text-xs">월 기본급</span>
        <p className="font-semibold">
          {sim.monthly_base_pay.toLocaleString()}원
        </p>
      </div>
      <div>
        <span className="text-gray-400 text-xs">주휴수당(월)</span>
        <p className="font-semibold">
          {sim.monthly_holiday_pay.toLocaleString()}원
        </p>
      </div>
    </div>
    <div className="mt-3 pt-3 border-t border-surface-300 flex items-center justify-between">
      <span className="text-sm text-gray-600">월 총 인건비</span>
      <span className="text-lg font-bold text-brand-600">
        {sim.monthly_total.toLocaleString()}원
      </span>
    </div>
    {sim.four_insurance_required && (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
        <AlertCircle size={13} />
        <span>주 15시간 이상 — 4대보험 가입 의무</span>
      </div>
    )}
    {sim.note && <p className="mt-2 text-xs text-gray-400">{sim.note}</p>}
  </div>
);

// ── 탭 1: 채용 현황 ────────────────────────────────────────────────────────────

const StatusTab = () => {
  const [status, setStatus] = useState<HireStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [inference, setInference] = useState<InferenceResult | null>(null);
  const [loadingInference, setLoadingInference] = useState(false);

  useEffect(() => {
    apiFetch("/hire/status")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoadingStatus(false));
  }, []);

  const runInference = async () => {
    if (!status) return;
    setLoadingInference(true);
    setInference(null);
    try {
      const res = await apiFetch("/hire/inference", {
        method: "POST",
        body: JSON.stringify({
          months_since_open: status.profile.months_since_open,
          has_staff: (status.profile.employee_count ?? 0) > 0,
          self_weekly_hours: 60,
          menu_count: 5,
          neighborhood: status.profile.district,
        }),
      });
      const data = await res.json();
      setInference(data);
    } finally {
      setLoadingInference(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!status) return null;

  const {
    profile,
    sales_summary,
    has_sales_data,
    season_signal,
    min_wage_2025,
  } = status;

  return (
    <div className="space-y-5">
      {/* 현황 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-surface-300 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">현재 단계</p>
          <p className="font-semibold text-gray-800">
            {STAGE_KO[profile.stage] || profile.stage || "—"}
          </p>
          <p className="text-xs text-brand-500 mt-0.5">
            {STAGE_KO[profile.sub_stage] || profile.sub_stage || ""}
          </p>
        </div>
        <div className="rounded-xl border border-surface-300 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">오픈 후</p>
          <p className="font-semibold text-gray-800">
            {profile.months_since_open > 0
              ? `${profile.months_since_open}개월`
              : "정보 없음"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{profile.district}</p>
        </div>
        <div className="rounded-xl border border-surface-300 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">현재 직원</p>
          <p className="font-semibold text-gray-800">
            {profile.employee_count > 0
              ? `${profile.employee_count}명`
              : "없음 (1인 운영)"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            2025 최저시급 {min_wage_2025.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 매출 요약 */}
      {has_sales_data && sales_summary ? (
        <div className="rounded-xl border border-surface-300 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-brand-500" />
            <p className="text-sm font-semibold text-gray-700">
              최근 3개월 매출 요약
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">총 매출</p>
              <p className="font-semibold text-gray-800">
                {(sales_summary.recent_90d_revenue / 10000).toFixed(0)}만원
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">월 평균</p>
              <p className="font-semibold text-gray-800">
                {(sales_summary.monthly_avg / 10000).toFixed(0)}만원
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">피크 시간대</p>
              <p className="font-semibold text-gray-800">
                {sales_summary.peak_time_slot || "—"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-400 bg-surface-50 p-4 text-center text-sm text-gray-400">
          매출 데이터가 없어요. 매출을 입력하면 AI 분석이 더 정확해집니다.
        </div>
      )}

      {/* 계절 신호 */}
      {season_signal && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              {season_signal.type} 채용 신호
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {season_signal.message}
            </p>
          </div>
        </div>
      )}

      {/* AI 분석 버튼 */}
      <div className="rounded-xl border border-surface-300 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-500" />
            <p className="text-sm font-semibold text-gray-700">
              AI 채용 타이밍 분석
            </p>
          </div>
          <button
            onClick={runInference}
            disabled={loadingInference}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            {loadingInference ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {loadingInference ? "분석 중..." : "지금 분석하기"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          현재 운영 상황, 매출 데이터, 계절 패턴을 종합해 AI가 채용 적정 시점을
          판단합니다.
        </p>

        {inference && (
          <div
            className={`rounded-lg p-4 ${
              inference.triggered
                ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-surface-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {inference.triggered ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : (
                <AlertCircle size={16} className="text-gray-400" />
              )}
              <p
                className={`text-sm font-semibold ${
                  inference.triggered ? "text-green-700" : "text-gray-600"
                }`}
              >
                {inference.triggered
                  ? "지금이 채용 타이밍입니다!"
                  : "아직 채용 시기가 아닙니다"}
              </p>
            </div>
            <p className="text-xs text-gray-600 mb-2">{inference.reason}</p>
            {inference.triggered && (
              <div className="flex gap-3 text-xs">
                <span className="bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-medium">
                  {inference.suggested_hire_type}
                </span>
                {inference.suggested_weekly_hours && (
                  <span className="bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-medium">
                    주 {inference.suggested_weekly_hours}시간 권장
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── 체크박스 멀티셀렉트 헬퍼 ────────────────────────────────────────────────

const CheckGroup = ({
  label,
  options,
  selected,
  onChange,
  extra,
  onExtraChange,
  extraPlaceholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  extra?: string;
  onExtraChange?: (v: string) => void;
  extraPlaceholder?: string;
}) => {
  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selected.includes(opt)
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white text-gray-600 border-surface-300 hover:border-brand-400"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {onExtraChange !== undefined && (
        <input
          type="text"
          value={extra ?? ""}
          onChange={(e) => onExtraChange(e.target.value)}
          placeholder={extraPlaceholder ?? "직접 입력 (쉼표로 구분)"}
          className="mt-2 w-full rounded-lg border border-surface-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      )}
    </div>
  );
};

// ── 탭 2: 채용공고 작성 ────────────────────────────────────────────────────────

const WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const JOB_DUTIES_OPTIONS = [
  "카운터 응대",
  "에스프레소 음료 제조",
  "홀 관리",
  "마감 청소",
  "재고 관리",
  "베이킹 보조",
  "배달 포장",
  "SNS 관리",
];
const PREFERRED_OPTIONS = [
  "바리스타 자격증",
  "마포구 거주자",
  "경력자 우대",
  "즉시 출근 가능",
  "장기 근무 가능",
  "대화 가능한 분",
];
const BENEFITS_OPTIONS = [
  "음료 무료 제공",
  "식사 제공",
  "교통비 지원",
  "주휴수당 포함",
  "4대보험 가입",
  "명절 상여",
  "근무복 지급",
];
const WORK_PERIOD_OPTIONS = ["단기 (1~3개월)", "장기 (6개월 이상)", "협의"];

const JobPostingTab = () => {
  // 기본 근무 조건
  const [neighborhood, setNeighborhood] = useState("마포구");
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [hourlyWage, setHourlyWage] = useState(10320);
  // 카페 정보
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  // 근무 일정
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [workPeriod, setWorkPeriod] = useState("");
  const [headcount, setHeadcount] = useState(1);
  // 모집 정보
  const [jobDuties, setJobDuties] = useState<string[]>([]);
  const [jobDutiesExtra, setJobDutiesExtra] = useState("");
  const [preferred, setPreferred] = useState<string[]>([]);
  const [preferredExtra, setPreferredExtra] = useState("");
  // 복리후생 & 추가
  const [benefits, setBenefits] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState("");
  // 텍스트 결과
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobPostingResult | null>(null);
  const [activePlatform, setActivePlatform] =
    useState<keyof JobPostingResult["platforms"]>("karrot");
  // 디자인 PDF 결과
  const [stylePrompt, setStylePrompt] = useState("");
  const [loadingVisual, setLoadingVisual] = useState(false);
  const [visualResult, setVisualResult] = useState<VisualResult | null>(null);

  // DB에서 카페 정보 프리필
  useEffect(() => {
    apiFetch("/hire/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile?.business_name)
          setBusinessName(data.profile.business_name);
        if (data?.profile?.address) setAddress(data.profile.address);
        if (data?.profile?.district) setNeighborhood(data.profile.district);
      })
      .catch(() => {});
  }, []);

  const buildDuties = () => [
    ...jobDuties,
    ...jobDutiesExtra
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const buildPreferred = () => [
    ...preferred,
    ...preferredExtra
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  // ── 유효성 검사 ──────────────────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    businessName: !businessName.trim(),
    address: !address.trim(),
    workDays: workDays.length === 0,
    workPeriod: !workPeriod.trim(),
    jobDuties: buildDuties().length === 0,
  };
  const isValid = !Object.values(errors).some(Boolean);

  const handleGenerate = async () => {
    setSubmitted(true);
    if (!isValid) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch("/hire/job-posting", {
        method: "POST",
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => ({
    neighborhood,
    weekly_hours: weeklyHours,
    hourly_wage: hourlyWage,
    business_name: businessName,
    address,
    work_days: workDays,
    work_start: workStart,
    work_end: workEnd,
    work_period: workPeriod,
    headcount,
    job_duties: buildDuties(),
    preferred: buildPreferred(),
    benefits,
    extra_note: extraNote,
  });

  const handleVisualGenerate = async () => {
    setSubmitted(true);
    if (!isValid) return;
    setLoadingVisual(true);
    setVisualResult(null);
    try {
      const res = await apiFetch("/hire/job-posting-visual", {
        method: "POST",
        body: JSON.stringify({ ...buildPayload(), style_prompt: stylePrompt }),
      });
      const data = await res.json();
      setVisualResult(data);
    } finally {
      setLoadingVisual(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!visualResult?.html) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const container = document.createElement("div");
    container.innerHTML = visualResult.html;
    document.body.appendChild(container);
    await html2pdf()
      .set({
        margin: 0,
        filename: `채용공고_${businessName || "카페"}_${visualResult.calculated_at}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();
    document.body.removeChild(container);
  };

  const inputCls = (hasError = false) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 ${
      hasError ? "border-red-400 focus:ring-red-400" : "border-surface-300"
    }`;
  const sectionTitle =
    "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-1";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-surface-300 bg-white p-5 space-y-6">
        {/* 섹션 1: 카페 기본 정보 */}
        <div>
          <p className={sectionTitle}>카페 정보</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                카페 상호명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="예: 연남동 커피로스터스"
                className={inputCls(submitted && errors.businessName)}
              />
              {submitted && errors.businessName && (
                <p className="mt-1 text-xs text-red-400">
                  카페 상호명을 입력해주세요.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                근무지 주소 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울 마포구 연남로 123"
                className={inputCls(submitted && errors.address)}
              />
              {submitted && errors.address && (
                <p className="mt-1 text-xs text-red-400">
                  근무지 주소를 입력해주세요.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">상권</label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className={inputCls()}
              >
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                모집 인원
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={headcount}
                  onChange={(e) => setHeadcount(Number(e.target.value))}
                  min={1}
                  max={10}
                  className={inputCls()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  명
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 섹션 2: 근무 조건 */}
        <div>
          <p className={sectionTitle}>근무 조건</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">시급</label>
              <div className="relative">
                <input
                  type="number"
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(Number(e.target.value))}
                  min={10320}
                  step={100}
                  className={inputCls()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  원
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                주 근무시간
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  min={1}
                  max={52}
                  className={inputCls()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  시간
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                출근 시간
              </label>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className={inputCls()}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                퇴근 시간
              </label>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className={inputCls()}
              />
            </div>
          </div>

          {/* 근무 요일 */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-2">
              근무 요일 <span className="text-red-400">*</span>
            </label>
            <div
              className={`flex gap-2 ${submitted && errors.workDays ? "p-2 rounded-lg ring-1 ring-red-400" : ""}`}
            >
              {WORK_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setWorkDays(
                      workDays.includes(d)
                        ? workDays.filter((x) => x !== d)
                        : [...workDays, d],
                    )
                  }
                  className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                    workDays.includes(d)
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-gray-600 border-surface-300 hover:border-brand-400"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {submitted && errors.workDays && (
              <p className="mt-1 text-xs text-red-400">
                근무 요일을 선택해주세요.
              </p>
            )}
          </div>

          {/* 근무 기간 */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">
              근무 기간 <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {WORK_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWorkPeriod(workPeriod === opt ? "" : opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    workPeriod === opt
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-gray-600 border-surface-300 hover:border-brand-400"
                  }`}
                >
                  {opt}
                </button>
              ))}
              <input
                type="text"
                value={
                  WORK_PERIOD_OPTIONS.includes(workPeriod) ? "" : workPeriod
                }
                onChange={(e) => setWorkPeriod(e.target.value)}
                placeholder="직접 입력"
                className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
              />
            </div>
            {submitted && errors.workPeriod && (
              <p className="mt-1 text-xs text-red-400">
                근무 기간을 선택하거나 입력해주세요.
              </p>
            )}
          </div>
        </div>

        {/* 섹션 3: 모집 정보 */}
        <div className="space-y-4">
          <p className={sectionTitle}>모집 정보</p>
          <div>
            <CheckGroup
              label="주요 업무 *"
              options={JOB_DUTIES_OPTIONS}
              selected={jobDuties}
              onChange={setJobDuties}
              extra={jobDutiesExtra}
              onExtraChange={setJobDutiesExtra}
              extraPlaceholder="추가 업무 직접 입력 (쉼표로 구분)"
            />
            {submitted && errors.jobDuties && (
              <p className="mt-1 text-xs text-red-400">
                주요 업무를 하나 이상 선택하거나 입력해주세요.
              </p>
            )}
          </div>
          <CheckGroup
            label="우대 조건"
            options={PREFERRED_OPTIONS}
            selected={preferred}
            onChange={setPreferred}
            extra={preferredExtra}
            onExtraChange={setPreferredExtra}
            extraPlaceholder="추가 우대 조건 직접 입력 (쉼표로 구분)"
          />
        </div>

        {/* 섹션 4: 복리후생 & 추가 안내 */}
        <div className="space-y-4">
          <p className={sectionTitle}>복리후생 & 추가 안내</p>
          <CheckGroup
            label="복리후생"
            options={BENEFITS_OPTIONS}
            selected={benefits}
            onChange={setBenefits}
          />
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              추가 안내 사항
            </label>
            <textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              rows={3}
              placeholder="지원자에게 전달하고 싶은 내용을 자유롭게 입력하세요."
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
        </div>

        {weeklyHours >= 15 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <AlertCircle size={13} />
            <span>주 15시간 이상 — 주휴수당 발생, 4대보험 가입 의무</span>
          </div>
        )}

        {submitted && !isValid && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} />
            필수 항목을 모두 입력해주세요.
          </p>
        )}
        <button
          onClick={handleGenerate}
          disabled={loading || (submitted && !isValid)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          {loading ? "초안 생성 중..." : "채용공고 초안 생성"}
        </button>
      </div>

      {/* 텍스트 초안 결과 */}
      {result && (
        <div className="rounded-xl border border-surface-300 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            텍스트 초안
          </p>
          <div className="flex gap-2 mb-4">
            {(["karrot", "alba", "saramin"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activePlatform === p
                    ? "bg-brand-500 text-white"
                    : "bg-surface-100 text-gray-600 hover:bg-surface-200"
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed bg-surface-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {result.platforms[activePlatform] || "내용이 없습니다."}
          </pre>
          <WageCard sim={result.wage_simulation} />
          <p className="mt-3 text-xs text-gray-400">
            생성일: {result.calculated_at} · 본 내용은 참고용이며 실제 게시 전
            확인을 권장합니다.
          </p>
        </div>
      )}

      {/* 디자인 PDF 섹션 */}
      <div className="rounded-xl border border-surface-300 bg-white p-5">
        <div className="flex items-center gap-2 mb-1">
          <ImageIcon size={16} className="text-brand-500" />
          <p className="text-sm font-semibold text-gray-700">
            디자인 채용공고 PDF
          </p>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Claude Haiku가 HTML로 예쁜 채용공고를 디자인하고 PDF로 저장합니다. 위
          폼에 입력한 내용이 그대로 반영됩니다.
        </p>

        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1.5">
            디자인 스타일 프롬프트
          </label>
          <textarea
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            rows={2}
            placeholder="예: 따뜻한 브라운 계열, 미니멀한 디자인&#10;예: 밝고 트렌디한 핑크 톤, 이모지 활용&#10;비워두면 기본 카페 스타일로 생성됩니다."
            className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </div>

        <button
          onClick={handleVisualGenerate}
          disabled={loadingVisual || (submitted && !isValid)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingVisual ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ImageIcon size={15} />
          )}
          {loadingVisual ? "디자인 생성 중..." : "디자인 PDF 생성"}
        </button>

        {/* 미리보기 + 다운로드 */}
        {visualResult && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">미리보기</p>
              <div className="flex gap-2">
                <button
                  onClick={handleVisualGenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 text-xs text-gray-600 hover:bg-surface-100 transition-colors"
                >
                  <RefreshCw size={12} />
                  재생성
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors"
                >
                  <Download size={12} />
                  PDF 다운로드
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-surface-300 overflow-hidden bg-white">
              <iframe
                srcDoc={visualResult.html}
                className="w-full"
                style={{ height: "600px", border: "none" }}
                sandbox="allow-same-origin"
                title="채용공고 미리보기"
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              생성일: {visualResult.calculated_at} · 미리보기와 PDF 출력 결과가
              다를 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 탭 3: 근로계약서 작성 ─────────────────────────────────────────────────────

const LaborContractTab = () => {
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [hourlyWage, setHourlyWage] = useState(10320);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaborContractResult | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch("/hire/labor-contract", {
        method: "POST",
        body: JSON.stringify({
          weekly_hours: weeklyHours,
          hourly_wage: hourlyWage,
        }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.draft) {
      navigator.clipboard.writeText(result.draft);
    }
  };

  return (
    <div className="space-y-5">
      {/* 입력 폼 */}
      <div className="rounded-xl border border-surface-300 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-1">
          근로계약서 조건 입력
        </p>
        <p className="text-xs text-gray-400 mb-4">
          고용노동부 표준 근로계약서 양식을 기반으로 초안을 생성합니다. 빈칸([
          ])은 직접 채워야 하는 항목입니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              주 근무시간
            </label>
            <div className="relative">
              <input
                type="number"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                min={1}
                max={52}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                시간
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">시급</label>
            <div className="relative">
              <input
                type="number"
                value={hourlyWage}
                onChange={(e) => setHourlyWage(Number(e.target.value))}
                min={10320}
                step={100}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                원
              </span>
            </div>
          </div>
        </div>

        {weeklyHours >= 15 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <AlertCircle size={13} />
            <span>주 15시간 이상 — 4대보험 가입 의무 / 주휴수당 발생</span>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          {loading ? "초안 생성 중..." : "근로계약서 초안 생성"}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="rounded-xl border border-surface-300 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">
              근로계약서 초안
            </p>
            <button
              onClick={handleCopy}
              className="text-xs text-brand-500 hover:text-brand-700 transition-colors"
            >
              복사
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed bg-surface-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
            {result.draft}
          </pre>
          <WageCard sim={result.wage_simulation} />
          <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>
              본 내용은 참고용이며 실제 계약 전 노무사 또는 전문가 확인을
              권장합니다.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "status", label: "채용 현황", icon: TrendingUp },
  { id: "job-posting", label: "채용공고 작성", icon: Users },
  { id: "labor-contract", label: "근로계약서 작성", icon: FileText },
];

export default function HirePage() {
  const [activeTab, setActiveTab] = useState<Tab>("status");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center">
          <Users size={18} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">채용 공고</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            알바 채용공고 초안 생성, 근로계약서 작성, 인건비 계산
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-white text-brand-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "status" && <StatusTab />}
      {activeTab === "job-posting" && <JobPostingTab />}
      {activeTab === "labor-contract" && <LaborContractTab />}
    </div>
  );
}
