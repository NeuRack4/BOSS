import type { Metadata } from "next";
import LocationDashboard from "@/components/location/LocationDashboard";

export const metadata: Metadata = {
  title: "상권 입지 분석 — BOSS",
  description: "마포구 카페 창업을 위한 데이터 기반 입지 시뮬레이션",
};

export default function LocationPage() {
  return (
    <main className="min-h-screen bg-[#0a0c14] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <header className="mb-10">
          <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-2">
            입지 분석
          </p>
          <h1 className="text-3xl font-bold text-white mb-3">
            마포구 상권 시뮬레이션
          </h1>
          <p className="text-slate-400 text-base">
            골목상권 + 서울 열린데이터 기반으로 생존율·예상매출·BEP를
            계산합니다. 상권을 선택하고 분석을 실행하세요.
          </p>
        </header>
        <LocationDashboard />
      </div>
    </main>
  );
}
