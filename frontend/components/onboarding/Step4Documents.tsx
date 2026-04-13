"use client";

import { FormData, DocumentType } from "./types";

interface Props {
  data: FormData;
  onChange: (field: keyof FormData, value: string | boolean | string[]) => void;
}

const ALL_DOCUMENTS: {
  value: DocumentType;
  title: string;
  desc: string;
  tag: string;
  icon: string;
  recommended?: boolean;
}[] = [
  {
    value: "business-registration",
    title: "사업자등록 신청서 초안",
    desc: "국세청 서식 기반. 입력 정보가 자동 매핑됩니다.",
    tag: "창업 셋업",
    icon: "📋",
    recommended: true,
  },
  {
    value: "food-business-license",
    title: "휴게음식점 영업신고서 초안",
    desc: "식품의약품안전처 서식. 사업장 면적·주소 자동 입력.",
    tag: "창업 셋업",
    icon: "🍽️",
    recommended: true,
  },
  {
    value: "location-analysis",
    title: "입지 분석 리포트",
    desc: "골목상권 서울 데이터 기반 생존율 시뮬레이션.",
    tag: "입지",
    icon: "📍",
  },
  {
    value: "subsidy-application",
    title: "예비창업패키지 신청서 초안",
    desc: "기업마당 공고 연동. 마감 D-5 선제 알림 포함.",
    tag: "지원사업",
    icon: "💰",
  },
  {
    value: "employment-contract",
    title: "표준 근로계약서 초안",
    desc: "고용노동부 서식. 주휴수당 자동 계산 포함.",
    tag: "채용",
    icon: "📝",
  },
  {
    value: "lease-contract",
    title: "표준 임대차계약서 체크리스트",
    desc: "법제처 서식 기반 검토 포인트 자동 생성.",
    tag: "계약",
    icon: "🏠",
  },
];

export default function Step4Documents({ data, onChange }: Props) {
  const toggle = (value: DocumentType) => {
    const current = data.selectedDocuments;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange("selectedDocuments", next);
  };

  const selectAll = () => {
    onChange(
      "selectedDocuments",
      ALL_DOCUMENTS.map((d) => d.value),
    );
  };

  const clearAll = () => {
    onChange("selectedDocuments", []);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">생성할 서류 선택</h2>
        <p className="text-sm text-gray-500 mt-1">
          선택한 서류의 초안을 BOSS가 먼저 준비합니다. 언제든 추가 요청
          가능합니다.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          <span className="font-bold text-brand-600">
            {data.selectedDocuments.length}
          </span>
          개 선택됨
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-brand-600 font-medium hover:underline"
          >
            전체 선택
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-400 font-medium hover:underline"
          >
            전체 해제
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_DOCUMENTS.map((doc) => {
          const selected = data.selectedDocuments.includes(doc.value);
          return (
            <button
              key={doc.value}
              type="button"
              onClick={() => toggle(doc.value)}
              className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${
                selected
                  ? "border-brand-500 bg-brand-50 glow-blue"
                  : "border-surface-300 bg-white hover:border-brand-300"
              }`}
            >
              {doc.recommended && (
                <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500 text-white">
                  추천
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="text-2xl">{doc.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        selected
                          ? "bg-brand-100 text-brand-700"
                          : "bg-surface-200 text-gray-500"
                      }`}
                    >
                      {doc.tag}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-800 mt-1">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {doc.desc}
                  </p>
                </div>
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center transition-all ${
                    selected
                      ? "border-brand-500 bg-brand-500"
                      : "border-gray-300"
                  }`}
                >
                  {selected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {data.selectedDocuments.length > 0 && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex gap-3">
          <svg
            className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-xs font-semibold text-green-700">
              {data.selectedDocuments.length}개 서류 초안을 준비합니다
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              BOSS가 입력하신 정보를 바탕으로 초안을 생성합니다. 검토 후 제출만
              하시면 됩니다.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center leading-relaxed">
        본 서비스가 생성하는 서류 초안은 참고용이며, 실제 신고 및 제출 전 반드시
        전문가 확인을 권장합니다.
      </p>
    </div>
  );
}
