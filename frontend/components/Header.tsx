"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Header() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const displayName = user?.email?.split("@")[0] ?? "";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight gradient-text">BOSS</span>
          <span className="text-xs text-gray-400 font-medium hidden sm:block">v0.1.0</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "기능", href: "#features" },
            { label: "시나리오", href: "#scenario" },
            { label: "트리거", href: "#triggers" },
            { label: "기술 스택", href: "#stack" },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <a
                href="/dashboard"
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-brand-500/30 text-brand-600 hover:bg-brand-50 transition-colors"
              >
                Dashboard
              </a>
              <span className="text-sm text-gray-600 font-medium hidden sm:block">
                {displayName}님
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <a
                href="/auth/login"
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                로그인
              </a>
              <a
                href="/auth/signup"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors glow-blue"
              >
                회원가입
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
