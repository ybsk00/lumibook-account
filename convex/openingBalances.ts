import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByFiscalYear = query({
  args: { fiscalYear: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("openingBalances")
      .withIndex("by_fiscal_year", (q) => q.eq("fiscalYear", args.fiscalYear))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    fiscalYear: v.number(),
    accountId: v.id("accounts"),
    debitBalance: v.number(),
    creditBalance: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("openingBalances")
      .withIndex("by_fiscal_year", (q) => q.eq("fiscalYear", args.fiscalYear))
      .collect();
    const found = existing.find((e) => e.accountId === args.accountId);

    if (found) {
      await ctx.db.patch(found._id, {
        debitBalance: args.debitBalance,
        creditBalance: args.creditBalance,
      });
      return found._id;
    }
    return await ctx.db.insert("openingBalances", args);
  },
});
