import LocationDashboard from "@/components/location/LocationDashboard";

export default function LocationPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-brand-500 text-xs font-semibold tracking-widest uppercase mb-1">
          입지 분석
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          서울시 상권 시뮬레이션
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          서울 전체 상권 데이터 기반으로 AI 매출 예측 및 상권 현황을 분석합니다.
        </p>
      </header>
      <LocationDashboard />
    </div>
  );
}
