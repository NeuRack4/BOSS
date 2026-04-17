const triggerTypes = [
  {
    icon: "⏰",
    label: "시간 기반 트리거",
    desc: "세금 신고 D-14·D-7·D-1, 지원사업 마감 D-5·D-3 — 법정 기한 2주 전부터 자동 감지합니다.",
    color: "brand",
  },
  {
    icon: "📡",
    label: "공고 수집 · 매칭",
    desc: "기업마당 공고 실시간 수집. 카페·마포구·창업 단계 조건으로 자동 필터링합니다.",
    color: "yellow",
  },
  {
    icon: "🔄",
    label: "창업 단계 감지",
    desc: "사업자등록·오픈·D+90·D+180 — 단계 전환 시 다음 할 일을 먼저 준비합니다.",
    color: "green",
  },
  {
    icon: "🧠",
    label: "AI 맥락 추론",
    desc: "매출·기상·공휴일·유동인구를 교차 분석해 마케팅 최적 타이밍을 판단합니다.",
    color: "purple",
  },
];

const colorMap: Record<
  string,
  { border: string; icon: string; cta: string; leftBorder: string; cat: string }
> = {
  brand: {
    border: "border-brand-200 hover:border-brand-300",
    icon: "bg-brand-50 text-brand-500",
    cta: "text-brand-500",
    leftBorder: "border-l-brand-400",
    cat: "bg-brand-50 text-brand-600 border border-brand-200",
  },
  yellow: {
    border: "border-yellow-200 hover:border-yellow-300",
    icon: "bg-yellow-50 text-yellow-600",
    cta: "text-yellow-600",
    leftBorder: "border-l-yellow-400",
    cat: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  },
  green: {
    border: "border-green-200 hover:border-green-300",
    icon: "bg-green-50 text-green-600",
    cta: "text-green-600",
    leftBorder: "border-l-green-400",
    cat: "bg-green-50 text-green-700 border border-green-200",
  },
  purple: {
    border: "border-purple-200 hover:border-purple-300",
    icon: "bg-purple-50 text-purple-600",
    cta: "text-purple-600",
    leftBorder: "border-l-purple-400",
    cat: "bg-purple-50 text-purple-700 border border-purple-200",
  },
};

const notifications = [
  {
    color: "brand",
    time: "방금 전",
    category: "세금 기한",
    title: "부가세 신고 D-7",
    body: "1기 예정신고 마감 7월 25일 — 올해 매출 데이터 기반 신고서 초안을 작성했습니다.",
    cta: "신고서 초안 확인",
  },
  {
    color: "yellow",
    time: "1시간 전",
    category: "지원사업 신규",
    title: "서울시 소상공인 경영안정자금 공고",
    body: "카페·마포구 조건 매칭 — 마감 D-12. 신청서 초안 준비됐어요.",
    cta: "신청서 초안 보기",
  },
  {
    color: "green",
    time: "어제",
    category: "창업 단계",
    title: "사업자등록 완료 — 다음 단계 시작",
    body: "식품위생교육 신청 기간이 시작됩니다. 마감 D-20, 일정 패키지를 준비했어요.",
    cta: "다음 단계 보기",
  },
  {
    color: "purple",
    time: "3일 전",
    category: "AI 패턴 분석",
    title: "토요일 오후 매출 이상 패턴 감지",
    body: "인근 홍대 행사·기상 데이터 교차 분석 — 인스타 이벤트 콘텐츠 초안 준비됐어요.",
    cta: "콘텐츠 초안 보기",
  },
];

const stats = [
  { num: "D-14", label: "세금 기한 사전 감지", sub: "법정 마감 2주 전부터 알림" },
  {
    num: "연 최대 5,000만원",
    label: "놓칠 수 있는 지원사업",
    sub: "BOSS가 먼저 찾아드립니다",
  },
  { num: "4종", label: "자동 초안 생성", sub: "검토 후 제출만 하면 끝" },
];

export default function TriggerSection() {
  return (
    <section id="triggers" className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-gray-300 text-xs font-black tracking-[0.4em] mb-2">03</p>
          <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">
            Proactive Engine
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            잠든 사이에도
            <br />
            <span className="gradient-text">BOSS는 깨어 있습니다</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
            혼자였다면 놓쳤을 기한, 공고, 단계, 패턴 —
            <br className="hidden md:block" />
            4가지 레이더가 24시간 먼저 감지하고 초안을 준비합니다
          </p>
        </div>

        {/* 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: trigger types */}
          <div className="space-y-4">
            {triggerTypes.map((t, i) => {
              const c = colorMap[t.color];
              return (
                <div
                  key={i}
                  className={`glass-card rounded-2xl p-5 border transition-all hover:shadow-md ${c.border}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${c.icon}`}
                    >
                      {t.icon}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 mb-1">{t.label}</p>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        {t.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: notification feed */}
          <div className="glass-card rounded-2xl border border-gray-200 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-gray-700 text-sm font-semibold">
                  BOSS 알림
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                실시간 감지 중
              </span>
            </div>

            {/* Notifications */}
            <div className="divide-y divide-gray-100">
              {notifications.map((n, i) => {
                const c = colorMap[n.color];
                return (
                  <div
                    key={i}
                    className={`px-5 py-4 border-l-2 ${c.leftBorder} hover:bg-gray-50/60 transition-colors`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${c.cat}`}
                      >
                        {n.category}
                      </span>
                      <span className="text-gray-400 text-xs">{n.time}</span>
                    </div>
                    <p className="text-gray-900 text-sm font-bold leading-snug mb-1.5">
                      {n.title}
                    </p>
                    <p className="text-gray-500 text-xs leading-relaxed mb-2.5">
                      {n.body}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`font-semibold ${c.cta}`}>
                        {n.cta} →
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-400">초안 준비됨</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Panel footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-gray-400 text-xs text-center">
                카페를 운영하는 동안 — BOSS가 이 모든 걸 자동으로 챙깁니다
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16 pt-12 border-t border-gray-100">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-black text-gray-900 mb-1">{s.num}</p>
              <p className="text-brand-500 text-sm font-semibold mb-1">
                {s.label}
              </p>
              <p className="text-gray-400 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
