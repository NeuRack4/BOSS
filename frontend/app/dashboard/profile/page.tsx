"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch, formDataToProfile, profileToFormData } from "@/lib/api";
import { FormData, initialFormData } from "@/components/onboarding/types";

const BIZ_OPTIONS = [
  { value: "cafe", label: "카페" },
  { value: "bakery", label: "베이커리" },
  { value: "snack", label: "분식" },
];
const TAX_OPTIONS = [
  { value: "simplified", label: "간이과세자" },
  { value: "general", label: "일반과세자" },
];
const ENTITY_OPTIONS = [
  { value: "individual", label: "개인사업자" },
  { value: "corporation", label: "법인사업자" },
];
const STAGE_OPTIONS = [
  { value: "planning", label: "창업 계획 중" },
  { value: "contracted", label: "임대차 계약 완료" },
  { value: "preparing", label: "오픈 준비 중" },
];

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-surface-300 bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all";
const selectClass = inputClass;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-5">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <label className="text-sm font-medium text-gray-600 col-span-1">
        {label}
      </label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // 1순위: Supabase API
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(`${apiUrl}/founders/me`, {
            headers: { "x-user-id": user.id },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.profile && Object.keys(data.profile).length > 0) {
              setForm(profileToFormData(data.profile) as unknown as FormData);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }
      // 2순위: localStorage
      try {
        const raw = localStorage.getItem("boss_profile");
        if (raw) setForm(JSON.parse(raw) as FormData);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const onChange = (
    field: keyof FormData,
    value: string | boolean | string[],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch("/founders/me", {
        method: "PUT",
        body: JSON.stringify(
          formDataToProfile(form as unknown as Record<string, unknown>),
        ),
      });
      if (!res.ok) throw new Error("저장 실패");
      localStorage.setItem("boss_profile", JSON.stringify(form));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">마이페이지</h1>
          <p className="text-sm text-gray-500 mt-1">
            창업자 정보를 확인하고 수정할 수 있습니다
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50"
        >
          {saving ? "저장 중..." : saved ? "저장됨 ✓" : "저장하기"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* 기본 정보 */}
      <Section title="기본 정보">
        <Field label="성명">
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={inputClass}
            placeholder="홍길동"
          />
        </Field>
        <Field label="생년월일">
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => onChange("birthDate", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="연락처">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            className={inputClass}
            placeholder="010-1234-5678"
          />
        </Field>
        <Field label="이메일">
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={inputClass}
            placeholder="hello@example.com"
          />
        </Field>
      </Section>

      {/* 사업 정보 */}
      <Section title="사업 정보">
        <Field label="업종">
          <select
            value={form.businessType}
            onChange={(e) => onChange("businessType", e.target.value)}
            className={selectClass}
          >
            <option value="">선택</option>
            {BIZ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="상호명">
          <input
            type="text"
            value={form.businessName}
            onChange={(e) => onChange("businessName", e.target.value)}
            className={inputClass}
            placeholder="예: 홍길동 카페"
          />
        </Field>
        <Field label="사업 지역">
          <input
            type="text"
            value={form.district}
            onChange={(e) => onChange("district", e.target.value)}
            className={inputClass}
            placeholder="예: 마포구"
          />
        </Field>
        <Field label="창업 단계">
          <select
            value={form.stage}
            onChange={(e) => onChange("stage", e.target.value)}
            className={selectClass}
          >
            <option value="">선택</option>
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="개업 예정일">
          <input
            type="date"
            value={form.openDate}
            onChange={(e) => onChange("openDate", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="사업자 유형">
          <select
            value={form.entityType}
            onChange={(e) => onChange("entityType", e.target.value)}
            className={selectClass}
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="공동사업자">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasCoOwner}
              onChange={(e) => onChange("hasCoOwner", e.target.checked)}
              className="w-4 h-4 accent-brand-500"
            />
            <span className="text-sm text-gray-700">있음</span>
          </label>
        </Field>
      </Section>

      {/* 사업장 정보 */}
      <Section title="사업장 정보">
        <Field label="주소">
          <input
            type="text"
            value={form.address}
            onChange={(e) => onChange("address", e.target.value)}
            className={inputClass}
            placeholder="도로명 주소"
          />
        </Field>
        <Field label="상세주소">
          <input
            type="text"
            value={form.addressDetail}
            onChange={(e) => onChange("addressDetail", e.target.value)}
            className={inputClass}
            placeholder="동·호수 등"
          />
        </Field>
        <Field label="영업장 면적(㎡)">
          <input
            type="text"
            value={form.floorArea}
            onChange={(e) => onChange("floorArea", e.target.value)}
            className={inputClass}
            placeholder="예: 33"
          />
        </Field>
        <Field label="과세 유형">
          <select
            value={form.taxType}
            onChange={(e) => onChange("taxType", e.target.value)}
            className={selectClass}
          >
            {TAX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="식품위생교육">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasHygieneEdu}
              onChange={(e) => onChange("hasHygieneEdu", e.target.checked)}
              className="w-4 h-4 accent-brand-500"
            />
            <span className="text-sm text-gray-700">이수 완료</span>
          </label>
        </Field>
      </Section>

      {/* 하단 저장 버튼 */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50"
        >
          {saving ? "저장 중..." : saved ? "저장됨 ✓" : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}
