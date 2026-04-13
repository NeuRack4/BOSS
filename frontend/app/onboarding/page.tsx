"use client";

import { useState } from "react";
import Link from "next/link";
import StepIndicator from "@/components/onboarding/StepIndicator";
import Step1Personal from "@/components/onboarding/Step1Personal";
import Step2Business from "@/components/onboarding/Step2Business";
import Step3Location from "@/components/onboarding/Step3Location";
import Step4Documents from "@/components/onboarding/Step4Documents";
import { FormData, initialFormData } from "@/components/onboarding/types";

const TOTAL_STEPS = 4;

function isStep1Valid(d: FormData) {
  return (
    d.name &&
    d.birthDate &&
    d.phone &&
    d.email &&
    d.residentIdFront.length === 6 &&
    d.residentIdGender.length === 1
  );
}
function isStep2Valid(d: FormData) {
  return (
    d.businessType && d.businessName && d.district && d.stage && d.entityType
  );
}
function isStep3Valid(d: FormData) {
  return d.address && d.floorArea;
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

  const handleSubmit = () => {
    console.log("📋 BOSS 온보딩 제출 데이터:", formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center px-6">
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
          <p className="text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">{formData.name}</span>
            님, 입력하신 정보를 바탕으로 에이전트가 서류 초안 작업을
            시작했습니다.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            {formData.selectedDocuments.length}개 서류 초안 · {formData.email}
            으로 알림을 보내드립니다
          </p>

          <div className="glass-card rounded-2xl p-6 mb-6 text-left space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              다음 단계
            </p>
            {[
              "서류 초안이 완성되면 이메일로 알림",
              "초안 검토 후 직접 제출",
              "BOSS가 다음 기한·공고를 선제 안내",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700">{item}</p>
              </div>
            ))}
          </div>

          <Link
            href="/"
            className="inline-block px-8 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all hover:scale-105 glow-blue"
          >
            홈으로 돌아가기
          </Link>
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
