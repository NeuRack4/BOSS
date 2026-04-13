"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "개요", href: "/dashboard", icon: "◈" },
  { label: "매출 관리", href: "/dashboard/sales", icon: "₩" },
  { label: "AI 인사이트", href: "/dashboard/insights", icon: "✦" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 flex">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-60 bg-white border-r border-surface-300 flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 border-b border-surface-300">
          <Link
            href="/"
            className="text-xl font-black gradient-text tracking-tight"
          >
            BOSS
          </Link>
          <span className="ml-2 text-xs text-gray-400 font-medium">v0.1.0</span>
        </div>

        {/* 카페 정보 */}
        <div className="px-4 py-4 border-b border-surface-300">
          <div className="glass-card rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">내 카페</p>
            <p className="text-sm font-semibold text-gray-800 truncate">
              마포구 카페
            </p>
            <p className="text-xs text-brand-500 font-medium">
              1인 운영 · 마포구
            </p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ label, href, icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-brand-50 text-brand-600 border border-brand-500/20"
                      : "text-gray-600 hover:bg-surface-200 hover:text-gray-900"
                  }`}
              >
                <span className="text-base w-5 text-center">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* 하단 */}
        <div className="px-4 py-4 border-t border-surface-300 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 랜딩 페이지로
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/auth/login");
            }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 상단 헤더 */}
        <header className="md:hidden h-14 bg-white border-b border-surface-300 flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-600"
          >
            ☰
          </button>
          <span className="font-black gradient-text">BOSS</span>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
