export default function DashboardPage() {
  // TODO: Supabase에서 실제 데이터 연동
  const stats = [
    { label: "이번달 매출", value: "0원", change: null, icon: "₩" },
    { label: "전달 대비", value: "-", change: null, icon: "↑" },
    { label: "이번달 거래 건수", value: "0건", change: null, icon: "◈" },
    { label: "일 평균 매출", value: "0원", change: null, icon: "∼" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">마포구 카페 운영 현황</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <span className="text-lg text-brand-500">{icon}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* AI 인사이트 미리보기 */}
      <div className="glass-card rounded-xl p-6 border-brand-500/20 glow-blue">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-brand-500 text-lg">✦</span>
          <h2 className="text-base font-bold text-gray-900">AI 인사이트</h2>
          <span className="ml-auto text-xs text-gray-400 bg-surface-200 px-2 py-0.5 rounded-full">
            준비 중
          </span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          매출 데이터가 쌓이면 AI가 마포구 카페 평균과 비교해 변화 원인을
          분석해드립니다.
        </p>
        <div className="mt-4 p-3 bg-surface-100 rounded-lg border border-surface-300">
          <p className="text-xs text-gray-400 font-medium mb-1">예시</p>
          <p className="text-sm text-gray-600 italic">
            "이번달 매출이 지난달 대비 17% 하락했습니다. 마포구 카페 평균 대비
            낮은 수준이며, 주말 오후 매출 감소가 주요 원인으로 보입니다..."
          </p>
        </div>
      </div>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/dashboard/sales"
          className="glass-card rounded-xl p-5 hover:border-brand-500/30 hover:glow-blue transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl text-brand-500">₩</span>
            <h3 className="font-bold text-gray-900">매출 입력</h3>
          </div>
          <p className="text-sm text-gray-500">오늘의 매출을 기록하세요</p>
          <p className="text-xs text-brand-500 mt-3 group-hover:translate-x-1 transition-transform">
            바로가기 →
          </p>
        </a>

        <a
          href="/dashboard/insights"
          className="glass-card rounded-xl p-5 hover:border-brand-500/30 transition-all group opacity-60"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl text-brand-500">✦</span>
            <h3 className="font-bold text-gray-900">AI 분석</h3>
          </div>
          <p className="text-sm text-gray-500">매출 데이터 기반 인사이트</p>
          <p className="text-xs text-gray-400 mt-3">
            매출 데이터 입력 후 활성화
          </p>
        </a>
      </div>
    </div>
  );
}
