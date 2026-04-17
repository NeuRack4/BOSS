import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-100">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-xl font-black gradient-text">
            BOSS
          </Link>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">이용약관</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-black text-gray-900 mb-2">이용약관</h1>
        <p className="text-sm text-gray-400 mb-10">시행일: 2026년 4월 16일</p>

        <div className="space-y-10 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제1조 (목적)
            </h2>
            <p>
              본 약관은 BOSS(Business Operations Support System, 이하
              "서비스")가 제공하는 AI 기반 창업 지원 서비스의 이용과 관련하여
              서비스와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로
              합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제2조 (정의)
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                "서비스"란 BOSS가 제공하는 AI 챗봇, 서류 초안 생성, 지원사업
                매칭, 입지 분석 등 일체의 기능을 말합니다.
              </li>
              <li>
                "이용자"란 본 약관에 동의하고 서비스를 이용하는 개인을 말합니다.
              </li>
              <li>
                "콘텐츠"란 서비스 내에서 생성·제공되는 텍스트, 서류 초안, 분석
                결과 등 일체의 정보를 말합니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제3조 (약관의 효력 및 변경)
            </h2>
            <p>
              본 약관은 서비스 화면에 게시하거나 이용자에게 공지함으로써 효력이
              발생합니다. 서비스는 관계 법령에 위배되지 않는 범위에서 본 약관을
              변경할 수 있으며, 변경 시 최소 7일 전 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제4조 (서비스 이용)
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                서비스는 서울 F&amp;B 소상공인의 창업 준비를 지원하는 목적으로
                제공됩니다.
              </li>
              <li>
                이용자는 서비스를 상업적 재판매, 무단 크롤링, 자동화된 대량 요청
                등의 방법으로 이용할 수 없습니다.
              </li>
              <li>
                서비스는 안정적인 운영을 위해 사전 통보 없이 서비스 일부를
                수정하거나 중단할 수 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제5조 (AI 생성 콘텐츠의 한계)
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <p className="text-amber-800 font-medium">
                ⚠️ 본 서비스의 AI가 생성하는 세금·법률·계약 관련 정보는
                참고용이며, 실제 신고 및 계약 전 반드시 전문가(세무사, 변호사,
                노무사 등)의 확인을 권장합니다.
              </p>
            </div>
            <p>
              서비스는 법령 DB 기반 답변을 제공하나, AI 특성상 오류가 포함될 수
              있습니다. AI 생성 콘텐츠를 근거로 한 의사결정의 결과에 대해
              서비스는 법적 책임을 지지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제6조 (이용자의 의무)
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                이용자는 타인의 정보를 도용하거나 허위 정보를 등록해서는 안
                됩니다.
              </li>
              <li>
                이용자는 서비스의 정상적인 운영을 방해하는 행위를 해서는 안
                됩니다.
              </li>
              <li>이용자는 관련 법령 및 본 약관을 준수해야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제7조 (책임의 제한)
            </h2>
            <p>
              서비스는 천재지변, 불가항력, 서비스 점검, 이용자의 귀책 사유로
              인한 손해에 대해 책임을 지지 않습니다. 서비스의 무료 제공 특성상
              이용자가 서비스 이용으로 입은 손해에 대한 배상 책임은 관련 법령이
              허용하는 최대 범위 내에서 제한됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">
              제8조 (분쟁 해결)
            </h2>
            <p>
              서비스 이용과 관련한 분쟁은 대한민국 법률에 따라 처리하며, 분쟁
              발생 시 서울중앙지방법원을 전속 관할 법원으로 합니다.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex items-center justify-between">
          <Link
            href="/privacy"
            className="text-sm text-brand-500 hover:underline font-medium"
          >
            개인정보 처리방침 보기 →
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
