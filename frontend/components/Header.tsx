"use client";

import { useState, useEffect } from "react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

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

        <a
          href="#cta"
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors glow-blue"
        >
          시작하기
        </a>
      </div>
    </header>
  );
}
