/**
 * 각 서류 PDF의 필드 좌표 정의
 * top / left / width / height 는 페이지 크기 대비 % (0–100)
 *
 * 측정 기준: pdfminer 텍스트 위치 → 빈칸 영역 추정
 * 필요 시 각 수치를 조정해 정확도를 높일 수 있습니다.
 */
import { FieldDef } from "./PdfOverlayForm";

/* ══════════════════════════════════════════════
   사업자등록 신청서  (단일 페이지, 595×841pt)
══════════════════════════════════════════════ */
export const BIZ_REG_FIELDS: FieldDef[] = [
  // ① 인적사항 ─ 상호 / 사업장 전화번호 행
  { key: "상호_단체명",         top: 22.5, left: 20.5, width: 27.5, height: 2.3 },
  { key: "사업장_전화번호",     top: 22.5, left: 64.3, width: 21.2, height: 2.3 },
  // 성명 / 주소지 전화번호 행
  { key: "성명_대표자",         top: 24.9, left: 20.5, width: 27.5, height: 2.3 },
  { key: "주소지_전화번호",     top: 24.9, left: 64.3, width: 21.2, height: 2.3 },
  // 주민등록번호 / 휴대전화 행
  { key: "주민등록번호",        top: 27.1, left: 20.5, width: 27.5, height: 2.3 },
  { key: "휴대전화번호",        top: 27.1, left: 62.1, width: 23.4, height: 2.3 },
  // 부동산등기용등록번호 / 팩스 행
  { key: "부동산등기용등록번호", top: 29.4, left: 32.0, width: 16.0, height: 2.3 },
  { key: "팩스번호",            top: 29.4, left: 60.4, width: 25.1, height: 2.3 },
  // 사업장 소재지
  { key: "사업장_소재지",       top: 31.6, left: 26.5, width: 43.0, height: 2.3 },

  // ② 사업장 현황 ─ 업종
  { key: "주업태",              top: 40.9, left: 15.2, width:  7.3, height: 2.3 },
  { key: "주종목",              top: 40.9, left: 26.1, width: 10.0, height: 2.3 },
  { key: "개업일",              top: 40.9, left: 43.5, width: 13.0, height: 2.3 },
  { key: "종업원수",            top: 40.9, left: 79.5, width:  5.5, height: 2.3 },
  { key: "주업종코드",          top: 40.9, left: 65.0, width: 12.5, height: 2.3 },
  { key: "부업태",              top: 44.9, left: 15.2, width:  7.3, height: 2.3 },
  { key: "부종목",              top: 44.9, left: 26.1, width: 10.0, height: 2.3 },
  { key: "부업종코드",          top: 44.9, left: 65.0, width: 12.5, height: 2.3 },

  // 사이버몰
  { key: "사이버몰_도메인명",   top: 47.5, left: 51.5, width: 34.0, height: 2.3 },

  // 사업장 구분 (자가 / 타가 면적)
  { key: "자가면적_㎡",         top: 53.6, left: 24.5, width:  3.5, height: 2.3 },
  { key: "타가면적_㎡",         top: 53.6, left: 30.5, width:  3.5, height: 2.3 },

  // 임대차 명세
  { key: "임대인_성명",         top: 53.1, left: 34.3, width:  6.3, height: 2.3 },
  { key: "임대인_사업자등록번호", top: 54.6, left: 41.5, width:  7.8, height: 2.3 },
  { key: "임대인_주민법인등록번호", top: 54.6, left: 50.9, width: 7.8, height: 2.3 },
  { key: "임대차계약기간",       top: 56.4, left: 59.4, width: 25.0, height: 2.3 },
  { key: "전세보증금",           top: 57.1, left: 68.0, width:  6.4, height: 2.3 },
  { key: "월세_차임",            top: 57.8, left: 77.3, width:  8.4, height: 2.3 },

  // 사업자금
  { key: "사업자금_자기자금",   top: 72.1, left: 33.5, width: 12.0, height: 2.3 },
  { key: "사업자금_타인자금",   top: 72.1, left: 57.5, width: 12.0, height: 2.3 },

  // 전자우편
  { key: "전자우편주소",        top: 79.0, left: 25.0, width: 35.0, height: 2.3 },

  // 신청일 / 관할세무서 (하단)
  { key: "신청일",              top: 83.5, left: 37.0, width: 22.0, height: 2.3 },
  { key: "관할_세무서",         top: 83.5, left: 63.5, width: 23.0, height: 2.3 },
];

/* ══════════════════════════════════════════════
   식품영업 신고서  (단일 페이지, 595×841pt)
══════════════════════════════════════════════ */
export const FOOD_BIZ_FIELDS: FieldDef[] = [
  // 신고인
  { key: "신고인_성명",         top: 15.8, left: 19.5, width: 33.0, height: 2.3 },
  { key: "신고인_주민등록번호", top: 15.8, left: 54.0, width: 33.0, height: 2.3 },
  { key: "신고인_주소",         top: 18.2, left: 19.5, width: 32.5, height: 2.3 },
  { key: "신고인_전화번호",     top: 18.2, left: 54.0, width: 33.0, height: 2.3 },

  // 신고사항
  { key: "명칭_상호",           top: 21.2, left: 29.0, width: 21.5, height: 2.3 },
  { key: "영업장_전화번호",     top: 21.2, left: 62.0, width: 25.0, height: 2.3 },

  // 영업장 면적
  { key: "영업장_내부면적_㎡",  top: 33.1, left: 44.0, width:  7.5, height: 2.3, placeholder: "0" },
  { key: "영업장_외부면적_㎡",  top: 33.1, left: 66.0, width:  7.5, height: 2.3, placeholder: "0" },

  // 영업장 소재지
  { key: "영업장_소재지",       top: 34.5, left: 30.5, width: 55.5, height: 2.3 },

  // 공동조리장 업소 정보
  { key: "공동조리장_업소정보", top: 53.0, left: 19.5, width: 67.0, height: 2.3 },

  // 신고일 (서명란)
  { key: "신고일",              top: 60.5, left: 63.0, width: 27.0, height: 2.3 },
];

/* ══════════════════════════════════════════════
   근로계약서 표준안  (2페이지, 595×841pt)
══════════════════════════════════════════════ */
export const EMP_CONTRACT_FIELDS: FieldDef[] = [
  // ─ Page 1 ─
  // 서두: 채용기관장 이름
  { key: "채용기관장_사업장명", page: 1, top: 17.1, left:  8.0, width: 20.0, height: 2.3 },

  // 인적사항 1행 (성명·성별·생년월일·근무형태)
  { key: "근로자_성명",         page: 1, top: 29.2, left: 20.3, width: 14.5, height: 5.8 },
  { key: "근로자_성별",         page: 1, top: 29.2, left: 40.8, width: 13.5, height: 5.8 },
  { key: "근로자_생년월일",     page: 1, top: 29.2, left: 61.0, width: 13.5, height: 5.8 },
  { key: "근무형태",            page: 1, top: 29.2, left: 81.8, width: 14.0, height: 5.8 },

  // 인적사항 2행 (연락처·주소)
  { key: "근로자_연락처",       page: 1, top: 35.2, left: 22.0, width: 33.0, height: 5.8 },
  { key: "근로자_주소",         page: 1, top: 35.2, left: 64.5, width: 31.5, height: 5.8 },

  // 제1조 계약기간
  { key: "계약기간_시작",       page: 1, top: 47.2, left: 28.5, width: 23.0, height: 2.3 },
  { key: "계약기간_종료",       page: 1, top: 47.2, left: 60.5, width: 23.0, height: 2.3 },

  // 제3조 근무장소·업무내용
  { key: "근무장소",            page: 1, top: 72.7, left: 37.5, width: 57.5, height: 2.3 },
  { key: "직종_업무내용",       page: 1, top: 75.1, left: 30.8, width: 64.0, height: 2.3 },

  // 제4조 근로시간 (1행)
  { key: "근무요일_시작",       page: 1, top: 82.0, left: 45.5, width:  5.0, height: 2.3 },
  { key: "근무요일_종료",       page: 1, top: 82.0, left: 55.0, width:  5.0, height: 2.3 },
  { key: "근무시작시간",        page: 1, top: 82.0, left: 64.0, width:  8.5, height: 2.3 },
  { key: "근무종료시간",        page: 1, top: 82.0, left: 77.5, width:  8.5, height: 2.3 },

  // 제4조 휴게시간 (2행)
  { key: "휴게시작시간",        page: 1, top: 84.4, left: 33.5, width:  8.5, height: 2.3 },
  { key: "휴게종료시간",        page: 1, top: 84.4, left: 46.5, width:  8.5, height: 2.3 },

  // ─ Page 2 ─
  // 제6조 보수 테이블
  { key: "기본급",              page: 2, top: 68.5, left: 34.0, width: 22.0, height: 2.3 },
  { key: "급식비",              page: 2, top: 68.5, left: 73.0, width: 22.0, height: 2.3 },

  // 임금지급일 / 계좌
  { key: "임금지급일",          page: 2, top: 83.8, left: 42.5, width:  4.0, height: 2.3 },
  { key: "은행명",              page: 2, top: 90.4, left: 37.0, width:  9.0, height: 2.3 },
  { key: "계좌번호",            page: 2, top: 90.4, left: 50.5, width: 38.0, height: 2.3 },
];

/* ══════════════════════════════════════════════
   상가건물 임대차 표준계약서  (3페이지, 595×841pt)
══════════════════════════════════════════════ */
export const LEASE_CONTRACT_FIELDS: FieldDef[] = [
  // ─ Page 1 ─
  // 임차 상가건물의 표시
  { key: "소재지",              page: 1, top: 19.0, left: 19.0, width: 73.0, height: 2.3 },
  { key: "토지_지목",           page: 1, top: 21.0, left: 27.5, width: 29.5, height: 2.3 },
  { key: "토지_면적_㎡",        page: 1, top: 21.0, left: 66.5, width: 23.5, height: 2.3 },
  { key: "건물_구조용도",       page: 1, top: 23.0, left: 27.5, width: 29.5, height: 2.3 },
  { key: "건물_면적_㎡",        page: 1, top: 23.0, left: 66.5, width: 23.5, height: 2.3 },
  { key: "임차할부분_면적_㎡",  page: 1, top: 25.0, left: 66.5, width: 23.5, height: 2.3 },

  // 계약내용 (보증금·차임)
  { key: "보증금",              page: 1, top: 36.0, left: 17.0, width: 52.0, height: 2.3 },
  { key: "계약금",              page: 1, top: 38.0, left: 18.5, width: 35.0, height: 2.3 },
  { key: "중도금",              page: 1, top: 40.0, left: 18.5, width: 35.0, height: 2.3 },
  { key: "중도금_지급일",       page: 1, top: 40.0, left: 57.5, width: 32.0, height: 2.3 },
  { key: "잔금",                page: 1, top: 42.0, left: 18.5, width: 35.0, height: 2.3 },
  { key: "잔금_지급일",         page: 1, top: 42.0, left: 57.5, width: 32.0, height: 2.3 },
  { key: "차임_월세",           page: 1, top: 44.0, left: 18.5, width: 35.0, height: 2.3 },
  { key: "차임_지급일",         page: 1, top: 44.0, left: 57.5, width: 32.0, height: 2.3 },
  { key: "입금계좌",            page: 1, top: 45.8, left: 30.0, width: 52.0, height: 2.3 },
  { key: "환산보증금",          page: 1, top: 47.9, left: 19.0, width: 55.0, height: 2.3 },

  // 제2조 임대차기간
  { key: "임대차기간_인도일",   page: 1, top: 79.0, left: 18.5, width: 30.0, height: 2.3 },
  { key: "임대차기간_종료",     page: 1, top: 79.0, left: 73.0, width: 20.0, height: 2.3 },

  // 제3조 임차목적(업종)
  { key: "임차목적_업종",       page: 1, top: 81.3, left: 55.0, width: 17.0, height: 2.3 },

  // ─ Page 2 ─
  // 특약사항 (넓은 텍스트 영역)
  { key: "특약사항",            page: 2, top: 59.0, left:  7.8, width: 84.0, height: 32.0, multiline: true },

  // ─ Page 3 ─
  // 임대인 정보
  { key: "임대인_주소",         page: 3, top:  5.8, left: 23.5, width: 62.0, height: 2.3 },
  { key: "임대인_주민번호",     page: 3, top: 10.4, left: 24.0, width: 43.5, height: 2.3 },
  { key: "임대인_성명",         page: 3, top: 10.4, left: 82.0, width: 12.5, height: 2.3 },
  { key: "임대인_전화",         page: 3, top: 11.1, left: 62.0, width: 26.0, height: 2.3 },

  // 임차인 정보
  { key: "임차인_주소",         page: 3, top: 20.3, left: 23.5, width: 62.0, height: 2.3 },
  { key: "임차인_주민번호",     page: 3, top: 24.9, left: 24.0, width: 43.5, height: 2.3 },
  { key: "임차인_성명",         page: 3, top: 24.9, left: 82.0, width: 12.5, height: 2.3 },
  { key: "임차인_전화",         page: 3, top: 25.7, left: 62.0, width: 26.0, height: 2.3 },

  // 계약체결일
  { key: "계약체결일",          page: 3, top:  3.0, left: 35.0, width: 30.0, height: 2.3 },
];
