"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ─── 서류 메타 ─── */
const DOC_META: Record<string, { title: string; subtitle: string }> = {
  "business-registration": {
    title: "사업자등록 신청서",
    subtitle: "개인사업자용 · 국세청 제출",
  },
  "food-business-license": {
    title: "식품영업 신고서",
    subtitle: "휴게음식점영업 · 구청 위생과 제출",
  },
  "employment-contract": {
    title: "표준 근로계약서",
    subtitle: "고용노동부 표준서식 (정규직)",
  },
  "lease-contract": {
    title: "상가건물 임대차계약서",
    subtitle: "법무부 표준계약서",
  },
};

/* ─── 필드 레이블 (한글 표시용) ─── */
const FIELD_LABELS: Record<string, string> = {
  상호_단체명: "상호(단체명)",
  사업장_전화번호: "사업장 전화번호",
  성명_대표자: "성명(대표자)",
  주소지_전화번호: "주소지 전화번호",
  주민등록번호: "주민등록번호",
  휴대전화번호: "휴대전화번호",
  부동산등기용등록번호: "부동산등기용등록번호",
  팩스번호: "팩스번호",
  사업장_소재지: "사업장 소재지",
  주업태: "주업태",
  주종목: "주종목",
  주업종코드: "주업종코드",
  개업일: "개업일",
  종업원수: "종업원수",
  부업태: "부업태",
  부종목: "부종목",
  부업종코드: "부업종코드",
  사이버몰_도메인명: "사이버몰 도메인명",
  "자가면적_㎡": "자가면적(㎡)",
  "타가면적_㎡": "타가면적(㎡)",
  임대인_성명: "임대인 성명",
  임대인_사업자등록번호: "임대인 사업자등록번호",
  임대인_주민법인등록번호: "임대인 주민(법인)등록번호",
  임대차계약기간: "임대차 계약기간",
  전세보증금: "전세보증금",
  월세_차임: "월세(차임)",
  사업자금_자기자금: "사업자금(자기자금)",
  사업자금_타인자금: "사업자금(타인자금)",
  전자우편주소: "전자우편주소",
  신청일: "신청일",
  신고인_성명: "신고인 성명",
  신고인_주민등록번호: "신고인 주민등록번호",
  신고인_주소: "신고인 주소",
  신고인_전화번호: "신고인 전화번호",
  명칭_상호: "명칭(상호)",
  영업장_전화번호: "영업장 전화번호",
  "영업장_내부면적_㎡": "영업장 내부면적(㎡)",
  "영업장_외부면적_㎡": "영업장 외부면적(㎡)",
  영업장_소재지: "영업장 소재지",
  신고일: "신고일",
  채용기관장_사업장명: "채용기관장(사업장명)",
  근로자_성명: "근로자 성명",
  근로자_성별: "성별",
  근로자_생년월일: "생년월일",
  근무형태: "근무형태",
  근로자_연락처: "연락처",
  근로자_주소: "주소",
  계약기간_시작: "계약기간 시작일",
  계약기간_종료: "계약기간 종료일",
  근무장소: "근무장소",
  직종_업무내용: "직종(업무내용)",
  근무요일_시작: "근무요일(시작)",
  근무요일_종료: "근무요일(종료)",
  근무시작시간: "근무시작시간",
  근무종료시간: "근무종료시간",
  휴게시작시간: "휴게시작시간",
  휴게종료시간: "휴게종료시간",
  기본급: "기본급",
  급식비: "급식비",
  임금지급일: "임금지급일",
  은행명: "은행명",
  계좌번호: "계좌번호",
  계약일: "계약일",
  소재지: "소재지",
  토지_지목: "토지 지목",
  "토지_면적_㎡": "토지 면적(㎡)",
  건물_구조용도: "건물 구조·용도",
  "건물_면적_㎡": "건물 면적(㎡)",
  "임차할부분_면적_㎡": "임차할 부분 면적(㎡)",
  보증금: "보증금",
  계약금: "계약금",
  중도금: "중도금",
  중도금_지급일: "중도금 지급일",
  잔금: "잔금",
  잔금_지급일: "잔금 지급일",
  차임_월세: "차임(월세)",
  차임_지급일: "차임 지급일",
  입금계좌: "입금계좌",
  환산보증금: "환산보증금",
  임대차기간_인도일: "임대차 인도일",
  임대차기간_종료: "임대차 종료일",
  임차목적_업종: "임차목적(업종)",
  특약사항: "특약사항",
  임대인_주소: "임대인 주소",
  임대인_주민번호: "임대인 주민번호",
  임대인_전화: "임대인 전화",
  임차인_주소: "임차인 주소",
  임차인_주민번호: "임차인 주민번호",
  임차인_성명: "임차인 성명",
  임차인_전화: "임차인 전화",
  계약체결일: "계약체결일",
  공동조리장_업소정보: "공동조리장 업소정보",
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const prevPdfUrl = useRef<string | null>(null);

  const meta = DOC_META[type];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  /* PDF blob URL 정리 */
  useEffect(() => {
    return () => {
      if (prevPdfUrl.current) URL.revokeObjectURL(prevPdfUrl.current);
    };
  }, []);

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

  /* draft.fields 바뀌면 editedFields 초기화 */
  useEffect(() => {
    if (draft?.fields) {
      setEditedFields({ ...draft.fields });
    }
  }, [draft?.fields]);

  /* editedFields 바뀌면 PDF 재렌더 */
  useEffect(() => {
    if (Object.keys(editedFields).length > 0) {
      renderPdf(editedFields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedFields]);

  async function generateDraft(
    docType: string,
    profile: Record<string, unknown>,
  ) {
    setLoading(true);
    setError(null);
    try {
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

  async function renderPdf(fields: Record<string, string>) {
    setPdfLoading(true);
    try {
      const res = await fetch(`${apiUrl}/drafts/fill-pdf/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error(`PDF 렌더 실패 (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // 이전 blob URL 해제
      if (prevPdfUrl.current) URL.revokeObjectURL(prevPdfUrl.current);
      prevPdfUrl.current = url;
      setPdfUrl(url);
    } catch {
      // PDF 렌더 실패 시 기존 표시 유지
    } finally {
      setPdfLoading(false);
    }
  }

  function handleFieldChange(key: string, value: string) {
    setEditedFields((prev) => ({ ...prev, [key]: value }));
  }

  function handlePrint() {
    const iframe = document.getElementById("pdf-iframe") as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  }

  async function handlePdfSave() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${meta?.title ?? "서류초안"}.pdf`;
    a.click();
  }

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
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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

<<<<<<< HEAD
        <div className="max-w-6xl mx-auto px-4 pt-24 pb-24">

=======
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
>>>>>>> origin/dev
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
                  BOSS AI 생성 초안 · 정부 PDF 서식에 좌표 기반으로 입력됩니다
                </p>
              </div>

<<<<<<< HEAD
              {/* 메인 레이아웃: PDF 뷰어 + 필드 편집 패널 */}
              <div className={`flex gap-4 ${editMode ? "flex-col lg:flex-row" : "flex-col"}`}>
=======
              {/* 수정 모드 안내 */}
              {editMode && (
                <div className="no-print mb-3 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-700">
                  ✎ 노란색 칸을 클릭해 내용을 수정할 수 있습니다. 완료 후 「수정
                  완료」를 누르세요.
                </div>
              )}
>>>>>>> origin/dev

                {/* PDF 뷰어 */}
                <div className={`${editMode ? "lg:flex-1 min-w-0" : "w-full"} relative`}>
                  {pdfLoading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-xl">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {pdfUrl ? (
                    <iframe
                      id="pdf-iframe"
                      src={pdfUrl}
                      className="w-full rounded-xl border border-gray-200 shadow"
                      style={{ height: editMode ? "70vh" : "85vh" }}
                      title="서류 초안 미리보기"
                    />
                  ) : (
                    <div className="w-full rounded-xl border border-gray-200 bg-white flex items-center justify-center"
                         style={{ height: editMode ? "70vh" : "85vh" }}>
                      <div className="text-center text-gray-400">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm">PDF 렌더링 중…</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 필드 편집 패널 (수정 모드) */}
                {editMode && (
                  <div className="no-print lg:w-80 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 shadow p-4 sticky top-20 max-h-[75vh] overflow-y-auto">
                      <p className="text-xs font-semibold text-gray-500 mb-3">
                        필드를 수정하면 PDF가 즉시 업데이트됩니다
                      </p>
                      <div className="space-y-3">
                        {Object.entries(displayFields).map(([key, value]) => {
                          const isLong = (value?.length ?? 0) > 30 || key === "특약사항";
                          return (
                            <div key={key} className="space-y-1">
                              <label className="block text-xs font-medium text-gray-600">
                                {FIELD_LABELS[key] ?? key}
                              </label>
                              {isLong ? (
                                <textarea
                                  value={value ?? ""}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
                                  rows={3}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 resize-y"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={value ?? ""}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
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
                  disabled={!pdfUrl}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-400 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
