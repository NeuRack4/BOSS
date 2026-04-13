"use client";

/**
 * 상가건물 임대차 표준계약서
 * 법무부 표준서식 — 임차건물 표시 테이블 + 계약내용 + 서명란 형식 그대로 구현
 */
import React from "react";

export type LeaseFields = Record<string, string | undefined>;

interface Props {
  fields: LeaseFields;
  editMode: boolean;
  onChange: (key: string, value: string) => void;
}

const TD  = "border border-gray-600 px-2 py-1.5 text-xs align-middle";
const TDL = "bg-gray-100 font-bold text-xs border border-gray-600 px-2 py-1.5 align-middle whitespace-nowrap";
const TH  = "bg-gray-200 font-bold text-xs text-center border border-gray-600 px-2 py-1";

function Field({ fk, f, editMode, onChange, placeholder, cls }: {
  fk: string; f: LeaseFields; editMode: boolean;
  onChange: (k: string, v: string) => void;
  placeholder?: string; cls?: string;
}) {
  const val = f[fk] ?? "";
  const empty = !val || val === "[직접 입력]";
  if (editMode) {
    return (
      <input
        type="text"
        value={val === "[직접 입력]" ? "" : val}
        onChange={(e) => onChange(fk, e.target.value)}
        placeholder={placeholder ?? "직접 입력"}
        className={`w-full px-1 py-0.5 text-xs border-none outline-none bg-yellow-50 ${cls ?? ""}`}
      />
    );
  }
  return (
    <span className={`text-xs ${empty ? "text-gray-300 italic" : "text-gray-900"} ${cls ?? ""}`}>
      {val || "[직접 입력]"}
    </span>
  );
}

function Blank({ fk, f, editMode, onChange, width = "w-24", placeholder }: {
  fk: string; f: LeaseFields; editMode: boolean;
  onChange: (k: string, v: string) => void;
  width?: string; placeholder?: string;
}) {
  const val = f[fk] ?? "";
  const empty = !val || val === "[직접 입력]";
  if (editMode) {
    return (
      <input
        type="text"
        value={val === "[직접 입력]" ? "" : val}
        onChange={(e) => onChange(fk, e.target.value)}
        placeholder={placeholder ?? "입력"}
        className={`${width} inline-block border-b-2 border-gray-600 bg-yellow-50 text-xs text-center outline-none px-1`}
      />
    );
  }
  return (
    <span className={`${width} inline-block border-b border-gray-600 text-xs text-center ${empty ? "text-gray-400" : "text-gray-900 font-medium"}`}>
      {val || "　　　　"}
    </span>
  );
}

function SignatureBlock({ label, fields: sf, editMode, onChange, prefixes }: {
  label: string;
  fields: LeaseFields;
  editMode: boolean;
  onChange: (k: string, v: string) => void;
  prefixes: { addr: string; id: string; tel: string; name: string };
}) {
  return (
    <table className="w-full border-collapse border border-gray-600 text-xs">
      <tbody>
        <tr>
          <td className={TDL} rowSpan={3} style={{ writingMode: "vertical-rl", width: "4%" }}>{label}</td>
          <td className={TDL} style={{ width: "10%" }}>주&nbsp;&nbsp;&nbsp;&nbsp;소</td>
          <td className={TD} colSpan={5}><Field fk={prefixes.addr} f={sf} editMode={editMode} onChange={onChange} /></td>
          <td className={TDL} rowSpan={2} style={{ width: "12%" }}>서명 또는<br />날인</td>
          <td className={TD} rowSpan={2} style={{ width: "10%" }}></td>
        </tr>
        <tr>
          <td className={TDL}>주민등록번호<br />(법인등록번호)</td>
          <td className={TD}><Field fk={prefixes.id} f={sf} editMode={editMode} onChange={onChange} /></td>
          <td className={TDL}>전&nbsp;&nbsp;&nbsp;&nbsp;화</td>
          <td className={TD}><Field fk={prefixes.tel} f={sf} editMode={editMode} onChange={onChange} /></td>
          <td className={TDL}>성&nbsp;&nbsp;&nbsp;&nbsp;명<br />(회사명)</td>
          <td className={TD}><Field fk={prefixes.name} f={sf} editMode={editMode} onChange={onChange} /></td>
        </tr>
        <tr>
          <td className={TDL}>대&nbsp;리&nbsp;인</td>
          <td className={TD} colSpan={2}>주소</td>
          <td className={TD}>주민등록번호</td>
          <td className={TD} colSpan={2}>성명</td>
          <td className={TD} colSpan={2}></td>
        </tr>
      </tbody>
    </table>
  );
}

export default function LeaseContractForm({ fields: f, editMode, onChange }: Props) {
  return (
    <div className="bg-white font-serif text-[11px] leading-relaxed" id="lease-form">

      {/* 체크박스 임대 유형 */}
      <div className="flex justify-end gap-4 text-[10px] mb-1">
        <span>■보증금 있는 월세&nbsp;□전세&nbsp;□월세</span>
      </div>

      {/* 제목 */}
      <h1 className="text-center text-xl font-black tracking-wide mb-1">상가건물 임대차 표준계약서</h1>
      <p className="text-center text-[10px] text-gray-500 mb-4">
        임대인과 임차인은 아래와 같이 임대차 계약을 체결한다
      </p>

      {/* 임차 상가건물의 표시 */}
      <div className="font-bold text-[12px] mb-1">[ 임차 상가건물의 표시 ]</div>
      <table className="w-full border-collapse border border-gray-600 mb-4">
        <tbody>
          <tr>
            <td className={TDL} style={{ width: "15%" }}>소&nbsp;&nbsp;재&nbsp;&nbsp;지</td>
            <td className={TD} colSpan={5}><Field fk="소재지" f={f} editMode={editMode} onChange={onChange} /></td>
          </tr>
          <tr>
            <td className={TDL}>토&nbsp;&nbsp;&nbsp;&nbsp;지</td>
            <td className={TDL} style={{ width: "8%" }}>지목</td>
            <td className={TD} style={{ width: "20%" }}><Field fk="토지_지목" f={f} editMode={editMode} onChange={onChange} /></td>
            <td className={TDL} style={{ width: "8%" }}>면적</td>
            <td className={TD}><Field fk="토지_면적_㎡" f={f} editMode={editMode} onChange={onChange} placeholder="㎡" /></td>
          </tr>
          <tr>
            <td className={TDL}>건&nbsp;&nbsp;&nbsp;&nbsp;물</td>
            <td className={TDL}>구조·용도</td>
            <td className={TD}><Field fk="건물_구조용도" f={f} editMode={editMode} onChange={onChange} /></td>
            <td className={TDL}>면적</td>
            <td className={TD}><Field fk="건물_면적_㎡" f={f} editMode={editMode} onChange={onChange} placeholder="㎡" /></td>
          </tr>
          <tr>
            <td className={TDL}>임차할부분</td>
            <td className={TDL} colSpan={2}></td>
            <td className={TDL}>면적</td>
            <td className={TD}><Field fk="임차할부분_면적_㎡" f={f} editMode={editMode} onChange={onChange} placeholder="㎡" /></td>
          </tr>
        </tbody>
      </table>

      {/* 계약내용 */}
      <div className="font-bold text-[12px] mb-2">[ 계약내용 ]</div>

      {/* 제1조 — 보증금과 차임 */}
      <p className="font-bold text-[12px] mb-1">
        <strong>제1조(보증금과 차임 및 관리비)</strong>&nbsp;
        <span className="font-normal text-[11px]">위 상가건물의 임대차에 관하여 임대인과 임차인은 합의에 의하여 보증금과 차임 및 관리비를 아래와 같이 지급하기로 한다.</span>
      </p>
      <table className="w-full border-collapse border border-gray-600 mb-2">
        <tbody>
          <tr>
            <td className={TH} style={{ width: "15%" }}>보&nbsp;&nbsp;증&nbsp;&nbsp;금</td>
            <td className={TD} colSpan={3}>금&nbsp;<Field fk="보증금" f={f} editMode={editMode} onChange={onChange} placeholder="원정" cls="inline w-40" />&nbsp;원정</td>
          </tr>
          <tr>
            <td className={TH}>계&nbsp;&nbsp;약&nbsp;&nbsp;금</td>
            <td className={TD}>금&nbsp;<Field fk="계약금" f={f} editMode={editMode} onChange={onChange} placeholder="원정" cls="inline w-28" />&nbsp;원정은 계약시에 지급하고 수령함.</td>
            <td className={TDL} style={{ width: "12%" }}>수령인</td>
            <td className={TD} style={{ width: "15%" }}></td>
          </tr>
          <tr>
            <td className={TH}>중&nbsp;&nbsp;도&nbsp;&nbsp;금</td>
            <td className={TD} colSpan={3}>
              금&nbsp;<Field fk="중도금" f={f} editMode={editMode} onChange={onChange} placeholder="원정" cls="inline w-28" />&nbsp;원정은&nbsp;
              <Blank fk="중도금_지급일" f={f} editMode={editMode} onChange={onChange} width="w-28" placeholder="YYYY-MM-DD" />에 지급
            </td>
          </tr>
          <tr>
            <td className={TH}>잔&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;금</td>
            <td className={TD} colSpan={3}>
              금&nbsp;<Field fk="잔금" f={f} editMode={editMode} onChange={onChange} placeholder="원정" cls="inline w-28" />&nbsp;원정은&nbsp;
              <Blank fk="잔금_지급일" f={f} editMode={editMode} onChange={onChange} width="w-28" placeholder="YYYY-MM-DD" />에 지급
            </td>
          </tr>
          <tr>
            <td className={TH}>차임(월세)</td>
            <td className={TD} colSpan={3}>
              금&nbsp;<Field fk="차임_월세" f={f} editMode={editMode} onChange={onChange} placeholder="원정" cls="inline w-28" />&nbsp;원정은 매월&nbsp;
              <Blank fk="차임_지급일" f={f} editMode={editMode} onChange={onChange} width="w-8" />
              일에 지급. 부가세&nbsp;
              {editMode ? (
                <select value={f["부가세_포함여부"] ?? "불포함"} onChange={(e) => onChange("부가세_포함여부", e.target.value)}
                  className="text-xs border-b border-gray-400 bg-yellow-50 outline-none">
                  <option>불포함</option><option>포함</option>
                </select>
              ) : (
                <span className="text-xs">{f["부가세_포함여부"] === "포함" ? "■포함 □불포함" : "□포함 ■불포함"}</span>
              )}
              <br />
              <span className="text-[10px] text-gray-500">입금계좌: </span>
              <Field fk="입금계좌" f={f} editMode={editMode} onChange={onChange} placeholder="은행명 계좌번호" cls="inline w-48" />
            </td>
          </tr>
          <tr>
            <td className={TH}>환산보증금</td>
            <td className={TD} colSpan={3}>금&nbsp;<Field fk="환산보증금" f={f} editMode={editMode} onChange={onChange} placeholder="원정" cls="inline w-40" />&nbsp;원정</td>
          </tr>
          <tr>
            <td className={TH}>관&nbsp;&nbsp;리&nbsp;&nbsp;비</td>
            <td className={TD} colSpan={3}>
              <span className="text-[10px] text-gray-500">(정액인 경우)</span>&nbsp;총액&nbsp;
              <Field fk="관리비" f={f} editMode={editMode} onChange={onChange} placeholder="원" cls="inline w-24" />
              원&nbsp;/&nbsp;
              <span className="text-[10px] text-gray-500">(정액이 아닌 경우) 관리비 항목 및 산정방식 기재</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 제2조 */}
      <p className="text-[11px] mb-2">
        <strong>제2조(임대차기간)</strong>&nbsp;임대인은 임차 상가건물을 임대차 목적대로 사용·수익할 수 있는 상태로&nbsp;
        <Blank fk="임대차기간_인도일" f={f} editMode={editMode} onChange={onChange} width="w-28" placeholder="YYYY-MM-DD" />
        까지 임차인에게 인도하고, 임대차기간은 인도일로부터&nbsp;
        <Blank fk="임대차기간_종료" f={f} editMode={editMode} onChange={onChange} width="w-28" placeholder="YYYY-MM-DD" />
        까지로 한다.
      </p>

      {/* 제3조 */}
      <p className="text-[11px] mb-2">
        <strong>제3조(임차목적)</strong>&nbsp;임차인은 임차 상가건물을&nbsp;
        <Blank fk="임차목적_업종" f={f} editMode={editMode} onChange={onChange} width="w-20" />
        (업종)을 위한 용도로 사용한다.
      </p>

      {/* 제4~12조 요약 (고정 텍스트) */}
      <div className="text-[10px] text-gray-600 border border-gray-300 rounded p-2 mb-3 bg-gray-50">
        <strong>제4조(사용·관리·수선)</strong> 임차인은 임대인의 동의 없이 임차 상가건물의 구조·용도 변경 및 전대나 임차권 양도를 할 수 없다. /&nbsp;
        <strong>제5조(계약의 해제)</strong> 임차인이 중도금 지급 전까지 임대인은 계약금의 배액을 상환하고, 임차인은 계약금을 포기하고 계약을 해제할 수 있다. /&nbsp;
        <strong>제8조(계약의 종료)</strong> 임대차기간 끝나기 6개월 전부터 임대차 종료 시까지 권리금 회수 방해 금지.
        <br />
        <span className="text-[9px] text-gray-400">※ 제6~12조는 상가건물임대차보호법 표준계약서의 해당 조문을 적용합니다.</span>
      </div>

      {/* 특약사항 */}
      <div className="mb-4">
        <p className="font-bold text-[12px] mb-1">[ 특약사항 ]</p>
        <div className="border border-gray-400 rounded min-h-[60px] p-2">
          {editMode ? (
            <textarea
              value={f["특약사항"] === "[직접 입력]" ? "" : (f["특약사항"] ?? "")}
              onChange={(e) => onChange("특약사항", e.target.value)}
              placeholder="특약사항을 입력하세요"
              className="w-full min-h-[56px] text-xs resize-none border-none outline-none bg-yellow-50"
            />
          ) : (
            <p className={`text-xs ${!f["특약사항"] || f["특약사항"] === "[직접 입력]" ? "text-gray-300 italic" : "text-gray-900"}`}>
              {f["특약사항"] || "[직접 입력]"}
            </p>
          )}
        </div>
      </div>

      {/* 서명날인 안내 */}
      <p className="text-[10px] text-gray-600 mb-3 text-center font-semibold">
        본 계약을 증명하기 위하여 계약 당사자가 이의 없음을 확인하고 각각 서명·날인 후 각각 1통씩 보관한다.
      </p>
      <p className="text-center text-[11px] mb-4">
        {f["계약체결일"]
          ? f["계약체결일"].replace(/-/g, ". ") + "."
          : "____년  ____월  ____일"}
      </p>

      {/* 임대인 서명 */}
      <div className="space-y-1">
        <SignatureBlock
          label="임대인"
          fields={f}
          editMode={editMode}
          onChange={onChange}
          prefixes={{ addr: "임대인_주소", id: "임대인_주민번호", tel: "임대인_전화", name: "임대인_성명" }}
        />
        <SignatureBlock
          label="임차인"
          fields={f}
          editMode={editMode}
          onChange={onChange}
          prefixes={{ addr: "임차인_주소", id: "임차인_주민번호", tel: "임차인_전화", name: "임차인_성명" }}
        />
      </div>

      {/* 면책 */}
      <div className="mt-4 text-[10px] text-red-600 border-t border-gray-200 pt-2">
        ※ 본 초안은 참고용입니다. 실제 계약 전 법무부 표준계약서 원본을 사용하고 전문가 확인을 권장합니다.
      </div>
    </div>
  );
}
