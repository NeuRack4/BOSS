"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ReviewResult, {
  type ReviewResult as ReviewResultType,
} from "@/components/doc-review/ReviewResult";
import ReviewHistory from "@/components/doc-review/ReviewHistory";
import { Upload, FileText, X } from "lucide-react";

type Tab = "new" | "history";
type DocType = "계약서" | "제안서" | "기타";
type UserRole = "갑(고용인/발주자)" | "을(피고용인/수주자)";

const DOC_TYPES: DocType[] = ["계약서", "제안서", "기타"];
const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "갑(고용인/발주자)", label: "갑 (고용인/발주자)" },
  { value: "을(피고용인/수주자)", label: "을 (피고용인/수주자)" },
];
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ACCEPTED_TYPES = ".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp";

export default function DocReviewPage() {
  const [tab, setTab] = useState<Tab>("new");
  const [userId, setUserId] = useState<string | null>(null);

  // 새 검토 폼 상태
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("계약서");
  const [userRole, setUserRole] = useState<UserRole>("을(피고용인/수주자)");
  const [showTextInput, setShowTextInput] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResultType | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setText("");
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setText("");
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!file && !text.trim()) {
      setError("파일을 업로드하거나 텍스트를 입력해주세요.");
      return;
    }

    const resolvedTitle =
      title.trim() ||
      (file ? file.name : text.trim().split("\n")[0].slice(0, 60));

    setLoading(true);
    setError(null);
    setResult(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    try {
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", resolvedTitle);
        formData.append("doc_type", docType);
        formData.append("user_role", userRole);
        res = await fetch(`${API_BASE}/doc-review/analyze/file`, {
          method: "POST",
          headers: { "X-User-Id": user.id },
          body: formData,
        });
      } else {
        res = await fetch(`${API_BASE}/doc-review/analyze`, {
          method: "POST",
          headers: { "X-User-Id": user.id, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: resolvedTitle,
            doc_type: docType,
            user_role: userRole,
            content: text.trim(),
          }),
        });
      }

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? "분석 중 오류가 발생했습니다.");
      }

      const data = await res.json();
      setResult(data.review_result ?? data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "백엔드 서버에 연결할 수 없습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle("");
    setDocType("계약서");
    setFile(null);
    setText("");
    setResult(null);
    setError(null);
    setShowTextInput(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">서류 검토</h1>
        <p className="text-sm text-gray-500 mt-1">
          계약서·제안서를 AI가 분석해 위험 조항을 짚어드립니다
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
        {(["new", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "new" ? "새 검토" : "이력"}
          </button>
        ))}
      </div>

      {/* ── 새 검토 탭 ── */}
      {tab === "new" && (
        <>
          <div className="glass-card rounded-xl p-6 space-y-5">
            {/* 직접 입력 텍스트 영역 — 버튼 클릭 시만 노출 */}
            {showTextInput && (
              <div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="계약서 내용을 여기에 붙여넣기 하세요... (HWP는 내용 복사 후 붙여넣기)"
                  rows={8}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50/30 text-sm text-gray-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 resize-none"
                />
              </div>
            )}

            {/* 제목 (선택) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                제목{" "}
                <span className="text-gray-400 font-normal">
                  (선택 — 작성하지 않을 시 파일명/첫 줄 사용)
                </span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 홍대 카페 임대차 계약서"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-300 bg-white text-sm text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
              />
            </div>

            {/* 문서 유형 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                문서 유형
              </label>
              <div className="flex gap-2">
                {DOC_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocType(type)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors
                      ${
                        docType === type
                          ? "bg-brand-50 border-brand-500/40 text-brand-600"
                          : "border-surface-300 text-gray-500 hover:border-brand-300"
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 내 입장 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                내 입장
              </label>
              <div className="flex gap-2">
                {USER_ROLES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUserRole(value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors
                      ${
                        userRole === value
                          ? "bg-brand-50 border-brand-500/40 text-brand-600"
                          : "border-surface-300 text-gray-500 hover:border-brand-300"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 파일 업로드 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-500">
                  파일 업로드
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowTextInput((v) => !v);
                    if (!showTextInput) setFile(null);
                    else setText("");
                  }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors
                    ${
                      showTextInput
                        ? "bg-amber-50 border-amber-400/60 text-amber-600"
                        : "border-surface-300 text-gray-400 hover:border-amber-300 hover:text-amber-500"
                    }`}
                >
                  직접 입력 (HWP 포함)
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-brand-200 bg-brand-50/50">
                  <FileText size={18} className="text-brand-500 shrink-0" />
                  <span className="text-sm text-gray-800 flex-1 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors
                    ${
                      dragOver
                        ? "border-brand-500 bg-brand-50/50"
                        : "border-surface-300 hover:border-brand-300 hover:bg-surface-100"
                    }`}
                >
                  <Upload
                    size={24}
                    className={dragOver ? "text-brand-500" : "text-gray-300"}
                  />
                  <p className="text-sm text-gray-500 text-center">
                    드래그하거나 클릭해서 파일을 업로드하세요
                  </p>
                  <p className="text-xs text-gray-400">
                    PDF, DOCX, 이미지(JPG, PNG) 지원
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all glow-blue disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "AI 분석 중..." : "✦ AI 분석 시작"}
            </button>
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="glass-card rounded-xl p-8 text-center border-brand-500/20">
              <div className="inline-flex items-center gap-3 text-brand-500">
                <span className="animate-pulse text-2xl">✦</span>
                <p className="text-sm font-medium">
                  AI가 서류를 분석하고 위험 조항을 검토하고 있습니다...
                </p>
              </div>
            </div>
          )}

          {/* 분석 결과 */}
          {result && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">분석 결과</h2>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  새 검토 시작
                </button>
              </div>
              <ReviewResult result={result} />
            </div>
          )}
        </>
      )}

      {/* ── 이력 탭 ── */}
      {tab === "history" && userId && <ReviewHistory userId={userId} />}
      {tab === "history" && !userId && (
        <div className="glass-card rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">로그인이 필요합니다.</p>
        </div>
      )}
    </div>
  );
}
