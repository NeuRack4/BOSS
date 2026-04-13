"use client";

import { useState } from "react";
import Link from "next/link";
import StepIndicator from "@/components/onboarding/StepIndicator";
import Step1Personal from "@/components/onboarding/Step1Personal";
import Step2Business from "@/components/onboarding/Step2Business";
import Step3Location from "@/components/onboarding/Step3Location";
import Step4Documents from "@/components/onboarding/Step4Documents";
import { useRouter } from "next/navigation";
import { FormData, initialFormData } from "@/components/onboarding/types";
import { apiFetch, formDataToProfile } from "@/lib/api";

const TOTAL_STEPS = 4;

function isStep1Valid(d: FormData) {
  // 필수: 이름, 연락처, 이메일
  return !!(d.name && d.phone && d.email);
}
function isStep2Valid(d: FormData) {
  // 필수: 업종, 창업 단계
  return !!(d.businessType && d.stage);
}
function isStep3Valid(_d: FormData) {
  // 사업장 정보는 모두 선택사항 (창업 구상 단계엔 없을 수 있음)
  return true;
}
function isStep4Valid(d: FormData) {
  return d.selectedDocuments.length > 0;
}

function isStepValid(step: number, d: FormData) {
  if (step === 1) return isStep1Valid(d);
  if (step === 2) return isStep2Valid(d);
  if (step === 3) return isStep3Valid(d);
  if (step === 4) return isStep4Valid(d);
  return false;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);

  const onChange = (
    field: keyof FormData,
    value: string | boolean | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    localStorage.setItem("boss_profile", JSON.stringify(formData));
    // 로그인 상태이면 Supabase에도 저장
    try {
      await apiFetch("/founders/me", {
        method: "PUT",
        body: JSON.stringify(formDataToProfile(formData as unknown as Record<string, unknown>)),
      });
    } catch {
      // 비로그인 상태면 localStorage만 사용
    }
    setSubmitted(true);
  };

  if (submitted) {
    // 초안 생성 가능한 서류만 필터
    const DRAFT_SUPPORTED = [
      "business-registration",
      "food-business-license",
      "employment-contract",
      "lease-contract",
    ];
    const DRAFT_META: Record<string, { icon: string; label: string }> = {
      "business-registration":  { icon: "🏢", label: "사업자등록 신청서" },
      "food-business-license":  { icon: "🍽", label: "식품영업 신고서" },
      "employment-contract":    { icon: "📋", label: "표준 근로계약서" },
      "lease-contract":         { icon: "🔑", label: "상가 임대차계약서" },
    };
    const draftDocs = formData.selectedDocuments.filter((d) =>
      DRAFT_SUPPORTED.includes(d),
    );

    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-brand-50 border-2 border-brand-500 flex items-center justify-center mx-auto mb-6 glow-blue">
            <svg
              className="w-10 h-10 text-brand-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">
            BOSS가 <span className="gradient-text">초안을 준비합니다</span>
          </h1>
          <p className="text-gray-500 mb-6">
            <span className="font-semibold text-gray-700">{formData.name}</span>
            님, 아래 서류를 선택하면 AI가 즉시 초안을 생성합니다.
          </p>

          {/* 선택한 서류 → 바로 초안 페이지 이동 */}
          {draftDocs.length > 0 && (
            <div className="glass-card rounded-2xl p-5 mb-5 text-left space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">
                선택한 서류 초안 바로 보기
              </p>
              {draftDocs.map((docType) => {
                const meta = DRAFT_META[docType];
                return (
                  <button
                    key={docType}
                    onClick={() => router.push(`/drafts/${docType}`)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 hover:border-brand-400 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{meta.icon}</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-xs text-brand-500 group-hover:translate-x-1 transition-transform">
                      초안 보기 →
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full px-8 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black gradient-text">
            BOSS
          </Link>
          <span className="text-xs text-gray-400">
            Step {step} / {TOTAL_STEPS}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-32">
        {/* Step indicator */}
        <div className="mb-10">
          <StepIndicator current={step} />
        </div>

        {/* Form card */}
        <div className="glass-card rounded-2xl p-8">
          {step === 1 && <Step1Personal data={formData} onChange={onChange} />}
          {step === 2 && <Step2Business data={formData} onChange={onChange} />}
          {step === 3 && <Step3Location data={formData} onChange={onChange} />}
          {step === 4 && <Step4Documents data={formData} onChange={onChange} />}
        </div>
      </div>

      {/* Fixed bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm transition-all hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            이전
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i + 1 === step
                    ? "w-5 h-2 bg-brand-500"
                    : i + 1 < step
                      ? "w-2 h-2 bg-brand-300"
                      : "w-2 h-2 bg-gray-200"
                }`}
              />
            ))}
          </div>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStepValid(step, formData)}
              className="px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all hover:scale-105 glow-blue disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-brand-500"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isStepValid(step, formData)}
              className="px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all hover:scale-105 glow-blue disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-brand-500"
            >
              BOSS에게 초안 맡기기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
