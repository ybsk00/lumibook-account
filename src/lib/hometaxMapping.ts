export interface HometaxField {
  field: number;
  accountCodes: string[];
  label: string;
  negative?: boolean;
  computed?: string; // "sum" for subtotals
}

// 표준대차대조표 — 자산의 부
export const BS_ASSET_MAPPING: HometaxField[] = [
  { field: 1, accountCodes: ["101"], label: "현금" },
  { field: 2, accountCodes: ["102", "103"], label: "예금" },
  { field: 3, accountCodes: ["108"], label: "외상매출금" },
  { field: 4, accountCodes: ["109"], label: "받을어음" },
  { field: 5, accountCodes: ["110"], label: "미수금" },
  { field: 6, accountCodes: ["111"], label: "선급금" },
  { field: 7, accountCodes: ["112"], label: "선급비용" },
  { field: 8, accountCodes: ["113"], label: "부가세대급금" },
  { field: 9, accountCodes: ["114", "115"], label: "가지급금·단기대여금" },
  { field: 10, accountCodes: ["120"], label: "재고자산" },
  { field: 11, accountCodes: [], label: "유동자산 소계", computed: "sum" },
  { field: 20, accountCodes: ["151"], label: "토지" },
  { field: 21, accountCodes: ["152"], label: "건물" },
  { field: 22, accountCodes: ["153", "154"], label: "구축물·기계장치" },
  { field: 23, accountCodes: ["155", "156"], label: "차량·비품" },
  { field: 24, accountCodes: ["157"], label: "감가상각누계액", negative: true },
  { field: 25, accountCodes: ["160", "161"], label: "무형자산" },
  { field: 26, accountCodes: ["170"], label: "투자자산" },
  { field: 27, accountCodes: ["172"], label: "임차보증금" },
  { field: 28, accountCodes: [], label: "비유동자산 소계", computed: "sum" },
  { field: 29, accountCodes: [], label: "자산총계", computed: "sum" },
];

// 표준대차대조표 — 부채의 부
export const BS_LIABILITY_MAPPING: HometaxField[] = [
  { field: 31, accountCodes: ["201"], label: "외상매입금" },
  { field: 32, accountCodes: ["202"], label: "지급어음" },
  { field: 33, accountCodes: ["203"], label: "미지급금" },
  { field: 34, accountCodes: ["204"], label: "미지급비용" },
  { field: 35, accountCodes: ["205"], label: "선수금" },
  { field: 36, accountCodes: ["206"], label: "예수금" },
  { field: 37, accountCodes: ["207"], label: "부가세예수금" },
  { field: 38, accountCodes: ["208"], label: "단기차입금" },
  { field: 39, accountCodes: ["210"], label: "미지급법인세" },
  { field: 40, accountCodes: [], label: "유동부채 소계", computed: "sum" },
  { field: 45, accountCodes: ["251"], label: "장기차입금" },
  { field: 46, accountCodes: ["253"], label: "퇴직급여충당부채" },
  { field: 47, accountCodes: [], label: "비유동부채 소계", computed: "sum" },
  { field: 48, accountCodes: [], label: "부채총계", computed: "sum" },
];

// 표준대차대조표 — 자본의 부
export const BS_EQUITY_MAPPING: HometaxField[] = [
  { field: 51, accountCodes: ["301"], label: "자본금" },
  { field: 52, accountCodes: ["311"], label: "자본잉여금" },
  { field: 53, accountCodes: ["321", "322"], label: "이익잉여금" },
  { field: 54, accountCodes: ["331"], label: "자본조정" },
  { field: 55, accountCodes: [], label: "자본총계", computed: "sum" },
  { field: 56, accountCodes: [], label: "부채와자본총계", computed: "sum" },
];

// 표준손익계산서
export const IS_MAPPING: HometaxField[] = [
  { field: 1, accountCodes: ["401", "402", "403", "404"], label: "매출액" },
  { field: 2, accountCodes: ["501", "502"], label: "매출원가" },
  { field: 3, accountCodes: [], label: "매출총이익", computed: "sum" },
  { field: 4, accountCodes: ["511"], label: "급여" },
  { field: 5, accountCodes: ["512"], label: "퇴직급여" },
  { field: 6, accountCodes: ["513"], label: "복리후생비" },
  { field: 7, accountCodes: ["518"], label: "임차료" },
  { field: 8, accountCodes: ["522"], label: "접대비" },
  { field: 9, accountCodes: ["519"], label: "감가상각비" },
  { field: 10, accountCodes: ["517"], label: "세금과공과" },
  { field: 11, accountCodes: ["523"], label: "광고선전비" },
  { field: 12, accountCodes: ["525"], label: "지급수수료" },
  { field: 13, accountCodes: ["531"], label: "외주용역비" },
  {
    field: 14,
    accountCodes: ["514", "515", "516", "520", "521", "524", "526", "527", "528", "529", "530"],
    label: "기타 판관비",
  },
  { field: 15, accountCodes: [], label: "판관비 소계", computed: "sum" },
  { field: 16, accountCodes: [], label: "영업이익", computed: "sum" },
  { field: 17, accountCodes: ["451", "452", "453", "454", "455"], label: "영업외수익" },
  { field: 18, accountCodes: ["551", "552", "553", "554"], label: "영업외비용" },
  { field: 19, accountCodes: [], label: "법인세비용차감전순이익", computed: "sum" },
  { field: 20, accountCodes: ["590"], label: "법인세비용" },
  { field: 21, accountCodes: [], label: "당기순이익", computed: "sum" },
];

// 계정코드들의 잔액 합산 유틸
export function sumByField(
  field: HometaxField,
  balances: Record<string, number>
): number {
  if (field.computed) return 0; // computed는 별도 계산
  const total = field.accountCodes.reduce((sum, code) => sum + (balances[code] ?? 0), 0);
  return field.negative ? -total : total;
}
