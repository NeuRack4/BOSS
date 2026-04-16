"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import InsightMarkdown from "@/components/insights/InsightMarkdown";
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
  Save,
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
  active_job_postings: number;
  hired_count: number;
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

type SavedContract = {
  id: string;
  created_at: string;
  metadata: {
    title: string;
    draft: string;
    inputs: Record<string, unknown>;
    wage_simulation: WageSim;
  };
};

type VisualResult = {
  html: string;
  calculated_at: string;
};

type SavedJobPosting = {
  id: string;
  created_at: string;
  metadata: {
    title: string;
    platforms: { karrot: string; alba: string; saramin: string };
    html: string;
    wage_simulation: WageSim;
    inputs: Record<string, unknown>;
    calculated_at: string;
    posting_start?: string;
    posting_end?: string;
  };
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
    active_job_postings,
    hired_count,
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
          <p className="text-xs text-gray-400 mb-1">진행 중인 공고</p>
          <p className="font-semibold text-gray-800">
            {active_job_postings > 0 ? `${active_job_postings}건` : "없음"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {active_job_postings > 0
              ? "공고 기간 진행 중"
              : "채용공고 작성에서 등록"}
          </p>
        </div>
        <div className="rounded-xl border border-surface-300 bg-white p-4">
          <p className="text-xs text-gray-400 mb-1">채용된 직원</p>
          <p className="font-semibold text-gray-800">
            {hired_count > 0 ? `${hired_count}명` : "없음 (1인 운영)"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            근로계약서 {hired_count}건 · 최저시급{" "}
            {min_wage_2025.toLocaleString()}원
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

const TagInput = ({
  label,
  tags,
  onChange,
  placeholder,
  required,
  error,
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
}) => {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-2">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="text-brand-300 hover:text-brand-600 leading-none ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "입력 후 Enter"}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 ${
            error ? "border-red-400 focus:ring-red-400" : "border-surface-300"
          }`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 disabled:opacity-40 transition-colors"
        >
          추가
        </button>
      </div>
    </div>
  );
};

// ── 탭 2: 채용공고 작성 ────────────────────────────────────────────────────────

const WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WORK_PERIOD_OPTIONS = ["단기 (1~3개월)", "장기 (6개월 이상)", "협의"];

const JobPostingTab = () => {
  // 기본 근무 조건
  const [neighborhood, setNeighborhood] = useState("마포구");
  const [wageMode, setWageMode] = useState<"hourly" | "annual">("hourly");
  const [hourlyWage, setHourlyWage] = useState(10320);
  const [annualSalary, setAnnualSalary] = useState(30_000_000);
  // 카페 정보
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  // 근무 일정
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  // 주 근무시간 자동 계산 (출퇴근 시간 × 근무 요일 수)
  const dailyHours = (() => {
    if (!workStart || !workEnd) return 0;
    const [sh, sm] = workStart.split(":").map(Number);
    const [eh, em] = workEnd.split(":").map(Number);
    const totalMin = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, totalMin / 60);
  })();
  const weeklyHours = Math.round(dailyHours * workDays.length * 10) / 10;

  // ── 인건비 시뮬레이션 (실시간) ─────────────────────────────────────────────
  const jpWageSim = (() => {
    if (wageMode === "annual") {
      if (annualSalary <= 0) return null;
      const monthlyGross = Math.round(annualSalary / 12);
      return {
        monthlyGross,
        isAnnual: true as const,
        fourInsuranceRequired: true,
      };
    }
    if (weeklyHours <= 0 || hourlyWage <= 0) return null;
    const weeklyHolidayPay =
      weeklyHours >= 15 ? Math.round(hourlyWage * (weeklyHours / 5)) : 0;
    const monthlyBase = Math.round(hourlyWage * weeklyHours * 4.345);
    const monthlyHoliday = Math.round(weeklyHolidayPay * 4.345);
    return {
      weeklyHolidayPay,
      monthlyBase,
      monthlyHoliday,
      monthlyGross: monthlyBase + monthlyHoliday,
      fourInsuranceRequired: weeklyHours >= 15,
      isAnnual: false as const,
    };
  })();
  const jpMonthlyGross = jpWageSim?.monthlyGross ?? 0;
  const jpTaxCalc = jpMonthlyGross > 0 ? calcDeductions(jpMonthlyGross) : null;

  const [workPeriod, setWorkPeriod] = useState("");
  const [headcount, setHeadcount] = useState(1);
  // 모집 정보
  const [jobDuties, setJobDuties] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  // 복리후생 & 추가
  const [benefits, setBenefits] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState("");
  // 지원(공고) 기간
  const [postingStart, setPostingStart] = useState("");
  const [postingEnd, setPostingEnd] = useState("");
  // 텍스트 결과
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobPostingResult | null>(null);
  const [activePlatform, setActivePlatform] =
    useState<keyof JobPostingResult["platforms"]>("karrot");
  // 디자인 PDF 결과
  const [stylePrompt, setStylePrompt] = useState("");
  const [loadingVisual, setLoadingVisual] = useState(false);
  const [visualResult, setVisualResult] = useState<VisualResult | null>(null);
  // 저장/불러오기
  const [savedList, setSavedList] = useState<SavedJobPosting[]>([]);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // DB에서 카페 정보 프리필 + 저장 목록 로드
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

    apiFetch("/hire/job-posting/saved")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedList(data);
      })
      .catch(() => {});
  }, []);

  const buildDuties = () => jobDuties;
  const buildPreferred = () => preferred;

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
    wage_mode: wageMode,
    hourly_wage: hourlyWage,
    annual_salary: annualSalary,
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
    posting_start: postingStart,
    posting_end: postingEnd,
  });

  const buildInputsSnapshot = () => ({
    neighborhood,
    weekly_hours: weeklyHours,
    wage_mode: wageMode,
    hourly_wage: hourlyWage,
    annual_salary: annualSalary,
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
    posting_start: postingStart,
    posting_end: postingEnd,
  });

  const handleSave = async () => {
    if (!result || !saveTitle.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/hire/job-posting/save", {
        method: "POST",
        body: JSON.stringify({
          title: saveTitle.trim(),
          platforms: result.platforms,
          html: visualResult?.html ?? "",
          wage_simulation: result.wage_simulation,
          inputs: buildInputsSnapshot(),
          calculated_at: result.calculated_at,
          posting_start: postingStart,
          posting_end: postingEnd,
        }),
      });
      const saved: SavedJobPosting = await res.json();
      setSavedList((prev) => [saved, ...prev]);
      setSaveTitle("");
      setShowSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLoad = (saved: SavedJobPosting) => {
    const inp = saved.metadata.inputs as any;
    setNeighborhood(inp.neighborhood ?? "마포구");
    setWageMode(inp.wage_mode ?? "hourly");
    setHourlyWage(inp.hourly_wage ?? 10320);
    setAnnualSalary(inp.annual_salary ?? 30_000_000);
    setBusinessName(inp.business_name ?? "");
    setAddress(inp.address ?? "");
    setWorkDays(inp.work_days ?? []);
    setWorkStart(inp.work_start ?? "");
    setWorkEnd(inp.work_end ?? "");
    setWorkPeriod(inp.work_period ?? "");
    setHeadcount(inp.headcount ?? 1);
    setJobDuties(inp.job_duties ?? []);
    setPreferred(inp.preferred ?? []);
    setBenefits(inp.benefits ?? []);
    setExtraNote(inp.extra_note ?? "");
    setPostingStart(inp.posting_start ?? "");
    setPostingEnd(inp.posting_end ?? "");
    setResult({
      draft_type: "job_posting",
      platforms: saved.metadata.platforms,
      wage_simulation: saved.metadata.wage_simulation,
      calculated_at:
        saved.metadata.calculated_at || saved.created_at.slice(0, 10),
    });
    if (saved.metadata.html) {
      setVisualResult({
        html: saved.metadata.html,
        calculated_at:
          saved.metadata.calculated_at || saved.created_at.slice(0, 10),
      });
    } else {
      setVisualResult(null);
    }
    setShowSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/hire/job-posting/saved/${id}`, { method: "DELETE" });
    setSavedList((prev) => prev.filter((s) => s.id !== id));
  };

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
      {/* 저장된 채용공고 목록 */}
      {savedList.length > 0 && (
        <div className="rounded-xl border border-surface-300 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSaved((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-surface-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText size={15} className="text-brand-500" />
              저장된 채용공고 ({savedList.length}개)
            </span>
            <ChevronRight
              size={15}
              className={`text-gray-400 transition-transform ${showSaved ? "rotate-90" : ""}`}
            />
          </button>
          {showSaved && (
            <div className="border-t border-surface-300 divide-y divide-surface-200">
              {savedList.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-surface-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">
                        {s.metadata.title}
                      </p>
                      {s.metadata.html && (
                        <span className="text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-medium">
                          디자인 포함
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      저장일 {s.created_at.slice(0, 10)}
                      {s.metadata.posting_start || s.metadata.posting_end ? (
                        <span className="ml-2">
                          · 공고 기간 {s.metadata.posting_start || "—"} ~{" "}
                          {s.metadata.posting_end || "—"}
                        </span>
                      ) : (
                        <span className="ml-2 text-brand-500">· 상시 채용</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(s)}
                      className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors"
                    >
                      불러오기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

          {/* 시급제 / 연봉제 토글 */}
          <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit mb-4">
            {(["hourly", "annual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWageMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  wageMode === mode
                    ? "bg-white text-brand-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode === "hourly" ? "시급제" : "연봉제"}
              </button>
            ))}
          </div>

          {/* 1행: 시급/연봉 + 주 근무시간 + 출근 시간 + 퇴근 시간 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {/* 시급제 */}
            {wageMode === "hourly" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">
                  시급
                </label>
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
            )}

            {/* 연봉제 */}
            {wageMode === "annual" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">
                  세전 연봉
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={annualSalary}
                    onChange={(e) => setAnnualSalary(Number(e.target.value))}
                    min={0}
                    step={1_000_000}
                    className={inputCls()}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    원
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  월 환산: {Math.round(annualSalary / 12).toLocaleString()}원
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                주 근무시간
                <span className="ml-1 text-gray-400 font-normal">
                  (자동 계산)
                </span>
              </label>
              <div className="flex items-center h-[38px] rounded-lg border border-surface-200 bg-surface-50 px-3 text-sm text-gray-700">
                {weeklyHours > 0 ? (
                  <span className="font-semibold text-brand-600">
                    {weeklyHours}시간
                  </span>
                ) : (
                  <span className="text-gray-400">
                    출퇴근 시간 입력 후 표시
                  </span>
                )}
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

          {/* 지원(공고) 기간 */}
          <div className="mt-4">
            <label className="text-xs text-gray-500 block mb-2">
              지원 기간
              <span className="ml-1.5 text-gray-400 font-normal">
                (마감일 D-3·D-1·당일 알림)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={postingStart}
                onChange={(e) => setPostingStart(e.target.value)}
                className={inputCls()}
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="date"
                value={postingEnd}
                min={postingStart || undefined}
                onChange={(e) => setPostingEnd(e.target.value)}
                className={inputCls()}
              />
            </div>
          </div>
        </div>

        {/* 인건비 시뮬레이션 */}
        <div>
          {jpWageSim ? (
            <div className="rounded-xl border border-surface-300 bg-surface-50 p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                인건비 시뮬레이션
              </p>
              {!jpWageSim.isAnnual && (
                <>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>월 기본급</span>
                    <span>
                      {hourlyWage.toLocaleString()}원 × {weeklyHours}h × 4.345 ={" "}
                      <strong>
                        {jpWageSim.monthlyBase!.toLocaleString()}원
                      </strong>
                    </span>
                  </div>
                  {jpWageSim.fourInsuranceRequired && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>주휴수당 (월)</span>
                      <span>
                        {hourlyWage.toLocaleString()}원 ×{" "}
                        {(weeklyHours / 5).toFixed(1)}h × 4.345 ={" "}
                        <strong>
                          {jpWageSim.monthlyHoliday!.toLocaleString()}원
                        </strong>
                      </span>
                    </div>
                  )}
                </>
              )}
              {jpWageSim.isAnnual && (
                <div className="flex justify-between text-xs text-gray-600">
                  <span>월 환산 (세전 연봉 ÷ 12)</span>
                  <strong>{jpWageSim.monthlyGross.toLocaleString()}원</strong>
                </div>
              )}
              <div className="border-t border-surface-300 pt-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">
                  세전 월 총액
                </span>
                <span className="text-base font-bold text-brand-600">
                  {jpWageSim.monthlyGross.toLocaleString()}원
                </span>
              </div>
              {jpWageSim.fourInsuranceRequired && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle size={12} />
                  <span>
                    주 15시간 이상 — 4대보험 가입 의무 / 주휴수당 발생
                  </span>
                </div>
              )}

              {/* 세전/세후 공제 내역 */}
              {jpTaxCalc && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mt-2">
                  <p className="text-xs font-semibold text-blue-700 mb-3">
                    세전 / 세후 예상 계산
                    <span className="font-normal text-blue-500 ml-1">
                      (참고용 — 간이세액표 근사, 공제대상가족 1인 기준)
                    </span>
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-700 font-medium border-b border-blue-200 pb-2 mb-2">
                      <span>세전 월 급여</span>
                      <span>{jpMonthlyGross.toLocaleString()}원</span>
                    </div>
                    {[
                      { label: "국민연금 (4.5%)", val: jpTaxCalc.pension },
                      { label: "건강보험 (3.545%)", val: jpTaxCalc.health },
                      {
                        label: "장기요양 (건강보험료×12.95%)",
                        val: jpTaxCalc.longterm,
                      },
                      { label: "고용보험 (0.9%)", val: jpTaxCalc.employ },
                      {
                        label: "근로소득세 (간이세액 근사)",
                        val: jpTaxCalc.incomeTax,
                      },
                      {
                        label: "지방소득세 (소득세×10%)",
                        val: jpTaxCalc.localTax,
                      },
                    ].map(({ label, val }) => (
                      <div
                        key={label}
                        className="flex justify-between text-gray-500"
                      >
                        <span>{label}</span>
                        <span className="text-red-500">
                          −{val.toLocaleString()}원
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-gray-600 border-t border-blue-200 pt-2 mt-2">
                      <span>총 공제액</span>
                      <span className="text-red-600 font-medium">
                        −{jpTaxCalc.total.toLocaleString()}원
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-blue-300 pt-2 mt-1">
                      <span className="font-semibold text-gray-700">
                        세후 실수령액 (월)
                      </span>
                      <span className="text-base font-bold text-blue-700">
                        {(jpMonthlyGross - jpTaxCalc.total).toLocaleString()}원
                      </span>
                    </div>
                    {wageMode === "annual" && (
                      <div className="flex justify-between text-xs text-blue-600 mt-0.5">
                        <span>연간 실수령 예상</span>
                        <span>
                          {(
                            (jpMonthlyGross - jpTaxCalc.total) *
                            12
                          ).toLocaleString()}
                          원
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-surface-400 bg-surface-50 p-3 text-xs text-gray-400 text-center">
              근무 요일·출퇴근 시간을 입력하면 인건비가 자동 산정됩니다.
            </div>
          )}
        </div>

        {/* 섹션 3: 모집 정보 */}
        <div className="space-y-4">
          <p className={sectionTitle}>모집 정보</p>
          <div>
            <TagInput
              label="주요 업무"
              tags={jobDuties}
              onChange={setJobDuties}
              placeholder="예: 카운터 응대, 음료 제조 — 입력 후 Enter"
              required
              error={submitted && errors.jobDuties}
            />
            {submitted && errors.jobDuties && (
              <p className="mt-1 text-xs text-red-400">
                주요 업무를 하나 이상 입력해주세요.
              </p>
            )}
          </div>
          <TagInput
            label="우대 조건"
            tags={preferred}
            onChange={setPreferred}
            placeholder="예: 바리스타 자격증, 마포구 거주자 — 입력 후 Enter"
          />
        </div>

        {/* 섹션 4: 복리후생 & 추가 안내 */}
        <div className="space-y-4">
          <p className={sectionTitle}>복리후생 & 추가 안내</p>
          <TagInput
            label="복리후생"
            tags={benefits}
            onChange={setBenefits}
            placeholder="예: 음료 무료 제공, 주휴수당 포함 — 입력 후 Enter"
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
          <div className="bg-surface-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <InsightMarkdown>
              {result.platforms[activePlatform] || "내용이 없습니다."}
            </InsightMarkdown>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            생성일: {result.calculated_at} · 본 내용은 참고용이며 실제 게시 전
            확인을 권장합니다.
          </p>

          {/* 저장 */}
          <div className="mt-4 pt-4 border-t border-surface-200 flex items-center gap-2">
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="저장 이름 (예: 홍대 알바 공고 5월)"
              className="flex-1 rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !saveTitle.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
          {visualResult && (
            <p className="mt-1.5 text-xs text-brand-500 flex items-center gap-1">
              <ImageIcon size={11} />
              디자인 HTML도 함께 저장됩니다.
            </p>
          )}
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
          HTML로 예쁜 채용공고를 디자인하고 PDF로 저장합니다. 위 폼에 입력한
          내용이 그대로 반영됩니다.
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

// ── 세전/세후 계산 헬퍼 ──────────────────────────────────────────────────────

const _estimateIncomeTax = (monthlyGross: number): number => {
  const annual = monthlyGross * 12;
  let deducted: number;
  if (annual <= 5_000_000) deducted = annual * 0.7;
  else if (annual <= 15_000_000)
    deducted = 3_500_000 + (annual - 5_000_000) * 0.4;
  else if (annual <= 45_000_000)
    deducted = 7_500_000 + (annual - 15_000_000) * 0.15;
  else if (annual <= 100_000_000)
    deducted = 12_000_000 + (annual - 45_000_000) * 0.05;
  else deducted = 14_750_000 + (annual - 100_000_000) * 0.02;
  const taxBase = Math.max(0, annual - deducted - 1_500_000);
  let tax: number;
  if (taxBase <= 12_000_000) tax = taxBase * 0.06;
  else if (taxBase <= 46_000_000) tax = 720_000 + (taxBase - 12_000_000) * 0.15;
  else if (taxBase <= 88_000_000)
    tax = 5_820_000 + (taxBase - 46_000_000) * 0.24;
  else if (taxBase <= 150_000_000)
    tax = 15_900_000 + (taxBase - 88_000_000) * 0.35;
  else tax = 37_600_000 + (taxBase - 150_000_000) * 0.38;
  return Math.max(0, Math.round(tax / 12));
};

const calcDeductions = (monthlyGross: number) => {
  const pension = Math.round(monthlyGross * 0.045);
  const health = Math.round(monthlyGross * 0.03545);
  const longterm = Math.round(health * 0.1295);
  const employ = Math.round(monthlyGross * 0.009);
  const incomeTax = _estimateIncomeTax(monthlyGross);
  const localTax = Math.round(incomeTax * 0.1);
  const total = pension + health + longterm + employ + incomeTax + localTax;
  return { pension, health, longterm, employ, incomeTax, localTax, total };
};

// ── 근로계약서 편집 뷰어 ──────────────────────────────────────────────────────

const _BLANK_RE = /\[[ \t]*(?:\d+\.[ \t]*)?\]/g;

const _InlineMd = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
};

const DraftEditor = ({
  draft,
  onFilled,
}: {
  draft: string;
  onFilled: (filled: string) => void;
}) => {
  const blankCount = useMemo(
    () => (draft.match(_BLANK_RE) || []).length,
    [draft],
  );

  const [fills, setFills] = useState<string[]>(() =>
    Array(blankCount).fill(""),
  );

  useEffect(() => {
    setFills(Array(blankCount).fill(""));
  }, [draft, blankCount]);

  useEffect(() => {
    let idx = 0;
    const filled = draft.replace(_BLANK_RE, () => fills[idx++] || "______");
    onFilled(filled);
  }, [fills, draft, onFilled]);

  // blank counter — reset per render (sync, deterministic)
  let bc = 0;

  const renderSegment = (text: string) => {
    const segs = text.split(_BLANK_RE);
    if (segs.length === 1) return <_InlineMd text={text} />;
    return (
      <>
        {segs.map((seg, i) => {
          if (i === segs.length - 1) return <_InlineMd key={i} text={seg} />;
          const bIdx = bc++;
          return (
            <span key={i}>
              <_InlineMd text={seg} />
              <input
                type="text"
                value={fills[bIdx] ?? ""}
                onChange={(e) =>
                  setFills((prev) => {
                    const next = [...prev];
                    next[bIdx] = e.target.value;
                    return next;
                  })
                }
                placeholder="입력"
                size={Math.max(8, (fills[bIdx]?.length ?? 0) + 4)}
                className="inline-block border-b-2 border-brand-400 bg-yellow-50 px-1 mx-0.5 text-sm focus:outline-none focus:border-brand-600 focus:bg-yellow-100"
              />
            </span>
          );
        })}
      </>
    );
  };

  // ── 라인 → 블록 파싱 (테이블 묶음) ─────────────────────────────────────────
  const lines = draft.split("\n");
  const blocks: Array<
    { type: "line"; text: string } | { type: "table"; rows: string[][] }
  > = [];
  let li = 0;
  while (li < lines.length) {
    const t = lines[li].trim();
    if (t.startsWith("```")) {
      li++; // 여는 펜스 건너뜀
      while (li < lines.length && !lines[li].trim().startsWith("```")) {
        blocks.push({ type: "line", text: lines[li] });
        li++;
      }
      if (li < lines.length) li++; // 닫는 펜스 건너뜀
    } else if (t.startsWith("|") && t.endsWith("|")) {
      const tableLines: string[] = [];
      while (
        li < lines.length &&
        lines[li].trim().startsWith("|") &&
        lines[li].trim().endsWith("|")
      ) {
        tableLines.push(lines[li]);
        li++;
      }
      const rows: string[][] = [];
      for (const tl of tableLines) {
        const cells = tl
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        // 구분선 행 건너뜀 (예: |---|---|)
        if (!cells.every((c) => /^[-: ]+$/.test(c))) rows.push(cells);
      }
      blocks.push({ type: "table", rows });
    } else {
      blocks.push({ type: "line", text: lines[li] });
      li++;
    }
  }

  const renderLine = (line: string, key: number) => {
    if (line.startsWith("# "))
      return (
        <h1 key={key} className="text-base font-bold text-center mt-4 mb-2">
          {renderSegment(line.slice(2))}
        </h1>
      );
    if (line.startsWith("## "))
      return (
        <h2
          key={key}
          className="text-sm font-bold mt-4 mb-1 border-b border-gray-200 pb-1 text-gray-900"
        >
          {renderSegment(line.slice(3))}
        </h2>
      );
    if (line.startsWith("### "))
      return (
        <h3 key={key} className="text-sm font-semibold mt-3 mb-1 text-gray-800">
          {renderSegment(line.slice(4))}
        </h3>
      );
    if (/^---+$/.test(line.trim()))
      return <hr key={key} className="border-gray-200 my-3" />;
    if (/^[-*] /.test(line))
      return (
        <div key={key} className="flex gap-1.5 ml-4 my-0.5">
          <span className="text-gray-400 shrink-0">•</span>
          <span>{renderSegment(line.slice(2))}</span>
        </div>
      );
    if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      return (
        <div key={key} className="flex gap-1.5 ml-4 my-0.5">
          <span className="text-gray-500 shrink-0 w-5">{num}.</span>
          <span>{renderSegment(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    }
    if (line.trim() === "") return <div key={key} className="h-2" />;
    return (
      <div key={key} className="my-0.5">
        {renderSegment(line)}
      </div>
    );
  };

  return (
    <div className="text-sm text-gray-700 leading-relaxed">
      {blocks.map((block, bi) => {
        if (block.type === "table") {
          const [header, ...body] = block.rows;
          return (
            <div key={bi} className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-xs">
                {header && (
                  <thead>
                    <tr>
                      {header.map((cell, ci) => (
                        <th
                          key={ci}
                          className="border border-gray-300 bg-gray-100 px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap"
                        >
                          {renderSegment(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {body.map((row, ri) => (
                    <tr
                      key={ri}
                      className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="border border-gray-300 px-3 py-1.5 text-gray-600"
                        >
                          {renderSegment(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return renderLine(block.text, bi);
      })}
    </div>
  );
};

// ── 탭 3: 근로계약서 작성 ─────────────────────────────────────────────────────

const PAY_METHOD_OPTIONS = ["계좌이체", "현금 지급"];
const WEEKLY_HOLIDAY_OPTIONS = ["일요일", "토요일", "협의"];

const LaborContractTab = () => {
  // 시급
  const [hourlyWage, setHourlyWage] = useState(10320);
  // 당사자
  const [workerName, setWorkerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [address, setAddress] = useState("");
  // 계약 기간
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [noEndDate, setNoEndDate] = useState(false);
  // 근무 조건
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [breakTime, setBreakTime] = useState(60);
  const [weeklyHoliday, setWeeklyHoliday] = useState("일요일");
  // 업무 내용
  const [jobDuties, setJobDuties] = useState<string[]>([]);
  const [jobDutyInput, setJobDutyInput] = useState("");
  // 임금 조건
  const [wageConditions, setWageConditions] = useState<string[]>([]);
  const [wageConditionInput, setWageConditionInput] = useState("");
  // 임금 지급
  const [payDate, setPayDate] = useState(25);
  const [payMethod, setPayMethod] = useState("계좌이체");
  // 임금 모드
  const [wageMode, setWageMode] = useState<"hourly" | "annual">("hourly");
  const [annualSalary, setAnnualSalary] = useState(30_000_000);

  // ── 임금 자동 산정 ──────────────────────────────────────────────────────────
  const dailyNetHours = (() => {
    if (!workStart || !workEnd) return 0;
    const [sh, sm] = workStart.split(":").map(Number);
    const [eh, em] = workEnd.split(":").map(Number);
    const totalMin = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, (totalMin - breakTime) / 60);
  })();
  const weeklyHours = Math.round(dailyNetHours * workDays.length * 100) / 100;
  const wageSim = (() => {
    if (weeklyHours <= 0 || hourlyWage <= 0) return null;
    const weeklyHolidayPay =
      weeklyHours >= 15 ? Math.round(hourlyWage * (weeklyHours / 5)) : 0;
    const monthlyBase = Math.round(hourlyWage * weeklyHours * 4.345);
    const monthlyHoliday = Math.round(weeklyHolidayPay * 4.345);
    return {
      dailyNetHours,
      weeklyHours,
      weeklyHolidayPay,
      monthlyBase,
      monthlyHoliday,
      monthlyTotal: monthlyBase + monthlyHoliday,
      fourInsuranceRequired: weeklyHours >= 15,
    };
  })();

  // ── 세전/세후 산정 ─────────────────────────────────────────────────────────
  const monthlyGross =
    wageMode === "annual"
      ? Math.round(annualSalary / 12)
      : (wageSim?.monthlyTotal ?? 0);
  const taxCalc = monthlyGross > 0 ? calcDeductions(monthlyGross) : null;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaborContractResult | null>(null);
  const [filledDraft, setFilledDraft] = useState("");
  const draftRef = useRef<HTMLDivElement>(null);

  // 저장/불러오기
  const [savedList, setSavedList] = useState<SavedContract[]>([]);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // DB 프리필 + 저장 목록 로드
  useEffect(() => {
    apiFetch("/hire/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile?.business_name)
          setBusinessName(data.profile.business_name);
        if (data?.profile?.address) setAddress(data.profile.address);
      })
      .catch(() => {});

    apiFetch("/hire/labor-contract/saved")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedList(data);
      })
      .catch(() => {});
  }, []);

  const buildInputsSnapshot = () => ({
    hourly_wage: hourlyWage,
    worker_name: workerName,
    business_name: businessName,
    employer_name: employerName,
    address,
    contract_start: contractStart,
    contract_end: noEndDate ? "" : contractEnd,
    work_days: workDays,
    work_start: workStart,
    work_end: workEnd,
    break_time: breakTime,
    weekly_holiday: weeklyHoliday,
    job_duties: jobDuties,
    wage_conditions: wageConditions,
    pay_date: payDate,
    pay_method: payMethod,
    weekly_hours: weeklyHours,
    wage_mode: wageMode,
    annual_salary: annualSalary,
  });

  const handleDownloadContractPdf = async () => {
    if (!draftRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;

    // 입력 박스를 값(또는 "-")으로 대체한 클론 생성
    const clone = draftRef.current.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll<HTMLInputElement>("input[type='text']")
      .forEach((inp) => {
        const span = document.createElement("span");
        span.textContent = inp.value.trim() || "-";
        span.style.cssText =
          "border-bottom:1px solid #555;padding:0 3px;min-width:24px;display:inline-block;";
        inp.replaceWith(span);
      });

    // 배경/overflow 제거 (PDF 클리핑 방지)
    clone.style.cssText =
      "font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;font-size:11pt;line-height:1.7;color:#1a1a1a;background:#fff;padding:0;";

    const filename = `근로계약서_${workerName || "미입력"}_${businessName || "카페"}.pdf`;
    await html2pdf()
      .set({
        margin: [15, 15, 15, 15],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(clone)
      .save();
  };

  const handleSave = async () => {
    if (!result || !saveTitle.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/hire/labor-contract/save", {
        method: "POST",
        body: JSON.stringify({
          title: saveTitle.trim(),
          draft: filledDraft || result.draft,
          inputs: buildInputsSnapshot(),
          wage_simulation: result.wage_simulation,
        }),
      });
      const saved: SavedContract = await res.json();
      setSavedList((prev) => [saved, ...prev]);
      setSaveTitle("");
      setShowSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLoad = (saved: SavedContract) => {
    const inp = saved.metadata.inputs as any;
    setHourlyWage(inp.hourly_wage ?? 10320);
    setWorkerName(inp.worker_name ?? "");
    setBusinessName(inp.business_name ?? "");
    setEmployerName(inp.employer_name ?? "");
    setAddress(inp.address ?? "");
    setContractStart(inp.contract_start ?? "");
    setContractEnd(inp.contract_end ?? "");
    setNoEndDate(!inp.contract_end);
    setWorkDays(inp.work_days ?? []);
    setWorkStart(inp.work_start ?? "");
    setWorkEnd(inp.work_end ?? "");
    setBreakTime(inp.break_time ?? 60);
    setWeeklyHoliday(inp.weekly_holiday ?? "일요일");
    setJobDuties(inp.job_duties ?? []);
    setWageConditions(inp.wage_conditions ?? []);
    setPayDate(inp.pay_date ?? 25);
    setPayMethod(inp.pay_method ?? "계좌이체");
    setWageMode(inp.wage_mode ?? "hourly");
    setAnnualSalary(inp.annual_salary ?? 30_000_000);
    setResult({
      draft_type: "labor_contract",
      draft: saved.metadata.draft,
      wage_simulation: saved.metadata.wage_simulation,
      calculated_at: saved.created_at.slice(0, 10),
    });
    setShowSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/hire/labor-contract/saved/${id}`, { method: "DELETE" });
    setSavedList((prev) => prev.filter((s) => s.id !== id));
  };

  const addDuty = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !jobDuties.includes(trimmed)) {
      setJobDuties([...jobDuties, trimmed]);
    }
    setJobDutyInput("");
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch("/hire/labor-contract", {
        method: "POST",
        body: JSON.stringify({
          weekly_hours: weeklyHours,
          hourly_wage: hourlyWage,
          worker_name: workerName,
          business_name: businessName,
          employer_name: employerName,
          address,
          contract_start: contractStart,
          contract_end: noEndDate ? "" : contractEnd,
          work_days: workDays,
          work_start: workStart,
          work_end: workEnd,
          break_time: breakTime,
          weekly_holiday: weeklyHoliday,
          job_duties: jobDuties,
          wage_conditions: wageConditions,
          pay_date: payDate,
          pay_method: payMethod,
          wage_mode: wageMode,
          annual_salary: annualSalary,
        }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = filledDraft || result?.draft;
    if (text) navigator.clipboard.writeText(text);
  };

  const inputCls =
    "w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";
  const sectionTitle =
    "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-1";

  return (
    <div className="space-y-5">
      {/* 저장된 계약서 목록 */}
      {savedList.length > 0 && (
        <div className="rounded-xl border border-surface-300 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSaved((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-surface-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText size={15} className="text-brand-500" />
              저장된 계약서 ({savedList.length}개)
            </span>
            <ChevronRight
              size={15}
              className={`text-gray-400 transition-transform ${showSaved ? "rotate-90" : ""}`}
            />
          </button>
          {showSaved && (
            <div className="border-t border-surface-300 divide-y divide-surface-200">
              {savedList.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-surface-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {s.metadata.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(s)}
                      className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors"
                    >
                      불러오기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-surface-300 bg-white p-5 space-y-6">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            근로계약서 조건 입력
          </p>
          <p className="text-xs text-gray-400">
            근로기준법 제17조 필수 항목을 기반으로 초안을 생성합니다.
            빈칸([&nbsp;])은 직접 채워야 하는 항목입니다.
          </p>
        </div>

        {/* 섹션 1: 당사자 */}
        <div>
          <p className={sectionTitle}>당사자 정보</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                사업장명
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="예: 연남동 커피로스터스"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                사용자(고용주)명
              </label>
              <input
                type="text"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                placeholder="대표자 이름"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                근로자명
              </label>
              <input
                type="text"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="채용할 직원 이름"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                근무 장소
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울 마포구 연남로 123"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* 섹션 2: 계약 기간 */}
        <div>
          <p className={sectionTitle}>계약 기간</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                시작일
              </label>
              <input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                종료일
              </label>
              <input
                type="date"
                value={contractEnd}
                onChange={(e) => setContractEnd(e.target.value)}
                disabled={noEndDate}
                className={`${inputCls} disabled:opacity-40`}
              />
              <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noEndDate}
                  onChange={(e) => setNoEndDate(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-gray-500">
                  기간의 정함이 없음
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 섹션 3: 근무 조건 */}
        <div>
          <p className={sectionTitle}>근무 조건</p>
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-2">
              근무 요일
            </label>
            <div className="flex gap-2">
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
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                출근 시간
              </label>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className={inputCls}
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
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                휴게시간
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={breakTime}
                  onChange={(e) => setBreakTime(Number(e.target.value))}
                  min={0}
                  step={30}
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  분
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                주휴일
              </label>
              <select
                value={weeklyHoliday}
                onChange={(e) => setWeeklyHoliday(e.target.value)}
                className={inputCls}
              >
                {WEEKLY_HOLIDAY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 섹션 4: 업무 내용 */}
        <div>
          <p className={sectionTitle}>업무 내용</p>
          <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
            {jobDuties.map((duty) => (
              <span
                key={duty}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs text-brand-700"
              >
                {duty}
                <button
                  type="button"
                  onClick={() =>
                    setJobDuties(jobDuties.filter((d) => d !== duty))
                  }
                  className="hover:text-brand-900 leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={jobDutyInput}
            onChange={(e) => setJobDutyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDuty(jobDutyInput);
              }
            }}
            placeholder="업무 입력 후 Enter — 예: 에스프레소 음료 제조"
            className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <p className="mt-1 text-xs text-gray-400">
            Enter로 항목 추가, × 버튼으로 삭제
          </p>
        </div>

        {/* 섹션 5: 임금 */}
        <div>
          <p className={sectionTitle}>임금</p>

          {/* 시급제 / 연봉제 토글 */}
          <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit mb-4">
            {(["hourly", "annual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWageMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  wageMode === mode
                    ? "bg-white text-brand-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode === "hourly" ? "시급제" : "연봉제"}
              </button>
            ))}
          </div>

          {/* 시급제 UI */}
          {wageMode === "hourly" && (
            <>
              <div className="w-40 mb-4">
                <label className="text-xs text-gray-500 block mb-1.5">
                  시급
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={hourlyWage}
                    onChange={(e) => setHourlyWage(Number(e.target.value))}
                    min={10320}
                    step={100}
                    className={inputCls}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    원
                  </span>
                </div>
              </div>

              {wageSim ? (
                <div className="rounded-xl border border-surface-300 bg-surface-50 p-4 space-y-2 text-sm mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    자동 산정 내역
                  </p>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>일 순근로시간</span>
                    <span>
                      {workStart}~{workEnd} − 휴게 {breakTime}분 ={" "}
                      <strong className="text-gray-700">
                        {wageSim.dailyNetHours.toFixed(1)}시간
                      </strong>
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>주 총 근로시간</span>
                    <span>
                      {workDays.length}일 × {wageSim.dailyNetHours.toFixed(1)}
                      시간 ={" "}
                      <strong className="text-gray-700">
                        {wageSim.weeklyHours}시간
                      </strong>
                    </span>
                  </div>
                  <div className="border-t border-surface-300 pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>월 기본급</span>
                      <span>
                        {hourlyWage.toLocaleString()}원 × {wageSim.weeklyHours}h
                        × 4.345 ={" "}
                        <strong>
                          {wageSim.monthlyBase.toLocaleString()}원
                        </strong>
                      </span>
                    </div>
                    {wageSim.fourInsuranceRequired && (
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>주휴수당 (월)</span>
                        <span>
                          {hourlyWage.toLocaleString()}원 ×{" "}
                          {(wageSim.weeklyHours / 5).toFixed(1)}h × 4.345 ={" "}
                          <strong>
                            {wageSim.monthlyHoliday.toLocaleString()}원
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-surface-300 pt-2 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">
                      세전 월 총액
                    </span>
                    <span className="text-base font-bold text-brand-600">
                      {wageSim.monthlyTotal.toLocaleString()}원
                    </span>
                  </div>
                  {wageSim.fourInsuranceRequired && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      <AlertCircle size={12} />
                      <span>
                        주 15시간 이상 — 4대보험 가입 의무 / 주휴수당 발생
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface-400 bg-surface-50 p-3 text-xs text-gray-400 text-center mb-4">
                  근무 요일·출퇴근 시간을 입력하면 임금이 자동 산정됩니다.
                </div>
              )}
            </>
          )}

          {/* 연봉제 UI */}
          {wageMode === "annual" && (
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1.5">
                세전 연봉
              </label>
              <div className="relative w-56">
                <input
                  type="number"
                  value={annualSalary}
                  onChange={(e) => setAnnualSalary(Number(e.target.value))}
                  min={0}
                  step={1_000_000}
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  원
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                세전 월 환산: {monthlyGross.toLocaleString()}원 (연봉 ÷ 12)
              </p>
            </div>
          )}

          {/* 세전/세후 공제 내역 */}
          {taxCalc && monthlyGross > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-4">
              <p className="text-xs font-semibold text-blue-700 mb-3">
                세전 / 세후 예상 계산
                <span className="font-normal text-blue-500 ml-1">
                  (참고용 — 간이세액표 근사, 공제대상가족 1인 기준)
                </span>
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-700 font-medium border-b border-blue-200 pb-2 mb-2">
                  <span>세전 월 급여</span>
                  <span>{monthlyGross.toLocaleString()}원</span>
                </div>
                {[
                  { label: "국민연금 (4.5%)", val: taxCalc.pension },
                  { label: "건강보험 (3.545%)", val: taxCalc.health },
                  {
                    label: "장기요양 (건강보험료×12.95%)",
                    val: taxCalc.longterm,
                  },
                  { label: "고용보험 (0.9%)", val: taxCalc.employ },
                  {
                    label: "근로소득세 (간이세액 근사)",
                    val: taxCalc.incomeTax,
                  },
                  { label: "지방소득세 (소득세×10%)", val: taxCalc.localTax },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    className="flex justify-between text-gray-500"
                  >
                    <span>{label}</span>
                    <span className="text-red-500">
                      −{val.toLocaleString()}원
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-gray-600 border-t border-blue-200 pt-2 mt-2">
                  <span>총 공제액</span>
                  <span className="text-red-600 font-medium">
                    −{taxCalc.total.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-blue-300 pt-2 mt-1">
                  <span className="font-semibold text-gray-700">
                    세후 실수령액 (월)
                  </span>
                  <span className="text-base font-bold text-blue-700">
                    {(monthlyGross - taxCalc.total).toLocaleString()}원
                  </span>
                </div>
                {wageMode === "annual" && (
                  <div className="flex justify-between text-xs text-blue-600 mt-0.5">
                    <span>연간 실수령 예상</span>
                    <span>
                      {((monthlyGross - taxCalc.total) * 12).toLocaleString()}원
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 임금에 포함된 조건 */}
          <div className="mt-4">
            <label className="text-xs text-gray-500 block mb-2">
              임금에 포함된 조건
            </label>
            <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
              {wageConditions.map((cond) => (
                <span
                  key={cond}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-700"
                >
                  {cond}
                  <button
                    type="button"
                    onClick={() =>
                      setWageConditions(
                        wageConditions.filter((c) => c !== cond),
                      )
                    }
                    className="hover:text-green-900 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={wageConditionInput}
              onChange={(e) => setWageConditionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = wageConditionInput.trim();
                  if (v && !wageConditions.includes(v)) {
                    setWageConditions([...wageConditions, v]);
                  }
                  setWageConditionInput("");
                }
              }}
              placeholder="예: 주휴수당 포함 / 4대보험 사업주 부담 / 식대 별도 지급"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <p className="mt-1 text-xs text-gray-400">
              Enter로 항목 추가, × 버튼으로 삭제
            </p>
          </div>

          {/* 지급일 / 지급방법 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                급여 지급일
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={payDate}
                  onChange={(e) => setPayDate(Number(e.target.value))}
                  min={1}
                  max={31}
                  className={inputCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  일
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">
                지급 방법
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className={inputCls}
              >
                {PAY_METHOD_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60 transition-colors"
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
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopy}
                className="text-xs text-brand-500 hover:text-brand-700 transition-colors"
              >
                복사
              </button>
              <button
                onClick={handleDownloadContractPdf}
                className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 transition-colors"
              >
                <Download size={12} />
                A4 PDF
              </button>
            </div>
          </div>
          <div className="bg-surface-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
            <div ref={draftRef} className="pdf-contract">
              <DraftEditor draft={result.draft} onFilled={setFilledDraft} />
            </div>
          </div>
          <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>
              본 내용은 참고용이며 실제 계약 전 노무사 또는 전문가 확인을
              권장합니다.
            </span>
          </div>

          {/* 저장 */}
          <div className="mt-4 pt-4 border-t border-surface-300">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              계약서 저장
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                placeholder="저장 이름 — 예: 홍길동 근로계약서"
                className="flex-1 rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !saveTitle.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                저장
              </button>
            </div>
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
