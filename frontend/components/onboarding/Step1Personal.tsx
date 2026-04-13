"use client";

import { FormData } from "./types";

interface Props {
  data: FormData;
  onChange: (field: keyof FormData, value: string | boolean | string[]) => void;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-brand-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-surface-300 bg-white text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function maskResidentId(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 7);
  return digits;
}

export default function Step1Personal({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">
          창업자 기본 정보
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          사업자등록 서류 초안에 자동으로 입력됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="성명" required>
          <input
            type="text"
            placeholder="홍길동"
            value={data.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="생년월일" required>
          <input
            type="date"
            value={data.birthDate}
            onChange={(e) => onChange("birthDate", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="연락처" required>
          <input
            type="tel"
            placeholder="010-1234-5678"
            value={data.phone}
            onChange={(e) => onChange("phone", formatPhone(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="이메일" required hint="BOSS 알림 수신에 사용됩니다.">
          <input
            type="email"
            placeholder="hello@example.com"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="주민등록번호 앞 7자리"
        required
        hint="사업자등록 서류 생성에만 사용됩니다. 뒷 6자리는 수집하지 않습니다."
      >
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="000000"
            maxLength={6}
            value={data.residentIdFront}
            onChange={(e) =>
              onChange("residentIdFront", e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className={`${inputClass} text-center tracking-widest`}
          />
          <span className="text-gray-400 font-bold text-lg">-</span>
          <input
            type="text"
            placeholder="0"
            maxLength={1}
            value={data.residentIdGender}
            onChange={(e) =>
              onChange("residentIdGender", e.target.value.replace(/\D/g, "").slice(0, 1))
            }
            className={`${inputClass} text-center tracking-widest w-20 flex-shrink-0`}
          />
          <span className="text-gray-300 tracking-widest text-sm font-mono flex-shrink-0">
            ● ● ● ● ● ●
          </span>
        </div>
      </Field>

      <div className="p-4 rounded-xl bg-blue-50 border border-brand-100 flex gap-3">
        <svg className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-brand-700 leading-relaxed">
          입력하신 개인정보는 서류 초안 생성 목적으로만 사용되며, 서버에 저장되지 않습니다.
          실제 제출은 창업자 본인이 직접 검토 후 진행합니다.
        </p>
      </div>
    </div>
  );
}
