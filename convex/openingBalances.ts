import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByFiscalYear = query({
  args: { userId: v.id("users"), fiscalYear: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
      .collect();
  },
});

export const upsert = mutation({
  args: {
    userId: v.id("users"),
    fiscalYear: v.number(),
    accountId: v.id("accounts"),
    debitBalance: v.number(),
    creditBalance: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
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

// 일괄 저장 (기초잔액 입력 페이지용)
export const saveBatch = mutation({
  args: {
    userId: v.id("users"),
    fiscalYear: v.number(),
    balances: v.array(
      v.object({
        accountId: v.id("accounts"),
        debitBalance: v.number(),
        creditBalance: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 기존 잔액 삭제
    const existing = await ctx.db
      .query("openingBalances")
      .withIndex("by_user_fiscal", (q) =>
        q.eq("userId", args.userId).eq("fiscalYear", args.fiscalYear)
      )
      .collect();
    for (const e of existing) {
      await ctx.db.delete(e._id);
    }

    // 새로 삽입
    for (const b of args.balances) {
      await ctx.db.insert("openingBalances", {
        userId: args.userId,
        fiscalYear: args.fiscalYear,
        accountId: b.accountId,
        debitBalance: b.debitBalance,
        creditBalance: b.creditBalance,
      });
    }

    return { saved: args.balances.length };
  },
});
