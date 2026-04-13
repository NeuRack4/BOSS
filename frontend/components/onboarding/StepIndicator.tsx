"use client";

const STEPS = [
  { num: 1, label: "기본 정보" },
  { num: 2, label: "사업 계획" },
  { num: 3, label: "사업장 정보" },
  { num: 4, label: "서류 선택" },
];

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between relative">
        {/* connector line */}
        <div className="absolute top-5 left-0 right-0 h-px bg-surface-300 z-0" />
        <div
          className="absolute top-5 left-0 h-px bg-brand-500 z-0 transition-all duration-500"
          style={{ width: `${((current - 1) / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map(({ num, label }) => {
          const done = num < current;
          const active = num === current;
          return (
            <div
              key={num}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  done
                    ? "bg-brand-500 text-white"
                    : active
                      ? "bg-brand-500 text-white glow-blue scale-110"
                      : "bg-white border-2 border-surface-300 text-gray-400"
                }`}
              >
                {done ? (
                  <svg
                    className="w-5 h-5"
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
                ) : (
                  num
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active
                    ? "text-brand-600"
                    : done
                      ? "text-gray-500"
                      : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
