"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const DOC_LABELS: Record<string, string> = {
  "business-registration": "사업자등록 신청서",
  "food-business-license": "식품영업 신고서 (휴게음식점)",
  "employment-contract": "표준 근로계약서",
  "lease-contract": "상가건물 임대차계약서",
};

interface DraftResult {
  doc_type: string;
  title: string;
  content: string;
  disclaimer: string;
}

function profileFromStorage(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("boss_profile");
    if (!raw) return {};
    const p = JSON.parse(raw);
    // camelCase → snake_case mapping
    return {
      name: p.name ?? "",
      birth_date: p.birthDate ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      resident_id_front: p.residentIdFront ?? "",
      resident_id_gender: p.residentIdGender ?? "",
      business_type: p.businessType ?? "",
      business_name: p.businessName ?? "",
      district: p.district ?? "",
      stage: p.stage ?? "",
      open_date: p.openDate ?? "",
      entity_type: p.entityType ?? "individual",
      has_co_owner: p.hasCoOwner ?? false,
      address: p.address ?? "",
      address_detail: p.addressDetail ?? "",
      floor_area: p.floorArea ?? "",
      tax_type: p.taxType ?? "simplified",
      has_hygiene_edu: p.hasHygieneEdu ?? false,
    };
  } catch {
    return {};
  }
}

export default function DraftPreviewPage() {
  const { type } = useParams<{ type: string }>();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = DOC_LABELS[type] ?? type;

  useEffect(() => {
    if (!type || !(type in DOC_LABELS)) {
      setError("지원하지 않는 서류 유형입니다.");
      return;
    }
    const profile = profileFromStorage();
    if (!profile.name) {
      setError("온보딩 정보가 없습니다. 먼저 정보를 입력해주세요.");
      return;
    }
    generateDraft(type, profile);
  }, [type]);

  async function generateDraft(docType: string, profile: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/drafts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: docType, user_profile: profile }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `서버 오류 (${res.status})`);
      }
      const data: DraftResult = await res.json();
      setDraft(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "초안 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    if (!draft) return;
    const blob = new Blob(
      [`${draft.title}\n\n${draft.content}\n\n---\n${draft.disclaimer}`],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* 인쇄 시 헤더/버튼 숨기기 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-surface-100">
        {/* 상단 바 */}
        <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← 뒤로
              </button>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </div>
            <Link href="/dashboard" className="text-xl font-black gradient-text">
              BOSS
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 pt-24 pb-32">
          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Gemini AI가 초안을 작성하고 있습니다...</p>
              <p className="text-xs text-gray-400">RAG 검색 → 서식 분석 → 내용 생성</p>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-red-500 font-semibold mb-2">초안 생성 실패</p>
              <p className="text-sm text-gray-500 mb-6">{error}</p>
              {error.includes("온보딩") ? (
                <Link
                  href="/onboarding"
                  className="inline-block px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold"
                >
                  정보 입력하러 가기
                </Link>
              ) : (
                <button
                  onClick={() => {
                    const p = profileFromStorage();
                    generateDraft(type, p);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold"
                >
                  다시 시도
                </button>
              )}
            </div>
          )}

          {/* 초안 결과 */}
          {draft && !loading && (
            <>
              {/* 타이틀 */}
              <div className="mb-6">
                <h1 className="text-2xl font-black text-gray-900">{draft.title}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  BOSS AI 생성 초안 · 제출 전 내용을 반드시 확인하세요
                </p>
              </div>

              {/* 초안 본문 */}
              <div
                ref={printRef}
                className="print-area glass-card rounded-2xl p-8 mb-6 font-mono text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words"
              >
                {draft.content}
              </div>

              {/* 면책 고지 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
                <p className="text-xs text-amber-700 leading-relaxed">{draft.disclaimer}</p>
              </div>

              {/* 액션 버튼 */}
              <div className="no-print flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-brand-500 text-brand-500 font-bold text-sm hover:bg-brand-50 transition-all"
                >
                  텍스트 파일로 저장
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all hover:scale-105 glow-blue"
                >
                  출력 / PDF 저장
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
