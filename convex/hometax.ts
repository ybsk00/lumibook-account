import { query } from "./_generated/server";
import { v } from "convex/values";

export const getHometaxData = query({
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

    // 계정코드별 기말잔액
    const codeBalances = new Map<string, number>();
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

      codeBalances.set(acc.code, closing);
    }

    return Object.fromEntries(codeBalances);
  },
});
