"use client";

import { FormData } from "./types";

interface Props {
  data: FormData;
  onChange: (field: keyof FormData, value: string | boolean | string[]) => void;
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-surface-300 bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all";

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-surface-300 bg-white">
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
          value ? "bg-brand-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            value ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function Step3Location({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">사업장 상세 정보</h2>
        <p className="text-sm text-gray-500 mt-1">
          영업신고서 및 입지 분석 리포트 생성에 사용됩니다.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            사업장 도로명 주소 <span className="text-brand-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="서울시 성동구 성수이로 ..."
              value={data.address}
              onChange={(e) => onChange("address", e.target.value)}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              className="px-4 py-3 rounded-xl border border-brand-500 text-brand-600 text-sm font-semibold whitespace-nowrap hover:bg-brand-50 transition-colors flex-shrink-0"
            >
              주소 검색
            </button>
          </div>
          <p className="text-xs text-gray-400">카카오 주소 API 연동 예정</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            상세 주소
          </label>
          <input
            type="text"
            placeholder="2층 201호"
            value={data.addressDetail}
            onChange={(e) => onChange("addressDetail", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            영업장 면적 <span className="text-brand-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="33"
              min="1"
              value={data.floorArea}
              onChange={(e) => onChange("floorArea", e.target.value)}
              className={`${inputClass} pr-12`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
              ㎡
            </span>
          </div>
          <p className="text-xs text-gray-400">휴게음식점 영업신고서 필수 항목</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            과세 유형 <span className="text-brand-500">*</span>
          </label>
          <div className="flex gap-3 h-[50px]">
            {[
              { value: "simplified", label: "간이과세" },
              { value: "general", label: "일반과세" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange("taxType", opt.value)}
                className={`flex-1 rounded-xl border text-sm font-semibold transition-all ${
                  data.taxType === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-surface-300 bg-white text-gray-600 hover:border-brand-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tax type guide */}
      <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-2">
        <p className="text-xs font-semibold text-gray-600">과세 유형 기준 안내</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-700">간이과세자</p>
            <p className="text-xs text-gray-500">연 매출 1억 400만원 미만 예상</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-700">일반과세자</p>
            <p className="text-xs text-gray-500">연 매출 1억 400만원 이상 예상</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          * 참고용입니다. 실제 신고 전 세무사 확인을 권장합니다.
        </p>
      </div>

      <div className="space-y-3">
        <Toggle
          label="식품위생교육 이수 완료"
          desc="영업신고 전 필수 이수 (6시간) — 미이수 시 일정을 안내해드립니다"
          value={data.hasHygieneEdu}
          onChange={(v) => onChange("hasHygieneEdu", v)}
        />
      </div>

      {!data.hasHygieneEdu && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700">식품위생교육 미이수 확인</p>
            <p className="text-xs text-amber-600 mt-0.5">
              BOSS가 식품안전나라 온라인 교육 신청 일정과 링크를 함께 안내해드립니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
