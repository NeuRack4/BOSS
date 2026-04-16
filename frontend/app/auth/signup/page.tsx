"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch, formDataToProfile } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (form.password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error) {
      if (error.status === 429) {
        setError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      // 온보딩에서 입력한 데이터가 있으면 자동으로 프로필 저장
      try {
        const saved = localStorage.getItem("boss_profile");
        if (saved) {
          const parsed = JSON.parse(saved);
          await apiFetch("/founders/me", {
            method: "PUT",
            body: JSON.stringify(
              formDataToProfile(parsed as Record<string, unknown>)
            ),
          });
          localStorage.removeItem("boss_profile");
          // 온보딩 완료 후 가입 → 대시보드로
          router.push("/dashboard");
        } else {
          // 온보딩 없이 가입 → 온보딩으로
          router.push("/onboarding");
        }
      } catch {
        // 저장 실패해도 대시보드로 이동 (프로필은 나중에 입력 가능)
        router.push("/dashboard");
      }
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
          <h1 className="text-xl font-bold text-gray-900 mb-6">회원가입</h1>

          <form onSubmit={handleSignup} className="space-y-4">
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
                placeholder="6자 이상"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                비밀번호 확인
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
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
              {loading ? "가입 중..." : "시작하기"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/auth/login"
              className="text-brand-500 font-semibold hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
