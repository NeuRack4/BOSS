const features = [
  {
    icon: "🏗️",
    title: "창업 셋업",
    subtitle: "Setup",
    description:
      "사업자등록 서류 초안 자동 생성, 식품위생교육 절차 안내, 골목상권 데이터 기반 입지 분석 및 생존율 시뮬레이션",
    highlights: [
      "사업자등록 서류 초안",
      "식품위생교육 → 영업신고 패키지",
      "입지 분석 & 생존율 시뮬레이션",
    ],
    color: "brand",
  },
  {
    icon: "💰",
    title: "지원사업 모니터링",
    subtitle: "Subsidy",
    description:
      "기업마당 공고 실시간 수집, 업종·지역·단계 맞춤 필터링, 마감 D-5·D-3 선제 알림과 함께 신청서 초안을 자동 생성",
    highlights: [
      "기업마당 공고 실시간 수집",
      "업종 / 지역 / 단계 필터링",
      "마감 D-5·D-3 + 신청서 초안",
    ],
    color: "green",
  },
  {
    icon: "📋",
    title: "세금 · 행정 관리",
    subtitle: "Tax",
    description:
      "부가세·종합소득세·원천세 기한 관리, 신고 시점 선제 알림, 신고서 초안 제공. 모든 출력에 면책 고지 자동 포함",
    highlights: [
      "부가세 1/25 · 7/25",
      "종합소득세 5월 · 원천세 매월",
      "신고서 초안 자동 생성",
    ],
    color: "yellow",
  },
  {
    icon: "👥",
    title: "채용 자동화",
    subtitle: "Hiring",
    description:
      "오픈 후 운영 패턴 기반 알바 필요 시점 추론, 채용공고 초안 자동 생성, 표준 근로계약서 초안과 주휴수당 자동 계산",
    highlights: [
      "알바 필요 시점 자동 추론",
      "잡코리아 / 알바천국 형식 공고",
      "근로계약서 + 주휴수당 계산",
    ],
    color: "purple",
  },
];

const colorMap: Record<string, { card: string; icon: string; tag: string; bullet: string }> = {
  brand: {
    card: "hover:border-brand-300 hover:shadow-brand-100",
    icon: "bg-brand-50 text-brand-500",
    tag: "text-brand-600 bg-brand-50 border border-brand-200",
    bullet: "text-brand-500",
  },
  green: {
    card: "hover:border-green-300",
    icon: "bg-green-50 text-green-600",
    tag: "text-green-700 bg-green-50 border border-green-200",
    bullet: "text-green-500",
  },
  yellow: {
    card: "hover:border-yellow-300",
    icon: "bg-yellow-50 text-yellow-600",
    tag: "text-yellow-700 bg-yellow-50 border border-yellow-200",
    bullet: "text-yellow-500",
  },
  purple: {
    card: "hover:border-purple-300",
    icon: "bg-purple-50 text-purple-600",
    tag: "text-purple-700 bg-purple-50 border border-purple-200",
    bullet: "text-purple-500",
  },
};

export default function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 bg-surface-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">
            Core Features
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            창업의 모든 단계를
            <br />
            <span className="gradient-text">에이전트가 먼저 챙깁니다</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            카페 · 베이커리 · 분식, 서울 F&B 창업에 특화된 4개의 전문 에이전트
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feat) => {
            const c = colorMap[feat.color];
            return (
              <div
                key={feat.title}
                className={`glass-card rounded-2xl p-7 transition-all duration-300 hover:shadow-lg ${c.card}`}
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${c.icon}`}>
                    {feat.icon}
                  </div>
                  <div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${c.tag}`}>
                      {feat.subtitle}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">{feat.title}</h3>
                  </div>
                </div>

                <p className="text-gray-500 text-sm leading-relaxed mb-5">
                  {feat.description}
                </p>

                <ul className="space-y-2">
                  {feat.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-sm">
                      <span className={`${c.bullet} font-bold`}>›</span>
                      <span className="text-gray-700">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
