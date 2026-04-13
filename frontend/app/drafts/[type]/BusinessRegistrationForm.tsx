"use client";

/**
 * 사업자등록 신청서(개인사업자용)
 * 부가가치세법 시행규칙 [별지 제4호서식] <개정 2026. 3. 20.> 레이아웃 그대로 구현
 */

import React from "react";

/* ─────────────────────────── 타입 ─────────────────────────── */
// Korean identifiers in TS interface cause SWC parse errors in some Next.js versions.
// Use plain Record type instead.
export type BizRegFields = Record<string, string | undefined>;

interface Props {
  fields: BizRegFields;
  editMode: boolean;
  onChange: (key: string, value: string) => void;
}

/* ─────────────────────────── 헬퍼 컴포넌트 ─────────────────────────── */
function Cell({
  value,
  editMode,
  fieldKey,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  editMode: boolean;
  fieldKey: string;
  onChange: (key: string, value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const empty = !value || value === "[직접 입력]";
  if (editMode) {
    return (
      <input
        type="text"
        value={value === "[직접 입력]" ? "" : value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={placeholder ?? "직접 입력"}
        className={`w-full h-full px-1 py-0.5 text-xs border-none outline-none bg-yellow-50 ${className ?? ""}`}
      />
    );
  }
  return (
    <span className={`text-xs ${empty ? "text-gray-300 italic" : "text-gray-900"} ${className ?? ""}`}>
      {value || "[직접 입력]"}
    </span>
  );
}

/** [여] [부] 체크박스 */
function YN({
  value,
  editMode,
  fieldKey,
  onChange,
}: {
  value: string;
  editMode: boolean;
  fieldKey: string;
  onChange: (key: string, value: string) => void;
}) {
  const isYes = value === "여" || value === "예" || value === "신청" || value === "있음" || value === "해당";
  if (editMode) {
    return (
      <label className="flex items-center gap-1 cursor-pointer select-none text-xs">
        <input
          type="checkbox"
          checked={isYes}
          onChange={(e) => onChange(fieldKey, e.target.checked ? "여" : "부")}
          className="w-3 h-3"
        />
        <span>[여] [부]</span>
      </label>
    );
  }
  return (
    <span className="text-xs">
      {isYes ? "☑여 □부" : "□여 ☑부"}
    </span>
  );
}

/* ─────────────────────────── 공통 스타일 ─────────────────────────── */
const TH = "bg-gray-100 text-xs font-semibold text-gray-700 text-center border border-gray-400 px-1 py-1 align-middle whitespace-nowrap";
const TD = "border border-gray-400 px-1.5 py-1 text-xs align-middle";
const TDL = "bg-gray-50 text-xs font-semibold text-gray-700 text-center border border-gray-400 px-1 py-1 align-middle whitespace-nowrap";

/* ─────────────────────────── 메인 컴포넌트 ─────────────────────────── */
export default function BusinessRegistrationForm({ fields, editMode, onChange }: Props) {
  const f = (key: string) => fields[key] ?? "";

  return (
    <div className="bg-white font-sans text-[11px]" id="biz-reg-form">
      {/* 서식 번호 */}
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>■ 부가가치세법 시행규칙 [별지 제4호서식] &lt;개정 2026. 3. 20.&gt;</span>
        <span className="text-gray-400">(앞쪽)</span>
      </div>

      {/* 접수번호 / 제목 / 처리기간 */}
      <table className="w-full border-collapse border border-gray-400 mb-0">
        <tbody>
          <tr>
            <td className={`${TDL} w-24 text-left`}>접수번호</td>
            <td className={TD} style={{ width: "30%" }}></td>
            <td className="border border-gray-400 px-2 py-2 text-center font-black text-base" style={{ width: "40%" }}>
              사업자등록 신청서
              <div className="text-[10px] font-normal text-gray-600">(개인사업자용)</div>
            </td>
            <td className={`${TDL} w-20`}>처리기간</td>
            <td className={`${TD} text-center w-24`}>즉시</td>
          </tr>
        </tbody>
      </table>

      {/* ① 인적사항 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <colgroup>
          <col style={{ width: "12%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "18%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={5} className={`${TH} text-left px-2`}>① 인적사항</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TDL}>상호(단체명)</td>
            <td className={TD}>
              <Cell value={f("상호_단체명")} editMode={editMode} fieldKey="상호_단체명" onChange={onChange} />
            </td>
            <td className={TDL} rowSpan={4} style={{ writingMode: "vertical-rl", letterSpacing: "0.15em" }}>
              연&nbsp;락&nbsp;처
            </td>
            <td className={TDL}>사업장 전화번호</td>
            <td className={TD}>
              <Cell value={f("사업장_전화번호")} editMode={editMode} fieldKey="사업장_전화번호" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL}>성명(대표자)</td>
            <td className={TD}>
              <Cell value={f("성명_대표자")} editMode={editMode} fieldKey="성명_대표자" onChange={onChange} />
            </td>
            <td className={TDL}>휴대전화번호</td>
            <td className={TD}>
              <Cell value={f("휴대전화번호")} editMode={editMode} fieldKey="휴대전화번호" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL}>주민등록번호</td>
            <td className={TD}>
              <Cell value={f("주민등록번호")} editMode={editMode} fieldKey="주민등록번호" onChange={onChange} />
            </td>
            <td className={TDL}>주소지 전화번호</td>
            <td className={TD}>
              <Cell value={f("주소지_전화번호")} editMode={editMode} fieldKey="주소지_전화번호" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL} style={{ fontSize: "10px" }}>부동산등기용<br />등록번호</td>
            <td className={TD}>
              <Cell value={f("부동산등기용등록번호")} editMode={editMode} fieldKey="부동산등기용등록번호" onChange={onChange} placeholder="해당자만 입력" />
            </td>
            <td className={TDL}>팩스번호</td>
            <td className={TD}>
              <Cell value={f("팩스번호")} editMode={editMode} fieldKey="팩스번호" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL}>사업장(단체)<br />소재지</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("사업장_소재지")} editMode={editMode} fieldKey="사업장_소재지" onChange={onChange} className="w-full" />
            </td>
            <td className={TDL}>자동정정신청</td>
            <td className={TD}>
              <YN value={f("자동정정신청") || "부"} editMode={editMode} fieldKey="자동정정신청" onChange={onChange} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ② 사업장 현황 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <thead>
          <tr>
            <th colSpan={8} className={`${TH} text-left px-2`}>② 사업장 현황</th>
          </tr>
        </thead>
        <tbody>
          {/* 업종 헤더 행 */}
          <tr>
            <td className={TDL} rowSpan={3} style={{ width: "8%" }}>업종</td>
            <td className={TH} style={{ width: "10%" }}>구분</td>
            <td className={TH} style={{ width: "18%" }}>업태</td>
            <td className={TH} style={{ width: "22%" }}>종목</td>
            <td className={TH} style={{ width: "12%" }}>업종코드</td>
            <td className={TDL} style={{ width: "10%" }}>개업일</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("개업일")} editMode={editMode} fieldKey="개업일" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL}>주업종</td>
            <td className={TD}>
              <Cell value={f("주업태")} editMode={editMode} fieldKey="주업태" onChange={onChange} />
            </td>
            <td className={TD}>
              <Cell value={f("주종목")} editMode={editMode} fieldKey="주종목" onChange={onChange} />
            </td>
            <td className={TD}>
              <Cell value={f("주업종코드")} editMode={editMode} fieldKey="주업종코드" onChange={onChange} />
            </td>
            <td className={TDL}>종업원수</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("종업원수")} editMode={editMode} fieldKey="종업원수" onChange={onChange} placeholder="명" />
            </td>
          </tr>
          <tr>
            <td className={TDL}>부업종</td>
            <td className={TD}>
              <Cell value={f("부업태")} editMode={editMode} fieldKey="부업태" onChange={onChange} />
            </td>
            <td className={TD}>
              <Cell value={f("부종목")} editMode={editMode} fieldKey="부종목" onChange={onChange} />
            </td>
            <td className={TD}>
              <Cell value={f("부업종코드")} editMode={editMode} fieldKey="부업종코드" onChange={onChange} />
            </td>
            <td className={TDL} colSpan={3}></td>
          </tr>

          {/* 사이버몰 */}
          <tr>
            <td className={TDL} colSpan={2}>사이버몰 도메인명</td>
            <td className={TD} colSpan={6}>
              <Cell value={f("사이버몰_도메인명")} editMode={editMode} fieldKey="사이버몰_도메인명" onChange={onChange} placeholder="해당 없음" />
            </td>
          </tr>

          {/* 사업장 구분 */}
          <tr>
            <td className={TDL} rowSpan={4}>사업장<br />구분</td>
            <td className={TDL} colSpan={2}>자가면적</td>
            <td className={TD}>
              <Cell value={f("자가면적_㎡")} editMode={editMode} fieldKey="자가면적_㎡" onChange={onChange} placeholder="㎡" />
            </td>
            <td className={TDL} colSpan={2}>타가면적</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("타가면적_㎡")} editMode={editMode} fieldKey="타가면적_㎡" onChange={onChange} placeholder="㎡" />
            </td>
          </tr>
          <tr>
            <td className={TDL} colSpan={7} style={{ fontSize: "10px" }}>임대차명세 (타가인 경우만 작성)</td>
          </tr>
          <tr>
            <td className={TDL}>임대인 성명</td>
            <td className={TD}>
              <Cell value={f("임대인_성명")} editMode={editMode} fieldKey="임대인_성명" onChange={onChange} />
            </td>
            <td className={TDL} style={{ fontSize: "10px" }}>사업자등록번호</td>
            <td className={TD}>
              <Cell value={f("임대인_사업자등록번호")} editMode={editMode} fieldKey="임대인_사업자등록번호" onChange={onChange} />
            </td>
            <td className={TDL} style={{ fontSize: "10px" }}>주민(법인)번호</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("임대인_주민법인등록번호")} editMode={editMode} fieldKey="임대인_주민법인등록번호" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL}>임대차<br />계약기간</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("임대차계약기간")} editMode={editMode} fieldKey="임대차계약기간" onChange={onChange} placeholder="예: 2025-01-01 ~ 2027-12-31" />
            </td>
            <td className={TDL}>전세보증금</td>
            <td className={TD}>
              <Cell value={f("전세보증금")} editMode={editMode} fieldKey="전세보증금" onChange={onChange} placeholder="원" />
            </td>
            <td className={TDL}>월세(차임)</td>
            <td className={TD}>
              <Cell value={f("월세_차임")} editMode={editMode} fieldKey="월세_차임" onChange={onChange} placeholder="원" />
            </td>
          </tr>

          {/* 투자조합 */}
          <tr>
            <td className={TDL} colSpan={2} style={{ fontSize: "10px" }}>투자조합 출자 여부</td>
            <td className={TD} colSpan={5}>
              <YN value={f("투자조합_출자여부") || "부"} editMode={editMode} fieldKey="투자조합_출자여부" onChange={onChange} />
            </td>
          </tr>

          {/* 허가사업 */}
          <tr>
            <td className={TDL} colSpan={2}>허가(등록·신고)사업 여부</td>
            <td className={TD} colSpan={5}>
              <YN value={f("허가사업_여부") || "부"} editMode={editMode} fieldKey="허가사업_여부" onChange={onChange} />
            </td>
          </tr>

          {/* 사업자금 */}
          <tr>
            <td className={TDL} colSpan={2}>사업자금</td>
            <td className={TDL}>자기자금</td>
            <td className={TD}>
              <Cell value={f("사업자금_자기자금")} editMode={editMode} fieldKey="사업자금_자기자금" onChange={onChange} placeholder="원" />
            </td>
            <td className={TDL}>타인자금</td>
            <td className={TD} colSpan={2}>
              <Cell value={f("사업자금_타인자금")} editMode={editMode} fieldKey="사업자금_타인자금" onChange={onChange} placeholder="원" />
            </td>
          </tr>

          {/* 간이과세 */}
          <tr>
            <td className={TDL} colSpan={2}>간이과세</td>
            <td className={TDL} style={{ fontSize: "10px" }}>간이과세 신고</td>
            <td className={TD}>
              <YN value={f("간이과세_신고여부") || "부"} editMode={editMode} fieldKey="간이과세_신고여부" onChange={onChange} />
            </td>
            <td className={TDL} style={{ fontSize: "10px" }}>포기신고</td>
            <td className={TD} colSpan={2}>
              <YN value={f("간이과세_포기신고여부") || "부"} editMode={editMode} fieldKey="간이과세_포기신고여부" onChange={onChange} />
            </td>
          </tr>

          {/* 전자우편 */}
          <tr>
            <td className={TDL} colSpan={2}>전자우편 주소</td>
            <td className={TD} colSpan={5}>
              <Cell value={f("전자우편주소")} editMode={editMode} fieldKey="전자우편주소" onChange={onChange} />
            </td>
          </tr>

          {/* 그밖의 신청사항 */}
          <tr>
            <td className={TDL} rowSpan={2}>그 밖의<br />신청사항</td>
            <td className={TDL} style={{ fontSize: "10px" }}>확정일자 신청</td>
            <td className={TD}>
              <YN value={f("확정일자_신청여부") || "부"} editMode={editMode} fieldKey="확정일자_신청여부" onChange={onChange} />
            </td>
            <td className={TDL} style={{ fontSize: "10px" }}>공동사업자 신청</td>
            <td className={TD}>
              <YN value={f("공동사업자_신청여부") || "부"} editMode={editMode} fieldKey="공동사업자_신청여부" onChange={onChange} />
            </td>
            <td className={TDL} style={{ fontSize: "10px", whiteSpace: "normal" }}>사업장 外<br />송달장소 신청</td>
            <td className={TD}>
              <YN value={f("사업장외_송달장소_신청여부") || "부"} editMode={editMode} fieldKey="사업장외_송달장소_신청여부" onChange={onChange} />
            </td>
          </tr>
          <tr>
            <td className={TDL} style={{ fontSize: "10px" }}>현금영수증 가입신청</td>
            <td className={TD} colSpan={5}>
              <YN value={f("현금영수증_가입신청여부") || "부"} editMode={editMode} fieldKey="현금영수증_가입신청여부" onChange={onChange} />
            </td>
          </tr>

          {/* 신탁재산 */}
          <tr>
            <td className={TDL} colSpan={2}>신탁재산 여부</td>
            <td className={TD} colSpan={5}>
              <YN value={f("신탁재산_여부") || "부"} editMode={editMode} fieldKey="신탁재산_여부" onChange={onChange} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 서명란 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <tbody>
          <tr>
            <td className={TD} colSpan={4} style={{ height: "44px" }}>
              <div className="flex justify-center items-end gap-8 py-1 text-xs">
                <span>
                  {f("신청일") ? f("신청일")!.replace(/-/g, ". ") : "____년  ____월  ____일"}
                </span>
                <span>
                  신청인&nbsp;&nbsp;{f("성명_대표자") || "____________"}&nbsp;&nbsp;(서명 또는 인)
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td className={TDL} style={{ width: "14%" }}>제출처</td>
            <td className={TD} colSpan={3}>
              {f("관할_세무서") ? `${f("관할_세무서")} 귀하` : "○○세무서장 귀하"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 첨부서류 안내 */}
      <div className="border border-gray-400 border-t-0 bg-gray-50 px-3 py-1.5 text-[10px] text-gray-600">
        <strong>첨부서류:</strong> 사업허가·등록·신고증 사본(해당자), 임대차계약서 사본(사업장을 임차한 경우), 동업계약서(공동사업자인 경우) 등
        <br />
        <strong className="text-red-600">※ 본 초안은 참고용입니다. 실제 제출 전 세무서에서 원본 서식을 사용하여 주시기 바랍니다.</strong>
      </div>
    </div>
  );
}
