import { query } from "./_generated/server";
import { v } from "convex/values";

// 총계정원장: 모든 계정의 기초/차변/대변/기말
export const getGeneralLedger = query({
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
    const activeAccounts = accounts.filter((a) => a.isActive);

    // 기초잔액
    const openingBalances = await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
      .collect();

    // 기간 내 확정 전표
    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const confirmedJournals = journals.filter(
      (j) =>
        j.status === "confirmed" &&
        j.journalDate >= args.startDate &&
        j.journalDate <= args.endDate
    );
    const journalIds = new Set(confirmedJournals.map((j) => j._id));

    // 분개라인 집계
    const allEntries = await ctx.db.query("journalEntries").collect();
    const periodEntries = allEntries.filter((e) => journalIds.has(e.journalId));

    // 계정별 집계
    const result = activeAccounts
      .map((acc) => {
        const ob = openingBalances.find((o) => o.accountId === acc._id);
        const openingDebit = ob?.debitBalance ?? 0;
        const openingCredit = ob?.creditBalance ?? 0;
        const opening =
          acc.category === "자산" || acc.category === "비용"
            ? openingDebit - openingCredit
            : openingCredit - openingDebit;

        const entries = periodEntries.filter((e) => e.accountId === acc._id);
        const totalDebit = entries.reduce((s, e) => s + e.debitAmount, 0);
        const totalCredit = entries.reduce((s, e) => s + e.creditAmount, 0);

        const closing =
          acc.category === "자산" || acc.category === "비용"
            ? opening + totalDebit - totalCredit
            : opening + totalCredit - totalDebit;

        return {
          accountId: acc._id,
          code: acc.code,
          name: acc.name,
          category: acc.category,
          subCategory: acc.subCategory,
          opening,
          totalDebit,
          totalCredit,
          closing,
          sortOrder: acc.sortOrder,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return result;
  },
});

// 계정별원장: 특정 계정의 건별 거래내역
export const getAccountLedger = query({
  args: {
    userId: v.id("users"),
    accountId: v.id("accounts"),
    startDate: v.string(),
    endDate: v.string(),
    fiscalYear: v.number(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return { account: null, entries: [], opening: 0 };

    // 기초잔액
    const obs = await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
      .collect();
    const ob = obs.find((o) => o.accountId === args.accountId);
    const opening =
      account.category === "자산" || account.category === "비용"
        ? (ob?.debitBalance ?? 0) - (ob?.creditBalance ?? 0)
        : (ob?.creditBalance ?? 0) - (ob?.debitBalance ?? 0);

    // 기간 내 확정 전표
    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const confirmedMap = new Map(
      journals
        .filter(
          (j) =>
            j.status === "confirmed" &&
            j.journalDate >= args.startDate &&
            j.journalDate <= args.endDate
        )
        .map((j) => [j._id, j])
    );

    // 해당 계정 분개라인
    const allEntries = await ctx.db
      .query("journalEntries")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();

    const entries = allEntries
      .filter((e) => confirmedMap.has(e.journalId))
      .map((e) => {
        const j = confirmedMap.get(e.journalId)!;
        return {
          entryId: e._id,
          journalId: e.journalId,
          journalNumber: j.journalNumber,
          journalDate: j.journalDate,
          journalDescription: j.description,
          partnerId: e.partnerId,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          description: e.description,
        };
      })
      .sort((a, b) => a.journalDate.localeCompare(b.journalDate));

    // 누적 잔액 계산
    let balance = opening;
    const withBalance = entries.map((e) => {
      if (account.category === "자산" || account.category === "비용") {
        balance += e.debitAmount - e.creditAmount;
      } else {
        balance += e.creditAmount - e.debitAmount;
      }
      return { ...e, balance };
    });

    return { account, entries: withBalance, opening };
  },
});

// 거래처별원장
export const getPartnerLedger = query({
  args: {
    userId: v.id("users"),
    partnerId: v.id("partners"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const partner = await ctx.db.get(args.partnerId);
    if (!partner) return { partner: null, entries: [] };

    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const confirmedMap = new Map(
      journals
        .filter(
          (j) =>
            j.status === "confirmed" &&
            j.journalDate >= args.startDate &&
            j.journalDate <= args.endDate
        )
        .map((j) => [j._id, j])
    );

    const allEntries = await ctx.db
      .query("journalEntries")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
      .collect();

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const accountMap = new Map(accounts.map((a) => [a._id, a]));

    const entries = allEntries
      .filter((e) => confirmedMap.has(e.journalId))
      .map((e) => {
        const j = confirmedMap.get(e.journalId)!;
        const acc = accountMap.get(e.accountId);
        return {
          entryId: e._id,
          journalId: e.journalId,
          journalNumber: j.journalNumber,
          journalDate: j.journalDate,
          journalDescription: j.description,
          accountCode: acc?.code ?? "",
          accountName: acc?.name ?? "",
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          description: e.description,
        };
      })
      .sort((a, b) => a.journalDate.localeCompare(b.journalDate));

    return { partner, entries };
  },
});
