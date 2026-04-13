"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BusinessRegistrationForm, { type BizRegFields } from "./BusinessRegistrationForm";

/* ─── 서류별 메타 ─── */
const DOC_META: Record<string, { title: string; subtitle: string }> = {
  "business-registration":  { title: "사업자등록 신청서", subtitle: "개인사업자용 · 국세청 제출" },
  "food-business-license":  { title: "식품영업 신고서", subtitle: "휴게음식점영업 · 구청 위생과 제출" },
  "employment-contract":    { title: "표준 근로계약서", subtitle: "고용노동부 표준서식" },
  "lease-contract":         { title: "상가건물 임대차계약서", subtitle: "법제처 표준서식" },
};

/* ─── 서류별 필드 레이아웃 (business-registration 제외) ─── */
type FieldDef = { label: string; key: string; span?: number };
type Row = FieldDef[];
type Section = { section: string; rows: Row[] };
type Layout = Section[];

const LAYOUTS: Record<string, Layout> = {
  "food-business-license": [
    {
      section: "영업자 정보",
      rows: [
        [{ label: "영업자 성명", key: "영업자_성명" }, { label: "주민등록번호", key: "영업자_주민등록번호" }],
        [{ label: "주소", key: "영업자_주소", span: 2 }],
        [{ label: "전화번호", key: "영업자_전화번호" }, { label: "신고일", key: "신고일" }],
      ],
    },
    {
      section: "영업장 정보",
      rows: [
        [{ label: "영업소 명칭", key: "영업소_명칭" }, { label: "영업의 종류", key: "영업의_종류" }],
        [{ label: "영업소 소재지", key: "영업소_소재지", span: 2 }],
        [{ label: "영업장 면적(㎡)", key: "영업장_면적_㎡" }, { label: "급수 시설", key: "급수_시설_종류" }],
      ],
    },
    {
      section: "위생 관련",
      rows: [
        [{ label: "위생책임자", key: "위생책임자_성명" }, { label: "위생교육 이수", key: "식품위생교육_이수여부" }],
        [{ label: "신고 기관", key: "신고기관", span: 2 }],
      ],
    },
  ],
  "employment-contract": [
    {
      section: "사업주(갑)",
      rows: [
        [{ label: "사업주 성명", key: "사업주_성명" }, { label: "사업장 명칭", key: "사업장_명칭" }],
        [{ label: "사업장 소재지", key: "사업장_소재지", span: 2 }],
        [{ label: "연락처", key: "사업주_연락처", span: 2 }],
      ],
    },
    {
      section: "근로자(을)",
      rows: [
        [{ label: "근로자 성명", key: "근로자_성명" }, { label: "주민등록번호", key: "근로자_주민등록번호" }],
      ],
    },
    {
      section: "근로 조건",
      rows: [
        [{ label: "근무 장소", key: "근무_장소", span: 2 }],
        [{ label: "담당 업무", key: "담당_업무", span: 2 }],
        [{ label: "계약 기간", key: "계약_기간_시작" }, { label: "~ 종료", key: "계약_기간_종료" }],
        [{ label: "근무 시간", key: "근무_시간" }, { label: "휴게 시간", key: "휴게_시간" }],
        [{ label: "근무 요일", key: "근무_요일", span: 2 }],
      ],
    },
    {
      section: "임금",
      rows: [
        [{ label: "임금(시급/월급)", key: "임금_시급_또는_월급", span: 2 }],
        [{ label: "지급일", key: "임금_지급일" }, { label: "지급 방법", key: "임금_지급_방법" }],
      ],
    },
    {
      section: "기타",
      rows: [
        [{ label: "연차 유급휴가", key: "연차_유급휴가", span: 2 }],
        [{ label: "사회보험", key: "사회보험_적용", span: 2 }],
        [{ label: "계약 체결일", key: "계약_체결일", span: 2 }],
      ],
    },
  ],
  "lease-contract": [
    {
      section: "임대인(갑)",
      rows: [
        [{ label: "임대인 성명", key: "임대인_성명" }, { label: "주민등록번호", key: "임대인_주민등록번호" }],
        [{ label: "주소", key: "임대인_주소" }, { label: "연락처", key: "임대인_연락처" }],
      ],
    },
    {
      section: "임차인(을)",
      rows: [
        [{ label: "임차인 성명", key: "임차인_성명" }, { label: "주민등록번호", key: "임차인_주민등록번호" }],
        [{ label: "주소", key: "임차인_주소" }, { label: "연락처", key: "임차인_연락처" }],
      ],
    },
    {
      section: "부동산 표시",
      rows: [
        [{ label: "소재지", key: "부동산_소재지", span: 2 }],
        [{ label: "면적(㎡)", key: "부동산_면적_㎡" }, { label: "임대 목적", key: "임대_목적" }],
      ],
    },
    {
      section: "계약 조건",
      rows: [
        [{ label: "보증금", key: "보증금" }, { label: "월 차임", key: "월_차임" }],
        [{ label: "차임 지급일", key: "차임_지급일", span: 2 }],
        [{ label: "임대 기간 시작", key: "임대_기간_시작" }, { label: "종료", key: "임대_기간_종료" }],
        [{ label: "특약사항", key: "특약사항", span: 2 }],
        [{ label: "계약 체결일", key: "계약_체결일", span: 2 }],
      ],
    },
  ],
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
  } catch { return {}; }
}

/* ─── 일반 서식 표 렌더러 ─── */
function FormTable({
  layout,
  fields,
  editMode,
  onFieldChange,
}: {
  layout: Layout;
  fields: Record<string, string>;
  editMode: boolean;
  onFieldChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-0 border border-gray-400 rounded">
      {layout.map((section, si) => (
        <div key={si}>
          <div className="bg-gray-100 border-b border-gray-400 px-4 py-2">
            <span className="text-xs font-bold text-gray-700 tracking-wide">■ {section.section}</span>
          </div>
          {section.rows.map((row, ri) => (
            <div
              key={ri}
              className="flex border-b border-gray-300 last:border-b-0"
            >
              {row.map((field, fi) => {
                const isSpan = field.span === 2;
                const val = fields[field.key] ?? "";
                const isEmpty = !val || val === "[직접 입력]" || val === "[확인 필요]";
                return (
                  <div
                    key={fi}
                    className={`flex ${isSpan ? "flex-1" : "flex-1"} ${!isSpan && fi < row.length - 1 ? "border-r border-gray-300" : ""}`}
                  >
                    <div className="w-28 flex-shrink-0 bg-gray-50 border-r border-gray-300 px-3 py-2.5 flex items-center">
                      <span className="text-xs font-semibold text-gray-600">{field.label}</span>
                    </div>
                    <div className="flex-1 px-3 py-2.5 flex items-center min-h-[40px]">
                      {editMode ? (
                        <input
                          type="text"
                          value={val === "[직접 입력]" ? "" : val}
                          onChange={(e) => onFieldChange(field.key, e.target.value)}
                          placeholder="직접 입력"
                          className="w-full text-sm border-none outline-none bg-yellow-50 px-1 py-0.5 rounded"
                        />
                      ) : (
                        <span className={`text-sm ${isEmpty ? "text-gray-300 italic" : "text-gray-900"}`}>
                          {val || "[직접 입력]"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
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
  const layout = LAYOUTS[type]; // undefined for business-registration (custom form)
  const isBizReg = type === "business-registration";

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
      setDraft(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "초안 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(key: string, value: string) {
    setEditedFields((prev) => ({ ...prev, [key]: value }));
  }

  function handlePrint() { window.print(); }

  function handlePdfSave() {
    // 브라우저 인쇄 다이얼로그에서 "PDF로 저장" 선택
    window.print();
  }

  const displayFields = editMode ? editedFields : (draft?.fields ?? {});

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
          #biz-reg-form { font-size: 10px; }
        }
      `}</style>

      <div className="min-h-screen bg-surface-100">
        {/* 상단 바 */}
        <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
                ← 뒤로
              </button>
              <span className="text-gray-200">|</span>
              <span className="text-sm font-semibold text-gray-700">{meta?.title ?? type}</span>
              {editMode && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">수정 중</span>
              )}
            </div>
            <Link href="/dashboard" className="text-xl font-black gradient-text">BOSS</Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">AI가 서류 초안을 작성하고 있습니다...</p>
              <p className="text-xs text-gray-400">RAG 검색 → 필드 자동 입력</p>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-red-500 font-semibold mb-2">초안 생성 실패</p>
              <p className="text-sm text-gray-500 mb-6">{error}</p>
              {error.includes("온보딩") ? (
                <Link href="/onboarding" className="inline-block px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold">
                  정보 입력하러 가기
                </Link>
              ) : (
                <button
                  onClick={() => generateDraft(type, profileFromStorage())}
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
              {/* 서류 헤더 */}
              <div className="text-center mb-6 no-print">
                <h1 className="text-2xl font-black text-gray-900">{draft.title}</h1>
                {meta && <p className="text-xs text-gray-400 mt-1">{meta.subtitle}</p>}
                <p className="text-xs text-gray-400 mt-1">BOSS AI 생성 초안 · 제출 전 반드시 내용을 확인하세요</p>
              </div>

              {/* 서식 본문 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4 print-area">
                {isBizReg ? (
                  <BusinessRegistrationForm
                    fields={displayFields as BizRegFields}
                    editMode={editMode}
                    onChange={(key, value) => handleFieldChange(key as string, value)}
                  />
                ) : layout && Object.keys(displayFields).length > 0 ? (
                  <FormTable
                    layout={layout}
                    fields={displayFields}
                    editMode={editMode}
                    onFieldChange={handleFieldChange}
                  />
                ) : (
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                    {draft.content}
                  </pre>
                )}
              </div>

              {/* 범례 */}
              {!editMode && (
                <div className="flex items-center gap-4 mb-4 px-1 no-print">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-gray-300" />
                    <span className="text-xs text-gray-400">[직접 입력] = 제출 전 직접 작성 필요</span>
                  </div>
                </div>
              )}

              {/* 면책 고지 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 no-print">
                <p className="text-xs text-amber-700 leading-relaxed">{draft.disclaimer}</p>
              </div>

              {/* 액션 버튼 3개 */}
              <div className="no-print flex flex-col sm:flex-row gap-3">
                {/* 수정하기 / 완료 */}
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={`flex-1 px-6 py-3 rounded-xl border-2 font-bold text-sm transition-all
                    ${editMode
                      ? "border-green-500 text-green-600 bg-green-50 hover:bg-green-100"
                      : "border-brand-500 text-brand-500 hover:bg-brand-50"
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
                  className="flex-1 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all hover:scale-105 glow-blue"
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
