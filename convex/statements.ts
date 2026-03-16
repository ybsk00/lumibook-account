import { query } from "./_generated/server";
import { v } from "convex/values";

// 재무상태표 데이터
export const getBalanceSheet = query({
  args: {
    userId: v.id("users"),
    fiscalYear: v.number(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = accounts.filter((a) => a.isActive);

    const obs = await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
      .collect();

    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const confirmed = journals.filter(
      (j) =>
        j.status === "confirmed" &&
        j.fiscalYear === args.fiscalYear &&
        j.journalDate <= args.endDate
    );
    const journalIds = new Set(confirmed.map((j) => j._id));

    const allEntries = await ctx.db.query("journalEntries").collect();
    const entries = allEntries.filter((e) => journalIds.has(e.journalId));

    // 계정별 기말잔액 계산
    const balances = new Map<string, number>();
    for (const acc of active) {
      const ob = obs.find((o) => o.accountId === acc._id);
      const opening =
        acc.category === "자산" || acc.category === "비용"
          ? (ob?.debitBalance ?? 0) - (ob?.creditBalance ?? 0)
          : (ob?.creditBalance ?? 0) - (ob?.debitBalance ?? 0);

      const accEntries = entries.filter((e) => e.accountId === acc._id);
      const totalDebit = accEntries.reduce((s, e) => s + e.debitAmount, 0);
      const totalCredit = accEntries.reduce((s, e) => s + e.creditAmount, 0);

      const closing =
        acc.category === "자산" || acc.category === "비용"
          ? opening + totalDebit - totalCredit
          : opening + totalCredit - totalDebit;

      balances.set(acc._id, closing);
    }

    // 분류별 집계
    const getSum = (category: string, subCategory?: string) =>
      active
        .filter((a) => a.category === category && (!subCategory || a.subCategory === subCategory))
        .reduce((sum, a) => sum + (balances.get(a._id) ?? 0), 0);

    const getDetails = (category: string, subCategory?: string) =>
      active
        .filter((a) => a.category === category && (!subCategory || a.subCategory === subCategory))
        .map((a) => ({ code: a.code, name: a.name, amount: balances.get(a._id) ?? 0 }))
        .filter((a) => a.amount !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));

    // 당기순이익 = 수익 - 비용
    const totalRevenue = getSum("수익");
    const totalExpense = getSum("비용");
    const netIncome = totalRevenue - totalExpense;

    const currentAssets = getSum("자산", "유동자산");
    const nonCurrentAssets = getSum("자산", "비유동자산");
    const totalAssets = currentAssets + nonCurrentAssets;

    const currentLiabilities = getSum("부채", "유동부채");
    const nonCurrentLiabilities = getSum("부채", "비유동부채");
    const totalLiabilities = currentLiabilities + nonCurrentLiabilities;

    const equity = getSum("자본");
    const totalEquity = equity + netIncome;

    return {
      assets: {
        current: { total: currentAssets, details: getDetails("자산", "유동자산") },
        nonCurrent: { total: nonCurrentAssets, details: getDetails("자산", "비유동자산") },
        total: totalAssets,
      },
      liabilities: {
        current: { total: currentLiabilities, details: getDetails("부채", "유동부채") },
        nonCurrent: { total: nonCurrentLiabilities, details: getDetails("부채", "비유동부채") },
        total: totalLiabilities,
      },
      equity: {
        details: getDetails("자본"),
        netIncome,
        total: totalEquity,
      },
      balanced: totalAssets === totalLiabilities + totalEquity,
      diff: totalAssets - (totalLiabilities + totalEquity),
    };
  },
});

// 손익계산서 데이터
export const getIncomeStatement = query({
  args: {
    userId: v.id("users"),
    fiscalYear: v.number(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = accounts.filter((a) => a.isActive);

    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const confirmed = journals.filter(
      (j) =>
        j.status === "confirmed" &&
        j.journalDate >= args.startDate &&
        j.journalDate <= args.endDate
    );
    const journalIds = new Set(confirmed.map((j) => j._id));

    const allEntries = await ctx.db.query("journalEntries").collect();
    const entries = allEntries.filter((e) => journalIds.has(e.journalId));

    // 수익/비용 계정 잔액
    const balances = new Map<string, number>();
    for (const acc of active) {
      if (acc.category !== "수익" && acc.category !== "비용") continue;
      const accEntries = entries.filter((e) => e.accountId === acc._id);
      const totalDebit = accEntries.reduce((s, e) => s + e.debitAmount, 0);
      const totalCredit = accEntries.reduce((s, e) => s + e.creditAmount, 0);
      const balance =
        acc.category === "비용"
          ? totalDebit - totalCredit
          : totalCredit - totalDebit;
      balances.set(acc._id, balance);
    }

    const getSum = (category: string, subCategory: string) =>
      active
        .filter((a) => a.category === category && a.subCategory === subCategory)
        .reduce((sum, a) => sum + (balances.get(a._id) ?? 0), 0);

    const getDetails = (category: string, subCategory: string) =>
      active
        .filter((a) => a.category === category && a.subCategory === subCategory)
        .map((a) => ({ code: a.code, name: a.name, amount: balances.get(a._id) ?? 0 }))
        .filter((a) => a.amount !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));

    const revenue = getSum("수익", "매출액");
    const cogs = getSum("비용", "매출원가");
    const grossProfit = revenue - cogs;
    const sga = getSum("비용", "판관비");
    const operatingIncome = grossProfit - sga;
    const otherRevenue = getSum("수익", "영업외수익");
    const otherExpense = getSum("비용", "영업외비용");
    const incomeBeforeTax = operatingIncome + otherRevenue - otherExpense;
    const tax = getSum("비용", "법인세비용");
    const netIncome = incomeBeforeTax - tax;

    return {
      revenue: { total: revenue, details: getDetails("수익", "매출액") },
      cogs: { total: cogs, details: getDetails("비용", "매출원가") },
      grossProfit,
      sga: { total: sga, details: getDetails("비용", "판관비") },
      operatingIncome,
      otherRevenue: { total: otherRevenue, details: getDetails("수익", "영업외수익") },
      otherExpense: { total: otherExpense, details: getDetails("비용", "영업외비용") },
      incomeBeforeTax,
      tax: { total: tax, details: getDetails("비용", "법인세비용") },
      netIncome,
    };
  },
});

// 합계잔액시산표
export const getTrialBalance = query({
  args: {
    userId: v.id("users"),
    fiscalYear: v.number(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const active = accounts.filter((a) => a.isActive);

    const obs = await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
      .collect();

    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const confirmed = journals.filter(
      (j) => j.status === "confirmed" && j.fiscalYear === args.fiscalYear && j.journalDate <= args.endDate
    );
    const journalIds = new Set(confirmed.map((j) => j._id));

    const allEntries = await ctx.db.query("journalEntries").collect();
    const entries = allEntries.filter((e) => journalIds.has(e.journalId));

    const rows = active
      .map((acc) => {
        const ob = obs.find((o) => o.accountId === acc._id);
        const opening =
          acc.category === "자산" || acc.category === "비용"
            ? (ob?.debitBalance ?? 0) - (ob?.creditBalance ?? 0)
            : (ob?.creditBalance ?? 0) - (ob?.debitBalance ?? 0);

        const accEntries = entries.filter((e) => e.accountId === acc._id);
        const totalDebit = accEntries.reduce((s, e) => s + e.debitAmount, 0);
        const totalCredit = accEntries.reduce((s, e) => s + e.creditAmount, 0);

        const closing =
          acc.category === "자산" || acc.category === "비용"
            ? opening + totalDebit - totalCredit
            : opening + totalCredit - totalDebit;

        const isDebitNature = acc.category === "자산" || acc.category === "비용";
        return {
          code: acc.code,
          name: acc.name,
          category: acc.category,
          debitBalance: isDebitNature
            ? (closing > 0 ? closing : 0)
            : (closing < 0 ? Math.abs(closing) : 0),
          creditBalance: isDebitNature
            ? (closing < 0 ? Math.abs(closing) : 0)
            : (closing > 0 ? closing : 0),
          sortOrder: acc.sortOrder,
        };
      })
      .filter((r) => r.debitBalance !== 0 || r.creditBalance !== 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const totalDebitBalance = rows.reduce((s, r) => s + r.debitBalance, 0);
    const totalCreditBalance = rows.reduce((s, r) => s + r.creditBalance, 0);

    return { rows, totalDebitBalance, totalCreditBalance };
  },
});
