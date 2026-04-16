import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-100">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-xl font-black gradient-text">
            BOSS
          </Link>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">개인정보 처리방침</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-black text-gray-900 mb-2">개인정보 처리방침</h1>
        <p className="text-sm text-gray-400 mb-10">시행일: 2026년 4월 16일</p>

        <div className="space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제1조 (개인정보의 처리 목적)</h2>
            <p className="mb-3">
              BOSS(이하 "서비스")는 다음의 목적을 위해 개인정보를 처리합니다.
              처리한 개인정보는 다음의 목적 이외의 용도로는 사용되지 않습니다.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>회원 가입 및 서비스 이용에 따른 본인 확인</li>
              <li>창업자 프로필 기반 AI 맞춤 서비스 제공</li>
              <li>지원사업 매칭, 세금 기한 알림 등 개인화 서비스 제공</li>
              <li>서비스 개선을 위한 통계 분석 (개인을 식별할 수 없는 형태)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제2조 (처리하는 개인정보 항목)</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">구분</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">항목</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">수집 방법</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">필수</td>
                    <td className="border border-gray-200 px-3 py-2">이메일 주소, 비밀번호(암호화 저장)</td>
                    <td className="border border-gray-200 px-3 py-2">회원가입 시</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-medium">선택</td>
                    <td className="border border-gray-200 px-3 py-2">성명, 연락처, 생년월일, 사업장 주소, 업종, 사업자번호, 매출 데이터</td>
                    <td className="border border-gray-200 px-3 py-2">온보딩·프로필 입력 시</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">자동수집</td>
                    <td className="border border-gray-200 px-3 py-2">서비스 이용 기록, 접속 로그</td>
                    <td className="border border-gray-200 px-3 py-2">서비스 이용 중</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제3조 (개인정보의 보유 및 이용 기간)</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>회원 탈퇴 시까지 보유하며, 탈퇴 즉시 지체 없이 파기합니다.</li>
              <li>단, 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-500">
                  <li>전자상거래 소비자 보호 관련 법률: 5년</li>
                  <li>접속 로그: 3개월</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제4조 (개인정보의 제3자 제공)</h2>
            <p>
              서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.
              다만, 이용자의 사전 동의가 있거나 법령에 의해 요청되는 경우에는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제5조 (개인정보 처리 위탁)</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">수탁 업체</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Supabase Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">회원 인증 및 데이터베이스 운영</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">Anthropic PBC</td>
                    <td className="border border-gray-200 px-3 py-2">AI 챗봇 응답 생성 (Claude API)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Vercel Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">프론트엔드 호스팅</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제6조 (이용자의 권리)</h2>
            <p className="mb-3">이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-2">
              <li>개인정보 열람 요청</li>
              <li>개인정보 정정·삭제 요청</li>
              <li>개인정보 처리 정지 요청</li>
              <li>회원 탈퇴 (대시보드 → 마이페이지에서 직접 처리)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제7조 (개인정보의 파기)</h2>
            <p>
              서비스는 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 개인정보를 파기합니다.
              전자적 파일은 복구 불가능한 방법으로 영구 삭제하며,
              출력물 등 물리적 정보는 파쇄 또는 소각합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제8조 (개인정보 보호책임자)</h2>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p>개인정보 처리에 관한 업무를 총괄하고, 관련 불만 및 피해 구제를 처리합니다.</p>
              <ul className="mt-2 space-y-1">
                <li>담당: BOSS 서비스 운영팀</li>
                <li>이메일: <a href="mailto:amydreamsu@gmail.com" className="text-brand-500 hover:underline">amydreamsu@gmail.com</a></li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">제9조 (쿠키 및 세션 스토리지)</h2>
            <p>
              서비스는 챗봇 대화 내역 유지를 위해 세션 스토리지(sessionStorage)를 사용합니다.
              세션 스토리지에 저장된 데이터는 브라우저 탭 종료 시 자동 삭제되며,
              서버로 전송되지 않습니다.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex items-center justify-between">
          <Link href="/terms" className="text-sm text-brand-500 hover:underline font-medium">
            이용약관 보기 →
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
