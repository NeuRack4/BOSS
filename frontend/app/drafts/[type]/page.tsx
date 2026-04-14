"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PdfOverlayForm from "./PdfOverlayForm";
import {
  BIZ_REG_FIELDS,
  FOOD_BIZ_FIELDS,
  EMP_CONTRACT_FIELDS,
  LEASE_CONTRACT_FIELDS,
} from "./formFieldCoords";
import type { FieldDef } from "./PdfOverlayForm";

/* ─── 서류 메타 ─── */
const DOC_META: Record<
  string,
  { title: string; subtitle: string; pdfUrl: string; fieldDefs: FieldDef[] }
> = {
  "business-registration": {
    title: "사업자등록 신청서",
    subtitle: "개인사업자용 · 국세청 제출",
    pdfUrl: "/forms/biz-reg.pdf",
    fieldDefs: BIZ_REG_FIELDS,
  },
  "food-business-license": {
    title: "식품영업 신고서",
    subtitle: "휴게음식점영업 · 구청 위생과 제출",
    pdfUrl: "/forms/food-biz.pdf",
    fieldDefs: FOOD_BIZ_FIELDS,
  },
  "employment-contract": {
    title: "표준 근로계약서",
    subtitle: "고용노동부 표준서식 (정규직)",
    pdfUrl: "/forms/employment.pdf",
    fieldDefs: EMP_CONTRACT_FIELDS,
  },
  "lease-contract": {
    title: "상가건물 임대차계약서",
    subtitle: "법무부 표준계약서",
    pdfUrl: "/forms/lease.pdf",
    fieldDefs: LEASE_CONTRACT_FIELDS,
  },
};

/* ─── 타입 ─── */
interface DraftResult {
  doc_type: string;
  title: string;
  content: string;
  fields: Record<string, string>;
  disclaimer: string;
}

function profileFromStorage(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("boss_profile");
    if (!raw) return {};
    const p = JSON.parse(raw);
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

/* ─── 메인 페이지 ─── */
export default function DraftPreviewPage() {
  const { type } = useParams<{ type: string }>();
  const router = useRouter();

  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const meta = DOC_META[type];

  useEffect(() => {
    if (!meta) {
      setError("지원하지 않는 서류 유형입니다.");
      return;
    }
    const profile = profileFromStorage();
    if (!profile.name) {
      setError("온보딩 정보가 없습니다. 먼저 정보를 입력해주세요.");
      return;
    }
    generateDraft(type, profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // draft.fields가 바뀌면 editedFields 초기화
  useEffect(() => {
    if (draft?.fields) {
      setEditedFields({ ...draft.fields });
    }
  }, [draft?.fields]);

  async function generateDraft(
    docType: string,
    profile: Record<string, unknown>,
  ) {
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
      setDraft(await res.json());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "초안 생성 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(key: string, value: string) {
    setEditedFields((prev) => ({ ...prev, [key]: value }));
  }

  function handlePrint() {
    window.print();
  }

  async function handlePdfSave() {
    const el = document.getElementById("pdf-form-area");
    if (!el) return;

    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf()
      .from(el)
      .set({
        filename: `${draft?.title ?? "서류초안"}.pdf`,
        image: { type: "jpeg", quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true } as never,
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save();
  }

  // 수정 사항은 항상 editedFields에서 표시 (editMode 무관)
  const displayFields = editedFields;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* 상단 바 */}
        <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
              >
                ← 뒤로
              </button>
              <span className="text-gray-200">|</span>
              <span className="text-sm font-semibold text-gray-700">
                {meta?.title ?? type}
              </span>
              {editMode && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  수정 중
                </span>
              )}
            </div>
            <Link
              href="/dashboard"
              className="text-xl font-black gradient-text"
            >
              BOSS
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">
                AI가 서류 초안을 작성하고 있습니다…
              </p>
              <p className="text-xs text-gray-400">RAG 검색 → 필드 자동 입력</p>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-red-500 font-semibold mb-2">초안 생성 실패</p>
              <p className="text-sm text-gray-500 mb-6">{error}</p>
              {error.includes("온보딩") ? (
                <Link
                  href="/onboarding"
                  className="inline-block px-6 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold"
                >
                  정보 입력하러 가기
                </Link>
              ) : (
                <button
                  onClick={() => generateDraft(type, profileFromStorage())}
                  className="px-6 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold"
                >
                  다시 시도
                </button>
              )}
            </div>
          )}

          {/* 초안 결과 */}
          {draft && !loading && (
            <>
              {/* 서류 헤더 */}
              <div className="text-center mb-4 no-print">
                <h1 className="text-2xl font-black text-gray-900">
                  {draft.title}
                </h1>
                {meta && (
                  <p className="text-xs text-gray-400 mt-1">{meta.subtitle}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  BOSS AI 생성 초안 · 정부 PDF 서식에 직접 입력됩니다
                </p>
              </div>

              {/* 수정 모드 안내 */}
              {editMode && (
                <div className="no-print mb-3 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-700">
                  ✎ 노란색 칸을 클릭해 내용을 수정할 수 있습니다. 완료 후 「수정
                  완료」를 누르세요.
                </div>
              )}

              {/* PDF 서식 본문 */}
              <div
                id="pdf-form-area"
                className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden print-area"
              >
                {meta ? (
                  <PdfOverlayForm
                    pdfUrl={meta.pdfUrl}
                    fields={displayFields}
                    fieldDefs={meta.fieldDefs}
                    editMode={editMode}
                    onChange={handleFieldChange}
                    formId="pdf-overlay-inner"
                  />
                ) : (
                  <pre className="p-6 text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {draft.content}
                  </pre>
                )}
              </div>

              {/* 면책 고지 */}
              <div className="no-print mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-700 leading-relaxed">
                  {draft.disclaimer}
                </p>
              </div>

              {/* 액션 버튼 3개 */}
              <div className="no-print mt-4 flex flex-col sm:flex-row gap-3">
                {/* 수정하기 / 완료 */}
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={`flex-1 px-6 py-3 rounded-xl border-2 font-bold text-sm transition-all
                    ${
                      editMode
                        ? "border-green-500 text-green-600 bg-green-50 hover:bg-green-100"
                        : "border-blue-500 text-blue-500 hover:bg-blue-50"
                    }`}
                >
                  {editMode ? "✓ 수정 완료" : "✎ 수정하기"}
                </button>

                {/* PDF 저장 */}
                <button
                  onClick={handlePdfSave}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-400 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all"
                >
                  PDF 저장
                </button>

                {/* 출력 */}
                <button
                  onClick={handlePrint}
                  className="flex-1 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all"
                >
                  출력
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
