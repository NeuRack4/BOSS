const triggers = [
  {
    number: "01",
    type: "시간 기반",
    icon: "⏰",
    description: "세금신고 D-14 / D-7 / D-1, 지원사업 마감 D-5 / D-3",
    tech: "APScheduler",
    example: "부가세 신고 D-7 → 신고서 초안 생성",
    color: "brand",
  },
  {
    number: "02",
    type: "상태 전이 기반",
    icon: "🔄",
    description:
      "사업자등록 완료 → 다음 단계 자동 시작, 오픈 D+90 → 알바 채용 제안",
    tech: "LangGraph",
    example: "사업자등록 완료 → 식품위생교육 일정 알림",
    color: "green",
  },
  {
    number: "03",
    type: "이벤트 감지 기반",
    icon: "📡",
    description: "새 지원사업 공고 등록 → 업종 매칭 후 자동 알림",
    tech: "크롤러 + 임베딩",
    example: "새 예비창업패키지 공고 → 매칭 + 신청서 초안",
    color: "yellow",
  },
  {
    number: "04",
    type: "추론 기반",
    icon: "🧠",
    description:
      '"오픈 3개월 + 주말 매출 패턴" 분석으로 알바 필요 시점 자동 판단',
    tech: "Claude API",
    example: '"작년 신청 사업 후속 공고" 자동 발굴',
    color: "purple",
  },
];

const colorMap: Record<
  string,
  { border: string; num: string; badge: string; ex: string }
> = {
  brand: {
    border: "border-brand-200 hover:border-brand-300",
    num: "text-brand-500",
    badge: "bg-brand-50 text-brand-600 border border-brand-200",
    ex: "border-brand-100 bg-brand-50 text-brand-700",
  },
  green: {
    border: "border-green-200 hover:border-green-300",
    num: "text-green-600",
    badge: "bg-green-50 text-green-700 border border-green-200",
    ex: "border-green-100 bg-green-50 text-green-700",
  },
  yellow: {
    border: "border-yellow-200 hover:border-yellow-300",
    num: "text-yellow-600",
    badge: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    ex: "border-yellow-100 bg-yellow-50 text-yellow-700",
  },
  purple: {
    border: "border-purple-200 hover:border-purple-300",
    num: "text-purple-600",
    badge: "bg-purple-50 text-purple-700 border border-purple-200",
    ex: "border-purple-100 bg-purple-50 text-purple-700",
  },
};

export default function TriggerSection() {
  return (
    <section id="triggers" className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">
            Proactive Triggers
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            4가지 트리거로
            <br />
            <span className="gradient-text">항상 한 발 앞서 움직입니다</span>
          </h2>
          <p className="text-gray-500 text-lg">
            시간, 상태, 이벤트, 추론 — 다양한 신호를 조합해 최적의 타이밍에
            행동합니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {triggers.map((t) => {
            const c = colorMap[t.color];
            return (
              <div
                key={t.number}
                className={`glass-card rounded-2xl p-6 border transition-all hover:shadow-md ${c.border}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{t.icon}</span>
                    <div>
                      <p className={`text-xs font-black ${c.num}`}>
                        {t.number}
                      </p>
                      <h3 className="text-lg font-bold text-gray-900">
                        {t.type}
                      </h3>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-md ${c.badge}`}
                  >
                    {t.tech}
                  </span>
                </div>

                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  {t.description}
                </p>

                <div className={`rounded-lg px-4 py-3 border text-sm ${c.ex}`}>
                  <span className="text-gray-400 text-xs block mb-0.5">
                    예시
                  </span>
                  {t.example}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
