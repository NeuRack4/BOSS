const stackGroups = [
  {
    category: "AI / LLM",
    icon: "🤖",
    items: [
      {
        name: "Claude API",
        desc: "초안 생성 · 추론 트리거",
        badge: "claude-sonnet-4-6",
      },
      { name: "LangGraph", desc: "상태머신 · 멀티에이전트 오케스트레이션" },
      { name: "LangChain", desc: "RAG 파이프라인 · 에이전트 체인" },
    ],
  },
  {
    category: "RAG / 임베딩",
    icon: "🔍",
    items: [
      { name: "ChromaDB", desc: "벡터 DB (로컬)" },
      {
        name: "OpenAI Embeddings",
        desc: "문서 임베딩",
        badge: "text-embedding-3-small",
      },
      { name: "LlamaIndex", desc: "문서 파싱 + 인덱싱" },
    ],
  },
  {
    category: "백엔드",
    icon: "⚙️",
    items: [
      { name: "FastAPI", desc: "API 서버 (Python)" },
      { name: "APScheduler", desc: "Proactive 트리거 스케줄러" },
      { name: "Supabase", desc: "PostgreSQL · Realtime · Storage · Auth" },
    ],
  },
  {
    category: "프론트엔드",
    icon: "🖥️",
    items: [
      { name: "Next.js 14", desc: "App Router · PWA" },
      { name: "TypeScript", desc: "타입 안전성" },
      { name: "Tailwind CSS", desc: "스타일링" },
    ],
  },
];

export default function StackSection() {
  return (
    <section id="stack" className="py-32 px-6 bg-surface-100">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">
            Tech Stack
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            검증된 기술 스택으로
            <br />
            <span className="gradient-text">안정적으로 구축됩니다</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stackGroups.map((group) => (
            <div
              key={group.category}
              className="glass-card rounded-2xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xl">{group.icon}</span>
                <h3 className="text-sm font-bold text-gray-900">
                  {group.category}
                </h3>
              </div>
              <ul className="space-y-4">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">
                        {item.name}
                      </span>
                      {item.badge && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 font-mono border border-brand-100">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
