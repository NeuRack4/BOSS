import { APP_VERSION } from "@/lib/version";

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black gradient-text">BOSS</span>
          <span className="text-gray-400 text-sm">
            Business Operations Support System
          </span>
        </div>

        <p className="text-gray-400 text-xs text-center md:text-right max-w-md">
          ⚠️ 본 서비스가 제공하는 세금·법률·계약 관련 정보는 참고용이며, 실제
          신고 및 계약 전 반드시 전문가 확인을 권장합니다.
        </p>
      </div>

      <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
        <p className="text-gray-300 text-xs">
          © 2026 BOSS · AI 심화과정 조별과제
        </p>
        <p className="text-gray-300 text-xs">v{APP_VERSION} · MIT License</p>
      </div>
    </footer>
  );
}
