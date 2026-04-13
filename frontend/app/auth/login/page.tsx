"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    } else {
      // 프로필 존재 여부 확인 → 있으면 대시보드, 없으면 온보딩
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
          const res = await fetch(`${apiUrl}/founders/me`, {
            headers: { "x-user-id": user.id },
          });
          if (res.ok) {
            const data = await res.json();
            const hasProfile = data.profile && Object.keys(data.profile).length > 0;
            router.push(hasProfile ? "/dashboard" : "/onboarding");
            return;
          }
        } catch {}
      }
      router.push("/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-3xl font-black gradient-text">BOSS</span>
          </Link>
          <p className="text-sm text-gray-400 mt-2">
            서울 F&B 창업자를 위한 AI 비서
          </p>
        </div>

        {/* 카드 */}
        <div className="glass-card rounded-2xl p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-6">로그인</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="hello@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            계정이 없으신가요?{" "}
            <Link
              href="/auth/signup"
              className="text-brand-500 font-semibold hover:underline"
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
