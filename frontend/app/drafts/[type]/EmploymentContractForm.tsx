"use client";

/**
 * 근로계약서 (표준안)
 * [별지 제3호 서식] — 인적사항 테이블 + 조문 본문 형식 그대로 구현
 */
import React from "react";

export type EmpFields = Record<string, string | undefined>;

interface Props {
  fields: EmpFields;
  editMode: boolean;
  onChange: (key: string, value: string) => void;
}

const TD = "border border-gray-600 px-2 py-1 text-xs align-middle";
const TDL =
  "bg-gray-100 font-semibold text-xs text-center border border-gray-600 px-2 py-1 align-middle whitespace-nowrap";

function Field({
  fk,
  f,
  editMode,
  onChange,
  placeholder,
  inline,
  cls,
}: {
  fk: string;
  f: EmpFields;
  editMode: boolean;
  onChange: (k: string, v: string) => void;
  placeholder?: string;
  inline?: boolean;
  cls?: string;
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
        className={`${inline ? "inline w-32" : "w-full"} px-1 py-0.5 text-xs border-b border-gray-400 outline-none bg-yellow-50 ${cls ?? ""}`}
      />
    );
  }
  return (
    <span
      className={`text-xs ${empty ? "text-gray-300 italic" : "text-gray-900"} ${cls ?? ""}`}
    >
      {val || "[직접 입력]"}
    </span>
  );
}

/** 빈칸(밑줄) 표시 */
function Blank({
  fk,
  f,
  editMode,
  onChange,
  width = "w-24",
  placeholder,
}: {
  fk: string;
  f: EmpFields;
  editMode: boolean;
  onChange: (k: string, v: string) => void;
  width?: string;
  placeholder?: string;
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
    <span
      className={`${width} inline-block border-b border-gray-600 text-xs text-center ${empty ? "text-gray-400" : "text-gray-900 font-medium"}`}
    >
      {val || "　　　　"}
    </span>
  );
}

export default function EmploymentContractForm({
  fields: f,
  editMode,
  onChange,
}: Props) {
  return (
    <div
      className="bg-white font-serif text-[12px] leading-relaxed"
      id="employment-form"
    >
      {/* 서식 번호 */}
      <div className="text-[10px] text-gray-500 mb-2">[별지 제3호 서식]</div>

      {/* 제목 */}
      <h1 className="text-center text-2xl font-black tracking-widest mb-4">
        근 로 계 약 서 (표준안)
      </h1>

      {/* 본문 서두 */}
      <p className="text-[11px] text-gray-800 mb-4 indent-4">
        <Blank
          fk="채용기관장_사업장명"
          f={f}
          editMode={editMode}
          onChange={onChange}
          width="w-32"
        />
        (이하 "채용기관장"이라 함)과&nbsp;
        <Blank
          fk="근로자_성명"
          f={f}
          editMode={editMode}
          onChange={onChange}
          width="w-24"
        />
        (이하 "근로자"라 함)는 다음과 같이 근로계약을 체결하고 이를 성실히
        준수할 것을 약정한다.
      </p>

      {/* 근로자 인적사항 */}
      <div className="font-bold text-sm mb-2 mt-4">
        &lt; 근로자 인적사항 &gt;
      </div>
      <table className="w-full border-collapse border border-gray-600 mb-6">
        <tbody>
          <tr>
            <td className={TDL} style={{ width: "20%" }}>
              성&nbsp;&nbsp;&nbsp;&nbsp;명
            </td>
            <td className={TD}>
              <Field
                fk="근로자_성명"
                f={f}
                editMode={editMode}
                onChange={onChange}
              />
            </td>
            <td className={TDL} style={{ width: "15%" }}>
              성&nbsp;&nbsp;&nbsp;&nbsp;별
            </td>
            <td className={TD}>
              <Field
                fk="근로자_성별"
                f={f}
                editMode={editMode}
                onChange={onChange}
                placeholder="남/여"
              />
            </td>
            <td className={TDL} style={{ width: "18%" }}>
              생년월일
            </td>
            <td className={TD}>
              <Field
                fk="근로자_생년월일"
                f={f}
                editMode={editMode}
                onChange={onChange}
                placeholder="YYYY-MM-DD"
              />
            </td>
            <td className={TDL} style={{ width: "15%" }}>
              근무형태
            </td>
            <td className={TD}>
              <Field
                fk="근무형태"
                f={f}
                editMode={editMode}
                onChange={onChange}
              />
            </td>
          </tr>
          <tr>
            <td className={TDL}>연&nbsp;&nbsp;락&nbsp;&nbsp;처</td>
            <td className={TD}>
              <Field
                fk="근로자_연락처"
                f={f}
                editMode={editMode}
                onChange={onChange}
              />
            </td>
            <td className={TDL} colSpan={2}>
              주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소
            </td>
            <td className={TD} colSpan={4}>
              <Field
                fk="근로자_주소"
                f={f}
                editMode={editMode}
                onChange={onChange}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 제1조 */}
      <div className="mb-3">
        <p className="font-bold text-[12px] mb-1">제1조 [근로계약기간]</p>
        <p className="ml-4 text-[11px]">
          근로계약기간은&nbsp;
          <Blank
            fk="계약기간_시작"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-28"
            placeholder="YYYY-MM-DD"
          />
          부터&nbsp;
          <Blank
            fk="계약기간_종료"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-28"
            placeholder="YYYY-MM-DD"
          />
          으로 한다.
          <br />
          <span className="text-gray-500">
            (계약기간 만료와 동시에 근로계약은 종료되며, 재계약갱신권은 인정되지
            아니한다.)
          </span>
        </p>
      </div>

      {/* 제2조 */}
      <div className="mb-3">
        <p className="font-bold text-[12px] mb-1">제2조 [시용기간]</p>
        <p className="ml-4 text-[11px] text-gray-700">
          ① 근로계약일로부터 3개월간은 시용기간으로 하며 채용기관장은 시용기간
          중 근로자의 근무태도, 품성, 업무수행능력 등을 종합 평가하여 본 채용
          여부를 결정한다.
          <br />② 시용기간 중에라도 언제든지 전 1항의 요건에 부적합하다고
          판단되는 경우, 채용기관장은 본 채용을 거부 또는 고용을 종료할 수 있다.
        </p>
      </div>

      {/* 제3조 */}
      <div className="mb-3">
        <p className="font-bold text-[12px] mb-1">
          제3조 [근무장소(부서) 및 업무내용]
        </p>
        <p className="ml-4 text-[11px]">
          ① 근무장소(소속부서) :&nbsp;
          <Blank
            fk="근무장소"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-48"
          />
          <br />
          ② 직종(업무내용) :&nbsp;
          <Blank
            fk="직종_업무내용"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-64"
          />
        </p>
      </div>

      {/* 제4조 */}
      <div className="mb-3">
        <p className="font-bold text-[12px] mb-1">
          제4조 [근로시간 및 휴게시간]
        </p>
        <p className="ml-4 text-[11px]">
          ① 근로자의 근로시간은 매주&nbsp;
          <Blank
            fk="근무요일_시작"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-8"
          />
          요일부터&nbsp;
          <Blank
            fk="근무요일_종료"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-8"
          />
          요일,&nbsp;
          <Blank
            fk="근무시작시간"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-14"
          />
          부터&nbsp;
          <Blank
            fk="근무종료시간"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-14"
          />
          까지 근무 (휴게시간&nbsp;
          <Blank
            fk="휴게시작시간"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-14"
          />
          ~
          <Blank
            fk="휴게종료시간"
            f={f}
            editMode={editMode}
            onChange={onChange}
            width="w-14"
          />
          )를 원칙으로 한다.
          <br />
          <span className="text-gray-600 ml-2">
            ② 소정근로시간은 1일 8시간, 1주 40시간의 범위로 하며 근로시간
            4시간에 대하여 30분, 8시간에 대하여 1시간 이상을 휴게시간으로
            부여한다.
          </span>
        </p>
      </div>

      {/* 제5조 */}
      <div className="mb-3">
        <p className="font-bold text-[12px] mb-1">제5조 [휴일 및 휴가]</p>
        <p className="ml-4 text-[11px] text-gray-700">
          ① 1주 소정근로일을 개근한 경우 「근로기준법」 제55조에 따른
          주휴일(매주 일요일), 「근로자의 날 제정에 관한 법률」에 따른 근로자의
          날(5월 1일)과 「관공서의 공휴일에 관한 규정」에 따른 공휴일(제1호
          일요일 제외)은 유급휴일로 한다.
          <br />② 연차유급휴가 및 생리휴가는 「근로기준법」을, 그 밖의 휴가는
          관리규정을 따른다.
        </p>
      </div>

      {/* 제6조 */}
      <div className="mb-3">
        <p className="font-bold text-[12px] mb-1">제6조 [보수]</p>
        <p className="ml-4 text-[11px] text-gray-700 mb-2">
          보수는 월급제로 매월 보수표에 따른 기본급 및 기타 수당으로 구성된다.
        </p>
        <table
          className="w-full border-collapse border border-gray-600 text-[11px] mb-2 ml-4"
          style={{ width: "calc(100% - 1rem)" }}
        >
          <tbody>
            <tr>
              <td className={TDL} rowSpan={3} style={{ width: "10%" }}>
                기본
                <br />
                항목
              </td>
              <td className={TDL} style={{ width: "20%" }}>
                기본급
              </td>
              <td className={TD}>
                <Field
                  fk="기본급"
                  f={f}
                  editMode={editMode}
                  onChange={onChange}
                  placeholder="월 원"
                />
              </td>
              <td className={TDL} style={{ width: "15%" }}>
                정액 급식비
              </td>
              <td className={TD}>
                <Field
                  fk="급식비"
                  f={f}
                  editMode={editMode}
                  onChange={onChange}
                />
              </td>
            </tr>
            <tr>
              <td className={TDL}>가족수당</td>
              <td className={TD}></td>
              <td className={TDL}>자격증수당</td>
              <td className={TD}></td>
            </tr>
            <tr>
              <td className={TDL}>정근수당 추가가산금</td>
              <td className={TD}></td>
              <td className={TDL}>정근수당 가산금</td>
              <td className={TD}></td>
            </tr>
          </tbody>
        </table>
        <div className="ml-4 text-[11px] space-y-0.5">
          <p>
            ○ 임금지급일 : 보수는 매월&nbsp;
            <Blank
              fk="임금지급일"
              f={f}
              editMode={editMode}
              onChange={onChange}
              width="w-8"
            />
            일(첫날부터 말일까지 산정)에 지급한다.
          </p>
          <p>○ 임금지급방법 : 보수는 근로자 명의의 예금계좌에 입금한다.</p>
          <p className="ml-2">
            *예금계좌번호 :&nbsp;
            <Blank
              fk="은행명"
              f={f}
              editMode={editMode}
              onChange={onChange}
              width="w-20"
            />
            은행,&nbsp;
            <Blank
              fk="계좌번호"
              f={f}
              editMode={editMode}
              onChange={onChange}
              width="w-40"
            />
          </p>
        </div>
      </div>

      {/* 제7조 */}
      <div className="mb-4">
        <p className="font-bold text-[12px] mb-1">제7조 [기타사항]</p>
        <p className="ml-4 text-[11px] text-gray-700">
          ① 이 계약서에 명시되지 않은 사항은 노동관계법령에서 정하는 바에
          따른다.
          <br />
          ② 계약서는 2부 작성하여 채용기관장과 근로자가 서명 날인하여 서로 1부씩
          보관한다.
          <br />
          &nbsp;&nbsp;&nbsp;* 상기 사항에 대하여 근로자 수령 확인 여부 : 수령 □,
          미수령 □
        </p>
      </div>

      {/* 서명란 */}
      <div className="border-t-2 border-gray-600 pt-4">
        <div className="text-center text-[12px] mb-6">
          {f["계약체결일"]
            ? f["계약체결일"]
                .replace(/-/g, "년 ")
                .replace(/(\d+)년 (\d+) (\d+)/, "$1년 $2월 $3일")
            : "20____년  ____월  ____일"}
        </div>
        <div className="flex justify-around text-[12px]">
          <div className="text-center">
            <p className="mb-8">
              (채용기관장)&nbsp;&nbsp;
              <span className="border-b border-gray-600 inline-block w-32 text-center">
                {f["채용기관장_성명"] || ""}
              </span>
            </p>
            <p className="text-[10px] text-gray-500">㊞</p>
          </div>
          <div className="text-center">
            <p className="mb-8">
              (근로자)&nbsp;&nbsp;
              <span className="border-b border-gray-600 inline-block w-32 text-center">
                {f["근로자_성명"] || ""}
              </span>
            </p>
            <p className="text-[10px] text-gray-500">㊞</p>
          </div>
        </div>
      </div>

      {/* 면책 */}
      <div className="mt-4 text-[10px] text-red-600 border-t border-gray-200 pt-2">
        ※ 본 초안은 참고용입니다. 실제 계약 체결 전 고용노동부 표준 서식을
        사용하고 전문가 확인을 권장합니다.
      </div>
    </div>
  );
}
