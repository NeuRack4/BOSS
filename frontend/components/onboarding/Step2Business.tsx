"use client";

import { FormData, BusinessType, Stage } from "./types";

interface Props {
  data: FormData;
  onChange: (field: keyof FormData, value: string | boolean | string[]) => void;
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-surface-300 bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all";

const BUSINESS_TYPES: {
  value: BusinessType;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "cafe", label: "카페", icon: "☕", desc: "음료·디저트 위주" },
  { value: "bakery", label: "베이커리", icon: "🥐", desc: "빵·케이크 전문" },
  { value: "bunsik", label: "분식", desc: "떡볶이·순대·국수", icon: "🍜" },
];

const STAGES: { value: Stage; label: string; desc: string }[] = [
  { value: "planning", label: "구상 중", desc: "아직 장소를 정하지 않았어요" },
  { value: "contracted", label: "계약 완료", desc: "임대차 계약을 마쳤어요" },
  {
    value: "preparing",
    label: "오픈 준비 중",
    desc: "인테리어·기기 설치 중이에요",
  },
];

const SEOUL_DISTRICTS = [
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구",
];

function CardSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string; desc: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`p-4 rounded-xl border text-left transition-all duration-200 ${
            value === opt.value
              ? "border-brand-500 bg-brand-50 glow-blue"
              : "border-surface-300 bg-white hover:border-brand-300 hover:bg-brand-50/40"
          }`}
        >
          {opt.icon && <div className="text-2xl mb-2">{opt.icon}</div>}
          <div className="font-bold text-sm text-gray-800">{opt.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
        </button>
      ))}
    </div>
  );
}

export default function Step2Business({ data, onChange }: Props) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-black text-gray-900">사업 계획 정보</h2>
        <p className="text-sm text-gray-500 mt-1">
          업종과 단계에 맞는 서류 초안을 자동 선별합니다.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          업종 <span className="text-brand-500">*</span>
        </label>
        <CardSelect<BusinessType>
          options={BUSINESS_TYPES}
          value={data.businessType}
          onChange={(v) => onChange("businessType", v)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          창업 단계 <span className="text-brand-500">*</span>
        </label>
        <CardSelect<Stage>
          options={STAGES}
          value={data.stage}
          onChange={(v) => onChange("stage", v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            상호명 (예정)
            <span className="text-gray-400 font-normal text-xs ml-1">선택</span>
          </label>
          <input
            type="text"
            placeholder="예: 성수 브루잉 카페"
            value={data.businessName}
            onChange={(e) => onChange("businessName", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            예정 지역 (서울)
            <span className="text-gray-400 font-normal text-xs ml-1">선택</span>
          </label>
          <select
            value={data.district}
            onChange={(e) => onChange("district", e.target.value)}
            className={inputClass}
          >
            <option value="">구를 선택하세요</option>
            {SEOUL_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            개업 예정일
          </label>
          <input
            type="date"
            value={data.openDate}
            onChange={(e) => onChange("openDate", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            사업자 유형
            <span className="text-gray-400 font-normal text-xs ml-1">선택</span>
          </label>
          <div className="flex gap-3">
            {[
              { value: "individual", label: "개인사업자" },
              { value: "corporation", label: "법인사업자" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange("entityType", opt.value)}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  data.entityType === opt.value
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

      <div className="flex items-center justify-between p-4 rounded-xl border border-surface-300 bg-white">
        <div>
          <p className="text-sm font-semibold text-gray-700">공동사업자 있음</p>
          <p className="text-xs text-gray-400 mt-0.5">
            2인 이상 공동 창업 시 선택
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange("hasCoOwner", !data.hasCoOwner)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
            data.hasCoOwner ? "bg-brand-500" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
              data.hasCoOwner ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
