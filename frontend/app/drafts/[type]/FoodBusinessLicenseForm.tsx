"use client";

/**
 * 식품 영업 신고서
 * 식품위생법 시행규칙 [별지 제37호서식] <개정 2026. 1. 2.> 레이아웃 구현
 */

import React from "react";

export type FoodBizFields = Record<string, string | undefined>;

interface Props {
  fields: FoodBizFields;
  editMode: boolean;
  onChange: (key: string, value: string) => void;
}

/* ─── 공통 스타일 ─── */
const TD = "border border-gray-400 px-1.5 py-1 text-xs align-middle";
const TDL =
  "bg-gray-50 text-xs font-semibold text-gray-700 border border-gray-400 px-1.5 py-1 align-middle whitespace-nowrap";

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
  onChange: (k: string, v: string) => void;
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
        className={`w-full px-1 py-0.5 text-xs border-none outline-none bg-yellow-50 ${className ?? ""}`}
      />
    );
  }
  return (
    <span
      className={`text-xs ${empty ? "text-gray-300 italic" : "text-gray-900"} ${className ?? ""}`}
    >
      {value || "[직접 입력]"}
    </span>
  );
}

/** 업종 체크박스 */
function BizTypeCheck({
  label,
  checked,
  editMode,
  fieldKey,
  onChange,
}: {
  label: string;
  checked: boolean;
  editMode: boolean;
  fieldKey: string;
  onChange: (k: string, v: string) => void;
}) {
  if (editMode) {
    return (
      <label className="flex items-center gap-0.5 cursor-pointer text-[10px] mr-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(fieldKey, e.target.checked ? "해당" : "")}
          className="w-3 h-3"
        />
        <span>{label}</span>
      </label>
    );
  }
  return (
    <span className="text-[10px] mr-3">
      {checked ? "☑" : "□"} {label}
    </span>
  );
}

/** 해당/미해당 체크 */
function YesNo({
  value,
  editMode,
  fieldKey,
  onChange,
}: {
  value: string;
  editMode: boolean;
  fieldKey: string;
  onChange: (k: string, v: string) => void;
}) {
  const isYes = value === "해당" || value === "여";
  if (editMode) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input
            type="radio"
            checked={isYes}
            onChange={() => onChange(fieldKey, "해당")}
            className="w-3 h-3"
          />
          <span>해당</span>
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input
            type="radio"
            checked={!isYes}
            onChange={() => onChange(fieldKey, "미해당")}
            className="w-3 h-3"
          />
          <span>미해당</span>
        </label>
      </span>
    );
  }
  return (
    <span className="text-xs">
      {isYes ? "☑ 해당  □ 미해당" : "□ 해당  ☑ 미해당"}
    </span>
  );
}

const BIZ_TYPES = [
  ["즉석판매제조·가공업", "집단급식소 식품판매업", "일반음식점영업"],
  ["식품운반업", "기타식품판매업", "위탁급식영업"],
  ["식품소분업", "식품냉동·냉장업", "제과점영업"],
  ["식용얼음판매업", "용기·포장지제조업", ""],
  ["식품자동판매기영업", "옹기류제조업", ""],
  ["유통전문판매업", "", "휴게음식점영업"],
];

const WATER_TYPES = [
  "수돗물",
  "먹는샘물",
  "먹는염지하수",
  "지하수",
  "먹는해양심층수",
  "그 밖의 먹는물",
];

export default function FoodBusinessLicenseForm({
  fields,
  editMode,
  onChange,
}: Props) {
  const f = (key: string) => fields[key] ?? "";

  return (
    <div className="bg-white font-sans text-[11px]" id="food-biz-form">
      {/* 서식 번호 */}
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>
          ■ 식품위생법 시행규칙 [별지 제37호서식] &lt;개정 2026. 1. 2.&gt;
        </span>
        <span className="text-gray-400">(앞쪽)</span>
      </div>

      {/* 제목 */}
      <div className="text-center font-black text-xl py-2 border border-gray-400">
        식품 영업 신고서
      </div>
      <div className="text-[10px] text-gray-500 border-x border-gray-400 px-2 py-0.5">
        ※ 뒤쪽의 구비서류와 신고안내, 유의사항을 읽고 작성하시기 바라며, [ ]에는
        해당되는 곳에 √ 표를 합니다.
      </div>

      {/* 접수번호 행 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <tbody>
          <tr>
            <td className={`${TDL} text-center`} style={{ width: "20%" }}>
              접수번호
            </td>
            <td className={TD} style={{ width: "30%" }}></td>
            <td className={`${TDL} text-center`} style={{ width: "10%" }}>
              접수일
            </td>
            <td className={TD} style={{ width: "15%" }}></td>
            <td className={`${TDL} text-center`} style={{ width: "10%" }}>
              처리기간
            </td>
            <td className={`${TD} text-center`} style={{ width: "15%" }}>
              즉시
            </td>
          </tr>
        </tbody>
      </table>

      {/* 신고인 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "42%" }} />
          <col style={{ width: "18%" }} />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td className={TDL} rowSpan={2}>
              신고인
            </td>
            <td className={TD}>
              <div className="text-[10px] text-gray-500 mb-0.5">
                성명(법인은 법인 명칭 및 대표자의 성명)
              </div>
              <Cell
                value={f("신고인_성명")}
                editMode={editMode}
                fieldKey="신고인_성명"
                onChange={onChange}
              />
            </td>
            <td className={TDL}>주민(법인)등록번호</td>
            <td className={TD}>
              <Cell
                value={f("신고인_주민등록번호")}
                editMode={editMode}
                fieldKey="신고인_주민등록번호"
                onChange={onChange}
              />
            </td>
          </tr>
          <tr>
            <td className={TD}>
              <div className="text-[10px] text-gray-500 mb-0.5">
                주소(법인은 주된 사무소의 소재지)
              </div>
              <Cell
                value={f("신고인_주소")}
                editMode={editMode}
                fieldKey="신고인_주소"
                onChange={onChange}
              />
            </td>
            <td className={TDL}>전화번호</td>
            <td className={TD}>
              <Cell
                value={f("신고인_전화번호")}
                editMode={editMode}
                fieldKey="신고인_전화번호"
                onChange={onChange}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 신고사항 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col />
        </colgroup>
        <tbody>
          {/* 명칭/전화번호 */}
          <tr>
            <td className={TDL} rowSpan={12}>
              신고사항
            </td>
            <td className={TD}>
              <div className="flex gap-4">
                <div className="flex-1">
                  <span className="text-[10px] text-gray-500">
                    명칭(상호)&nbsp;&nbsp;
                  </span>
                  <Cell
                    value={f("명칭_상호")}
                    editMode={editMode}
                    fieldKey="명칭_상호"
                    onChange={onChange}
                    className="inline"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    전화번호
                  </span>
                  <Cell
                    value={f("영업장_전화번호")}
                    editMode={editMode}
                    fieldKey="영업장_전화번호"
                    onChange={onChange}
                  />
                </div>
              </div>
            </td>
          </tr>

          {/* 영업의 종류 */}
          <tr>
            <td className={TD}>
              <div className="text-[10px] text-gray-600 font-semibold mb-1">
                영업의 종류
              </div>
              {BIZ_TYPES.map((row, ri) => (
                <div key={ri} className="flex flex-wrap mb-0.5">
                  {row.map((label, ci) =>
                    label ? (
                      <BizTypeCheck
                        key={ci}
                        label={label}
                        checked={f(`영업종류_${label}`) === "해당"}
                        editMode={editMode}
                        fieldKey={`영업종류_${label}`}
                        onChange={onChange}
                      />
                    ) : (
                      <span key={ci} className="flex-1" />
                    ),
                  )}
                </div>
              ))}
            </td>
          </tr>

          {/* 영업장 면적 */}
          <tr>
            <td className={TD}>
              <span className="text-[10px] text-gray-600">
                영업장의 면적: 건물 내부 장소{" "}
              </span>
              {editMode ? (
                <input
                  type="text"
                  value={f("영업장_내부면적_㎡")}
                  onChange={(e) =>
                    onChange("영업장_내부면적_㎡", e.target.value)
                  }
                  className="w-16 border-b border-gray-400 text-xs text-center outline-none bg-yellow-50 mx-1"
                  placeholder="㎡"
                />
              ) : (
                <span className="text-xs font-semibold mx-1">
                  {f("영업장_내부면적_㎡") || "___"} ㎡
                </span>
              )}
              <span className="text-[10px] text-gray-600">건물 외부 장소 </span>
              {editMode ? (
                <input
                  type="text"
                  value={f("영업장_외부면적_㎡")}
                  onChange={(e) =>
                    onChange("영업장_외부면적_㎡", e.target.value)
                  }
                  className="w-16 border-b border-gray-400 text-xs text-center outline-none bg-yellow-50 mx-1"
                  placeholder="㎡"
                />
              ) : (
                <span className="text-xs font-semibold mx-1">
                  {f("영업장_외부면적_㎡") || "___"} ㎡
                </span>
              )}
            </td>
          </tr>

          {/* 영업장 소재지 */}
          <tr>
            <td className={TD}>
              <span className="text-[10px] text-gray-600">
                영업장의 소재지:{" "}
              </span>
              <Cell
                value={f("영업장_소재지")}
                editMode={editMode}
                fieldKey="영업장_소재지"
                onChange={onChange}
                className="inline"
              />
            </td>
          </tr>

          {/* 식품용수 */}
          <tr>
            <td className={TD}>
              <div className="text-[10px] text-gray-600 mb-0.5">
                식품용수의 종류
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {WATER_TYPES.map((wt) => (
                  <BizTypeCheck
                    key={wt}
                    label={wt}
                    checked={f(`식품용수_${wt}`) === "해당"}
                    editMode={editMode}
                    fieldKey={`식품용수_${wt}`}
                    onChange={onChange}
                  />
                ))}
              </div>
            </td>
          </tr>

          {/* 공유주방 */}
          <tr>
            <td className={TD}>
              <span className="text-[10px] text-gray-600 mr-2">
                공유주방의 사용 여부
              </span>
              <YesNo
                value={f("공유주방_사용여부") || "미해당"}
                editMode={editMode}
                fieldKey="공유주방_사용여부"
                onChange={onChange}
              />
            </td>
          </tr>

          {/* 공동조리장 */}
          <tr>
            <td className={TD}>
              <span className="text-[10px] text-gray-600 mr-2">
                공동조리장 이용 여부
              </span>
              <YesNo
                value={f("공동조리장_이용여부") || "미해당"}
                editMode={editMode}
                fieldKey="공동조리장_이용여부"
                onChange={onChange}
              />
              <div className="mt-0.5 text-[10px] text-gray-500">
                공동조리장을 함께 이용하는 영업장의 업소명, 영업의 종류 및
                소재지:&nbsp;
                <Cell
                  value={f("공동조리장_업소정보")}
                  editMode={editMode}
                  fieldKey="공동조리장_업소정보"
                  onChange={onChange}
                  placeholder="해당 없음"
                  className="inline"
                />
              </div>
            </td>
          </tr>

          {/* 식품자동판매기 */}
          <tr>
            <td className={TD}>
              <span className="text-[10px] text-gray-600 mr-2">
                식품자동판매기의 자동적인 혼합·처리 기능 여부
              </span>
              <YesNo
                value={f("식품자동판매기_기능여부") || "미해당"}
                editMode={editMode}
                fieldKey="식품자동판매기_기능여부"
                onChange={onChange}
              />
            </td>
          </tr>

          {/* 반려동물 */}
          <tr>
            <td className={TD}>
              <span className="text-[10px] text-gray-600 mr-2">
                반려동물(개, 고양이로 한정한다) 출입 여부
              </span>
              <YesNo
                value={f("반려동물_출입여부") || "미해당"}
                editMode={editMode}
                fieldKey="반려동물_출입여부"
                onChange={onChange}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 서명란 */}
      <table className="w-full border-collapse border border-gray-400 border-t-0">
        <tbody>
          <tr>
            <td className={TD} style={{ height: "48px" }}>
              <div className="text-[10px] text-gray-600 mb-1">
                「식품위생법」 제37조제4항 및 같은 법 시행규칙 제42조제1항에
                따라 위와 같이 영업을 신고합니다.
              </div>
              <div className="flex justify-end items-end gap-8 text-xs">
                <span>
                  {f("신고일")
                    ? f("신고일")!.replace(/-/g, ". ")
                    : "____년  ____월  ____일"}
                </span>
                <span>
                  신고인&nbsp;&nbsp;{f("신고인_성명") || "____________"}
                  &nbsp;&nbsp;(서명 또는 인)
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td className={TD}>
              <div className="text-center font-bold text-sm py-1">
                특별자치시장·특별자치도지사·시장·군수·구청장&nbsp;귀하
              </div>
              <div className="text-[10px] text-gray-500 text-center">
                {f("신고기관") ? `(${f("신고기관")})` : "(마포구청장)"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 행정정보 동의 */}
      <div className="border border-gray-400 border-t-0 bg-gray-50 px-3 py-1.5 text-[10px] text-gray-600">
        <strong>행정정보 공동이용 동의서:</strong> 본인은 이 건 업무처리와
        관련하여 담당 공무원이 행정정보의 공동이용을 통하여 담당 공무원
        확인사항을 확인하는 것에 동의합니다.
        <br />
        <strong className="text-red-600">
          ※ 본 초안은 참고용입니다. 실제 신고 전 관할 구청 위생과에서 원본
          서식을 사용하여 주시기 바랍니다.
        </strong>
      </div>
    </div>
  );
}
