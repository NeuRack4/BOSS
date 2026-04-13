"use client";

const MAPO_DISTRICTS = [
  "홍대입구",
  "합정",
  "연남동",
  "망원동",
  "공덕",
  "성산동",
  "마포대로",
  "아현동",
  "신수동",
];

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function DistrictSelector({ selected, onChange }: Props) {
  const toggle = (district: string) => {
    onChange(
      selected.includes(district)
        ? selected.filter((d) => d !== district)
        : [...selected, district],
    );
  };

  return (
    <div>
      <p className="text-slate-300 text-sm font-medium mb-3">
        분석할 상권 선택{" "}
        <span className="text-slate-500 font-normal">(복수 선택 가능)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {MAPO_DISTRICTS.map((d) => {
          const active = selected.includes(d);
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors
                ${
                  active
                    ? "bg-brand-500 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-slate-300 hover:border-brand-500/50 hover:text-white"
                }`}
            >
              {d}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
