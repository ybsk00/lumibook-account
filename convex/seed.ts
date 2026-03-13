import { mutation } from "./_generated/server";

const ACCOUNTS_DATA = [
  // ─── 자산 (1xx) ───
  { code: "101", name: "현금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "102", name: "보통예금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "103", name: "정기예금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "108", name: "외상매출금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "109", name: "받을어음", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "110", name: "미수금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "111", name: "선급금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "112", name: "선급비용", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "113", name: "부가세대급금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "114", name: "가지급금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "115", name: "단기대여금", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "120", name: "재고자산", category: "자산", subCategory: "유동자산", accountType: "debit" },
  { code: "151", name: "토지", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "152", name: "건물", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "153", name: "구축물", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "154", name: "기계장치", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "155", name: "차량운반구", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "156", name: "비품", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "157", name: "감가상각누계액", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "160", name: "무형자산", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "161", name: "영업권", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "170", name: "장기투자증권", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "171", name: "장기대여금", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  { code: "172", name: "임차보증금", category: "자산", subCategory: "비유동자산", accountType: "debit" },
  // ─── 부채 (2xx) ───
  { code: "201", name: "외상매입금", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "202", name: "지급어음", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "203", name: "미지급금", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "204", name: "미지급비용", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "205", name: "선수금", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "206", name: "예수금", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "207", name: "부가세예수금", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "208", name: "단기차입금", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "209", name: "유동성장기부채", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "210", name: "미지급법인세", category: "부채", subCategory: "유동부채", accountType: "credit" },
  { code: "251", name: "장기차입금", category: "부채", subCategory: "비유동부채", accountType: "credit" },
  { code: "252", name: "사채", category: "부채", subCategory: "비유동부채", accountType: "credit" },
  { code: "253", name: "퇴직급여충당부채", category: "부채", subCategory: "비유동부채", accountType: "credit" },
  { code: "254", name: "임대보증금", category: "부채", subCategory: "비유동부채", accountType: "credit" },
  // ─── 자본 (3xx) ───
  { code: "301", name: "자본금", category: "자본", subCategory: "자본금", accountType: "credit" },
  { code: "311", name: "자본잉여금", category: "자본", subCategory: "자본잉여금", accountType: "credit" },
  { code: "321", name: "이익잉여금", category: "자본", subCategory: "이익잉여금", accountType: "credit" },
  { code: "322", name: "이월이익잉여금", category: "자본", subCategory: "이익잉여금", accountType: "credit" },
  { code: "331", name: "자본조정", category: "자본", subCategory: "자본조정", accountType: "credit" },
  // ─── 수익 (4xx) ───
  { code: "401", name: "상품매출", category: "수익", subCategory: "매출액", accountType: "credit" },
  { code: "402", name: "제품매출", category: "수익", subCategory: "매출액", accountType: "credit" },
  { code: "403", name: "용역매출", category: "수익", subCategory: "매출액", accountType: "credit" },
  { code: "404", name: "기타매출", category: "수익", subCategory: "매출액", accountType: "credit" },
  { code: "451", name: "이자수익", category: "수익", subCategory: "영업외수익", accountType: "credit" },
  { code: "452", name: "배당금수익", category: "수익", subCategory: "영업외수익", accountType: "credit" },
  { code: "453", name: "임대료수익", category: "수익", subCategory: "영업외수익", accountType: "credit" },
  { code: "454", name: "유형자산처분이익", category: "수익", subCategory: "영업외수익", accountType: "credit" },
  { code: "455", name: "잡이익", category: "수익", subCategory: "영업외수익", accountType: "credit" },
  // ─── 비용 (5xx) ───
  { code: "501", name: "상품매출원가", category: "비용", subCategory: "매출원가", accountType: "debit" },
  { code: "502", name: "제품매출원가", category: "비용", subCategory: "매출원가", accountType: "debit" },
  { code: "511", name: "급여", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "512", name: "퇴직급여", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "513", name: "복리후생비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "514", name: "여비교통비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "515", name: "통신비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "516", name: "수도광열비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "517", name: "세금과공과", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "518", name: "임차료", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "519", name: "감가상각비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "520", name: "보험료", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "521", name: "수선비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "522", name: "접대비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "523", name: "광고선전비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "524", name: "소모품비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "525", name: "지급수수료", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "526", name: "차량유지비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "527", name: "교육훈련비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "528", name: "도서인쇄비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "529", name: "회의비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "530", name: "사무용품비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "531", name: "외주용역비", category: "비용", subCategory: "판관비", accountType: "debit" },
  { code: "551", name: "이자비용", category: "비용", subCategory: "영업외비용", accountType: "debit" },
  { code: "552", name: "기부금", category: "비용", subCategory: "영업외비용", accountType: "debit" },
  { code: "553", name: "유형자산처분손실", category: "비용", subCategory: "영업외비용", accountType: "debit" },
  { code: "554", name: "잡손실", category: "비용", subCategory: "영업외비용", accountType: "debit" },
  { code: "590", name: "법인세비용", category: "비용", subCategory: "법인세비용", accountType: "debit" },
];

export const seedAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    // 기존 데이터 확인
    const existing = await ctx.db.query("accounts").first();
    if (existing) {
      return { message: "계정과목이 이미 존재합니다. 시드를 건너뜁니다." };
    }

    for (let i = 0; i < ACCOUNTS_DATA.length; i++) {
      const acc = ACCOUNTS_DATA[i];
      await ctx.db.insert("accounts", {
        ...acc,
        isActive: true,
        sortOrder: i + 1,
      });
    }

    return { message: `${ACCOUNTS_DATA.length}개 계정과목을 삽입했습니다.` };
  },
});

export const seedCompanySettings = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("companySettings").first();
    if (existing) {
      return { message: "회사 설정이 이미 존재합니다." };
    }

    await ctx.db.insert("companySettings", {
      companyName: "주식회사 루미브리즈",
      businessNumber: "000-00-00000",
      representative: "유범석",
      businessType: "서비스업",
      businessItem: "소프트웨어 개발",
      address: "",
      fiscalYearStart: 1,
      currentFiscalYear: 2025,
    });

    return { message: "회사 설정을 생성했습니다." };
  },
});
