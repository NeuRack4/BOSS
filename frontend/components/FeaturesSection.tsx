"use client";

import { useState } from "react";

const features = [
  {
    icon: "🤖",
    title: "AI 챗봇",
    subtitle: "Chat",
    description:
      "법령 검색부터 세금 질의응답, 마케팅 조언까지 창업 전반의 궁금증을 RAG 기반으로 즉시 답변",
    highlights: [
      "식품위생법·근로기준법 즉시 검색",
      "세금·인허가 절차 질의응답",
      "마포구 상권 데이터 기반 조언",
    ],
    color: "brand",
  },
  {
    icon: "📊",
    title: "매출 · 메뉴 관리",
    subtitle: "Sales",
    description:
      "카드·현금·배달 채널별 매출 입력과 메뉴 카테고리 분석, 전월 대비 트렌드와 AI 인사이트를 자동 제공",
    highlights: [
      "채널별 일·월 매출 입력",
      "메뉴별 판매 분석·인기 순위",
      "전월 대비 AI 인사이트 자동 생성",
    ],
    color: "green",
  },
  {
    icon: "📋",
    title: "세금 · 행정 관리",
    subtitle: "Tax",
    description:
      "부가세·종합소득세·원천세 기한 관리, 신고 시점 선제 알림, 간이·일반과세자 맞춤 신고서 초안 제공",
    highlights: [
      "부가세 1/25 · 7/25",
      "종합소득세 5월 · 원천세 매월",
      "간이·일반과세자 신고서 초안",
    ],
    color: "yellow",
  },
  {
    icon: "📣",
    title: "마케팅 콘텐츠",
    subtitle: "Marketing",
    description:
      "매출·메뉴·상권 데이터를 분석해 마케팅 전략을 추천하고, 인스타그램·블로그·네이버 플레이스 맞춤 콘텐츠 초안을 자동 생성",
    highlights: [
      "데이터 기반 마케팅 전략 추천",
      "인스타·블로그·네이버 플레이스 초안",
      "DALL-E 3 메뉴 이미지 자동 생성",
    ],
    color: "purple",
  },
  {
    icon: "🗺️",
    title: "상권 · 입지 분석",
    subtitle: "Location",
    description:
      "마포구 9개 상권의 유동인구·개폐업률·카페 생존율 데이터로 최적 입지를 분석하고 창업 리스크를 시뮬레이션",
    highlights: [
      "홍대·연남·망원 등 9개 상권 분석",
      "카페 생존율 5년 시뮬레이션",
      "유동인구·경쟁업체 밀도 비교",
    ],
    color: "blue",
  },
  {
    icon: "💰",
    title: "지원사업 모니터링",
    subtitle: "Subsidy",
    description:
      "기업마당 공고 실시간 수집, 카페 업종·마포구 지역·창업 단계 맞춤 필터링, 마감 D-5·D-3 선제 알림과 신청서 초안 자동 생성",
    highlights: [
      "기업마당 공고 실시간 수집",
      "카페 / 마포구 / 단계별 필터링",
      "마감 D-5·D-3 + 신청서 초안",
    ],
    color: "orange",
  },
];

const colorMap: Record<
  string,
  { card: string; icon: string; tag: string; bullet: string; bar: string }
> = {
  brand: {
    card: "hover:border-brand-300 hover:shadow-brand-100",
    icon: "bg-brand-50 text-brand-500",
    tag: "text-brand-600 bg-brand-50 border border-brand-200",
    bullet: "text-brand-500",
    bar: "bg-brand-400",
  },
  green: {
    card: "hover:border-green-300",
    icon: "bg-green-50 text-green-600",
    tag: "text-green-700 bg-green-50 border border-green-200",
    bullet: "text-green-500",
    bar: "bg-green-400",
  },
  yellow: {
    card: "hover:border-yellow-300",
    icon: "bg-yellow-50 text-yellow-600",
    tag: "text-yellow-700 bg-yellow-50 border border-yellow-200",
    bullet: "text-yellow-500",
    bar: "bg-yellow-400",
  },
  purple: {
    card: "hover:border-purple-300",
    icon: "bg-purple-50 text-purple-600",
    tag: "text-purple-700 bg-purple-50 border border-purple-200",
    bullet: "text-purple-500",
    bar: "bg-purple-400",
  },
  blue: {
    card: "hover:border-blue-300",
    icon: "bg-blue-50 text-blue-600",
    tag: "text-blue-700 bg-blue-50 border border-blue-200",
    bullet: "text-blue-500",
    bar: "bg-blue-400",
  },
  orange: {
    card: "hover:border-orange-300",
    icon: "bg-orange-50 text-orange-600",
    tag: "text-orange-700 bg-orange-50 border border-orange-200",
    bullet: "text-orange-500",
    bar: "bg-orange-400",
  },
};

// ── 세부 패널 ─────────────────────────────────────────────────────

function ChatDetail() {
  return (
    <div className="mt-5 pt-4 border-t border-surface-200">
      <p className="text-xs font-semibold text-gray-400 mb-3">대화 예시</p>
      <div className="space-y-2.5">
        {/* 사용자 */}
        <div className="flex justify-end">
          <div className="bg-brand-500 text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 max-w-[78%] leading-relaxed">
            부가세 신고 기한이 언제예요?
          </div>
        </div>
        {/* BOSS 응답 */}
        <div className="flex gap-2 items-start">
          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-black text-brand-600 shrink-0 mt-0.5">B</div>
          <div className="bg-surface-50 border border-surface-200 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-gray-700 leading-relaxed space-y-1.5">
            <p>1기 확정신고는 <strong>7월 25일</strong>, 2기는 <strong>1월 25일</strong>까지예요.</p>
            <div className="flex items-center gap-1 text-brand-500 text-[10px]">
              <span>📎</span>
              <span>부가가치세법 제49조 외 2건 참고</span>
            </div>
          </div>
        </div>
        {/* 사용자 */}
        <div className="flex justify-end">
          <div className="bg-brand-500 text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 max-w-[78%] leading-relaxed">
            신고서 초안도 만들어줄 수 있어?
          </div>
        </div>
        {/* BOSS 응답 */}
        <div className="flex gap-2 items-start">
          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-black text-brand-600 shrink-0 mt-0.5">B</div>
          <div className="bg-surface-50 border border-surface-200 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-gray-700 space-y-1.5">
            <p>매출 데이터 기반으로 초안 생성했어요.</p>
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-lg px-2 py-1.5">
              <span className="text-sm">📄</span>
              <span className="text-brand-600 font-medium">부가세신고서_2025_1기.pdf</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesDetail() {
  const months = [
    { month: "11월", sales: 280 },
    { month: "12월", sales: 420 },
    { month: "1월", sales: 350 },
    { month: "2월", sales: 310 },
    { month: "3월", sales: 480 },
    { month: "4월", sales: 520 },
  ];
  const max = Math.max(...months.map((m) => m.sales));
  return (
    <div className="mt-5 pt-4 border-t border-surface-200">
      <p className="text-xs font-semibold text-gray-400 mb-3">월별 매출 추이</p>
      <div className="flex items-end gap-1.5 h-24 px-1">
        {months.map((m, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-gray-400">{Math.round(m.sales / 10)}만</span>
            <div
              className={`w-full rounded-t-md transition-all ${i === months.length - 1 ? "bg-green-500" : "bg-green-200"}`}
              style={{ height: `${(m.sales / max) * 60}px` }}
            />
            <span className="text-[9px] text-gray-400">{m.month}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "이번달 매출", value: "520만원", sub: "" },
          { label: "전월 대비", value: "+8.3%", sub: "↑", green: true },
          { label: "인기 메뉴", value: "딸기라떼", sub: "" },
        ].map((s, i) => (
          <div key={i} className="bg-surface-50 rounded-lg px-2 py-2 text-center">
            <p className="text-[9px] text-gray-400 mb-0.5">{s.label}</p>
            <p className={`text-xs font-bold ${s.green ? "text-green-600" : "text-gray-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaxDetail() {
  const items = [
    { name: "원천세 신고", date: "5월 10일", dday: "D-23", urgency: "orange" },
    { name: "종합소득세 신고", date: "5월 31일", dday: "D-44", urgency: "yellow" },
    { name: "부가세 1기 확정신고", date: "7월 25일", dday: "D-99", urgency: "green" },
  ];
  const urgencyStyle: Record<string, string> = {
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
    green: "bg-green-50 text-green-600 border-green-200",
  };
  return (
    <div className="mt-5 pt-4 border-t border-surface-200">
      <p className="text-xs font-semibold text-gray-400 mb-3">다가오는 세금 기한</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-surface-50 rounded-xl px-3 py-2.5 border border-surface-200">
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyStyle[item.urgency]}`}>
                {item.dday}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.date}까지</p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-lg">
              초안 보기
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketingDetail() {
  return (
    <div className="mt-5 pt-4 border-t border-surface-200">
      <p className="text-xs font-semibold text-gray-400 mb-3">인스타그램 콘텐츠 예시</p>
      <div className="rounded-2xl overflow-hidden border border-surface-200 bg-white shadow-sm">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            {/* 인스타 스토리 링 */}
            <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
              <div className="p-[1.5px] rounded-full bg-white">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-white text-[10px] font-bold">
                  C
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-900 leading-tight">caffe_yeonnam</p>
              <p className="text-[9px] text-gray-400">연남동 · 마포구, 서울</p>
            </div>
          </div>
          <span className="text-gray-400 font-bold tracking-widest text-sm leading-none">···</span>
        </div>

        {/* ── 이미지 영역 ── */}
        <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
          <img
            src="/strawberry-latte.jpg"
            alt="딸기라떼"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent flex items-end px-3 pb-2">
            <p className="text-white text-[11px] font-bold tracking-wide drop-shadow">딸기라떼 🌸 신메뉴</p>
          </div>
        </div>

        {/* ── 액션 버튼 ── */}
        <div className="px-3 pt-2.5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3.5">
              <svg className="w-[18px] h-[18px] text-gray-800" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <svg className="w-[18px] h-[18px] text-gray-800" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
              <svg className="w-[18px] h-[18px] text-gray-800" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <svg className="w-[18px] h-[18px] text-gray-800" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </div>

          <p className="text-[11px] font-bold text-gray-900 mb-1">좋아요 247개</p>
          <p className="text-[10px] text-gray-700 leading-relaxed mb-1">
            <span className="font-bold">caffe_yeonnam</span> 봄이 왔어요 🌸 연남동 골목에서만 느낄 수 있는 달콤한 딸기라떼. 4월 런칭 기념 10% 할인 중이에요!
          </p>
          <p className="text-[10px] text-blue-500 leading-relaxed mb-1.5">
            #연남동카페 #딸기라떼 #마포구카페 #홍대근처 #카페스타그램 #봄신메뉴 #라떼아트
          </p>
          <p className="text-[10px] text-gray-400">댓글 18개 모두 보기</p>
          <p className="text-[9px] text-gray-300 mt-0.5">2시간 전</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 text-center">DALL-E 3 이미지 + Claude 캡션 자동 생성</p>
    </div>
  );
}

function LocationDetail() {
  const districts = [
    { name: "홍대입구", x: 28, y: 38, score: 92, color: "bg-brand-500" },
    { name: "연남동", x: 44, y: 22, score: 88, color: "bg-brand-400" },
    { name: "합정", x: 18, y: 58, score: 79, color: "bg-green-500" },
    { name: "망원동", x: 10, y: 40, score: 75, color: "bg-green-400" },
    { name: "공덕", x: 62, y: 52, score: 68, color: "bg-yellow-500" },
    { name: "마포대로", x: 72, y: 68, score: 61, color: "bg-orange-400" },
    { name: "성산동", x: 30, y: 62, score: 70, color: "bg-yellow-400" },
  ];
  return (
    <div className="mt-5 pt-4 border-t border-surface-200">
      <p className="text-xs font-semibold text-gray-400 mb-3">마포구 상권 입지 점수</p>
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ height: 170, background: "#eae8e3" }}
      >
        {/* 격자선 */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(#999 1px, transparent 1px), linear-gradient(90deg, #999 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* 한강 */}
        <div className="absolute bottom-0 left-0 right-0 h-10 rounded-t-3xl" style={{ background: "rgba(147,197,253,0.45)" }}>
          <p className="text-[9px] text-blue-400 font-medium text-center mt-3">한강</p>
        </div>
        {/* 상권 원형 */}
        {districts.map((d) => (
          <div
            key={d.name}
            className="absolute flex flex-col items-center"
            style={{ left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%,-50%)" }}
          >
            <div
              className={`w-9 h-9 rounded-full ${d.color} flex items-center justify-center text-white text-[11px] font-black shadow-md opacity-90`}
            >
              {d.score}
            </div>
            <span className="text-[8px] font-semibold text-gray-700 bg-white/85 px-1 py-0.5 rounded mt-0.5 whitespace-nowrap">
              {d.name}
            </span>
          </div>
        ))}
        {/* 범례 */}
        <div className="absolute top-2 right-2 bg-white/90 rounded-lg px-2 py-1.5 space-y-1">
          {[
            { label: "90점↑", color: "bg-brand-500" },
            { label: "70~89", color: "bg-green-500" },
            { label: "~69", color: "bg-orange-400" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${l.color} inline-block`} />
              <span className="text-[9px] text-gray-600">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 text-center">유동인구·개폐업률·카페 밀도·임대료 5개 지표 종합 (100점)</p>
    </div>
  );
}

function SubsidyDetail() {
  const programs = [
    {
      name: "2025 예비창업패키지",
      org: "중소벤처기업부",
      amount: "최대 1억원",
      dday: "D-12",
      urgency: "red",
    },
    {
      name: "서울 소상공인 경영안정 지원",
      org: "서울시",
      amount: "최대 3천만원",
      dday: "D-34",
      urgency: "orange",
    },
  ];
  const badge: Record<string, string> = {
    red: "bg-red-50 text-red-600 border-red-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
  };
  return (
    <div className="mt-5 pt-4 border-t border-surface-200">
      <p className="text-xs font-semibold text-gray-400 mb-3">매칭된 지원사업</p>
      <div className="space-y-2.5">
        {programs.map((p, i) => (
          <div key={i} className="bg-surface-50 rounded-xl p-3 border border-surface-200">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-bold text-gray-900 leading-snug pr-2">{p.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge[p.urgency]}`}>
                {p.dday}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-400">{p.org}</p>
              <p className="text-[10px] font-bold text-green-600">{p.amount}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1">
              <span>📄</span>
              <span className="font-medium">신청서 초안 준비완료 → 검토 후 제출</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureDetail({ title }: { title: string }) {
  switch (title) {
    case "AI 챗봇": return <ChatDetail />;
    case "매출 · 메뉴 관리": return <SalesDetail />;
    case "세금 · 행정 관리": return <TaxDetail />;
    case "마케팅 콘텐츠": return <MarketingDetail />;
    case "상권 · 입지 분석": return <LocationDetail />;
    case "지원사업 모니터링": return <SubsidyDetail />;
    default: return null;
  }
}

// ── 메인 섹션 ─────────────────────────────────────────────────────

export default function FeaturesSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="features" className="py-32 px-6 bg-surface-100">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-16">
          <p className="text-gray-300 text-xs font-black tracking-[0.4em] mb-2">02</p>
          <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">
            Core Features
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            창업의 모든 단계를
            <br />
            <span className="gradient-text">에이전트가 먼저 챙깁니다</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            서울 마포구 카페 1인 창업에 특화된 6가지 핵심 기능
          </p>
        </div>

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => {
            const c = colorMap[feat.color];
            const isOpen = openIndex === i;
            return (
              <div
                key={feat.title}
                className={`glass-card rounded-2xl p-7 flex flex-col transition-all duration-300 hover:shadow-lg ${c.card} ${isOpen ? "self-start" : ""}`}
              >
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${c.icon}`}
                  >
                    {feat.icon}
                  </div>
                  <div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${c.tag}`}>
                      {feat.subtitle}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">{feat.title}</h3>
                  </div>
                </div>

                <p className="text-gray-500 text-sm leading-relaxed mb-5">{feat.description}</p>

                <div className="flex-1" />

                <ul className="space-y-2 mb-5">
                  {feat.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-sm">
                      <span className={`${c.bullet} font-bold`}>›</span>
                      <span className="text-gray-700">{h}</span>
                    </li>
                  ))}
                </ul>

                {/* 접기/펼치기 버튼 */}
                <button
                  onClick={() => toggle(i)}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isOpen
                      ? `${c.tag} border-current`
                      : "border-surface-300 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                  }`}
                >
                  <span>{isOpen ? "접기" : "예시 보기"}</span>
                  <span
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>

                {/* 세부 패널 */}
                {isOpen && <FeatureDetail title={feat.title} />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
