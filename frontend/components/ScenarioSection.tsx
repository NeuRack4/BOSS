const timeline = [
  {
    time: "창업 결심",
    label: "Day 0",
    message: '"마포구 연남동에서 카페 창업할 거야"',
    response: null,
    accent: "brand",
  },
  {
    time: "다음날",
    label: "Day 1",
    message: null,
    response: [
      "마포구 연남동 상권 입지 분석 완료",
      "사업자등록 서류 초안 준비완료",
      "식품위생교육 신청 일정 패키지",
    ],
    accent: "green",
  },
  {
    time: "3주 후",
    label: "D-5",
    message: null,
    response: [
      "예비창업패키지 마감 D-5입니다",
      "신청서 초안 준비했어요 → 검토 후 제출",
    ],
    accent: "yellow",
  },
  {
    time: "오픈 3개월 후",
    label: "D+90",
    message: null,
    response: [
      "이번 달 인스타 마케팅 전략 3가지 추천드려요",
      "시그니처 메뉴 인스타 콘텐츠 초안 작성했어요",
    ],
    accent: "purple",
  },
  {
    time: "오픈 6개월 후",
    label: "D+180",
    message: null,
    response: [
      "부가세 신고 2주 남았습니다",
      "자료 초안 여기 있어요 → 검토 후 신고",
    ],
    accent: "blue",
  },
];

const accentColors: Record<string, string> = {
  brand: "border-brand-400 bg-brand-50 text-brand-600",
  green: "border-green-400 bg-green-50 text-green-600",
  yellow: "border-yellow-400 bg-yellow-50 text-yellow-600",
  purple: "border-purple-400 bg-purple-50 text-purple-600",
  blue: "border-blue-400 bg-blue-50 text-blue-600",
};

const dotColors: Record<string, string> = {
  brand: "bg-brand-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
};

const bossBorderColors: Record<string, string> = {
  brand: "border-l-brand-400",
  green: "border-l-green-400",
  yellow: "border-l-yellow-400",
  purple: "border-l-purple-400",
  blue: "border-l-blue-400",
};

const bossTagColors: Record<string, string> = {
  brand: "text-brand-500",
  green: "text-green-600",
  yellow: "text-yellow-600",
  purple: "text-purple-600",
  blue: "text-blue-600",
};

export default function ScenarioSection() {
  return (
    <section id="scenario" className="py-32 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-gray-300 text-xs font-black tracking-[0.4em] mb-2">01</p>
          <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">
            Scenario
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            한 마디로 시작하는
            <br />
            <span className="gradient-text">1년의 창업 여정</span>
          </h2>
          <p className="text-gray-500 text-lg">
            BOSS는 창업자의 상태를 추적하며 적절한 시점에 먼저 움직입니다
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {timeline.map((item, i) => (
            <div key={i} className="flex gap-6">
              {/* Dot + line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${accentColors[item.accent]}`}
                >
                  {i + 1}
                </div>
                {i < timeline.length - 1 && (
                  <div className="w-px flex-1 mt-2 bg-gradient-to-b from-gray-200 to-transparent min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${accentColors[item.accent]}`}
                  >
                    {item.label}
                  </span>
                  <span className="text-gray-400 text-sm">{item.time}</span>
                </div>

                {item.message && (
                  <div className="glass-card rounded-xl p-4 mb-3 inline-block bg-gray-50">
                    <p className="text-gray-700 font-medium">{item.message}</p>
                  </div>
                )}

                {item.response && (
                  <div
                    className={`glass-card rounded-xl p-4 border-l-4 ${bossBorderColors[item.accent]}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${bossTagColors[item.accent]}`}
                      >
                        BOSS
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full animate-pulse ${dotColors[item.accent]}`}
                      />
                    </div>
                    <ul className="space-y-1.5">
                      {item.response.map((line, j) => (
                        <li
                          key={j}
                          className="text-gray-600 text-sm flex items-start gap-2"
                        >
                          <span className="text-brand-500 mt-0.5 flex-shrink-0">
                            ›
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
