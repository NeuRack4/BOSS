"use client";

import Link from "next/link";

export default function CTASection() {
  return (
    <section id="cta" className="py-32 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center">
        <div className="relative">
          {/* Soft background glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[300px] bg-brand-50 rounded-full blur-[80px]" />
          </div>

          <div className="relative rounded-3xl p-12 border border-brand-200 bg-gradient-to-b from-brand-50 to-white glow-blue">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-200 bg-white text-brand-600 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              서울 F&B 창업자 전용
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 leading-tight">
              지금 바로 시작하면
              <br />
              <span className="gradient-text">내일 아침 초안이 기다립니다</span>
            </h2>

            <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto">
              업종과 지역, 창업 단계만 입력하면 BOSS가 나머지를 챙깁니다.
              <br />
              검토하고 제출만 하세요.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/onboarding"
                className="w-full sm:w-auto px-10 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-lg transition-all hover:scale-105 glow-blue text-center"
              >
                무료로 시작하기
              </Link>
              <button className="w-full sm:w-auto px-10 py-4 rounded-xl border border-gray-200 hover:border-brand-300 text-gray-700 font-semibold text-lg transition-all hover:bg-brand-50">
                데모 보기
              </button>
            </div>

            <p className="mt-8 text-xs text-gray-400">
              현재 버전: v0.3.0 · 서울 F&B(카페/베이커리/분식) 한정 서비스 · AI
              심화과정 조별과제 2026
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
