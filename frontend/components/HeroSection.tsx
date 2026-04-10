export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-16 bg-gradient-to-b from-surface-100 to-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-50 rounded-full blur-[120px] opacity-70" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-purple-50 rounded-full blur-[80px] opacity-60" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/20 bg-brand-50 text-brand-600 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          서울 F&B 소상공인 전용 · AI 창업 비서
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
          <span className="text-gray-900">창업에 필요한 건</span>
          <br />
          <span className="gradient-text">이미 준비되어 있습니다</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto mb-4 leading-relaxed">
          물어보기 전에 에이전트가 먼저 챙깁니다.
          <br />
          <span className="text-gray-700 font-medium">검토하고 제출만 하세요.</span>
        </p>

        {/* Comparison table */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 mb-12">
          <div className="glass-card rounded-xl px-6 py-4 text-left w-full sm:w-auto bg-gray-50 border-gray-200 shadow-none">
            <p className="text-xs text-gray-400 mb-2 font-medium">기존 서비스</p>
            <ul className="space-y-1.5 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <span className="text-red-400">✕</span> 물어봐야 답한다 (Reactive)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-400">✕</span> 정보만 나열한다
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-400">✕</span> 기능이 파편화되어 있다
              </li>
            </ul>
          </div>

          <div className="text-2xl text-brand-500 font-bold hidden sm:block">→</div>
          <div className="text-2xl text-brand-500 font-bold sm:hidden">↓</div>

          <div className="glass-card rounded-xl px-6 py-4 text-left w-full sm:w-auto border-brand-500/30 glow-blue">
            <p className="text-xs text-brand-600 mb-2 font-medium">BOSS</p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> 먼저 알려준다 (Proactive)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> 초안을 들고 온다
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> 창업 여정을 하나의 맥락으로
              </li>
            </ul>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#scenario"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-lg transition-all hover:scale-105 glow-blue"
          >
            어떻게 작동하나요?
          </a>
          <a
            href="#features"
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-200 hover:border-brand-300 text-gray-700 font-semibold text-lg transition-all hover:bg-brand-50"
          >
            핵심 기능 보기
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-400 text-xs">
        <span>스크롤</span>
        <div className="w-px h-12 bg-gradient-to-b from-gray-300 to-transparent" />
      </div>
    </section>
  );
}
