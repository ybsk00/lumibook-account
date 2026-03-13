import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByJournal = query({
  args: { journalId: v.id("journals") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_journal", (q) => q.eq("journalId", args.journalId))
      .collect();
    return entries.sort((a, b) => a.lineNumber - b.lineNumber);
  },
});

export const getByAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
  },
});

export const getByPartner = query({
  args: { partnerId: v.id("partners") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
      .collect();
  },
});

export const createBatch = mutation({
  args: {
    journalId: v.id("journals"),
    entries: v.array(
      v.object({
        lineNumber: v.number(),
        accountId: v.id("accounts"),
        partnerId: v.optional(v.id("partners")),
        debitAmount: v.number(),
        creditAmount: v.number(),
        description: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 대차균형 검증
    const totalDebit = args.entries.reduce((sum, e) => sum + e.debitAmount, 0);
    const totalCredit = args.entries.reduce((sum, e) => sum + e.creditAmount, 0);
    if (totalDebit !== totalCredit || totalDebit === 0) {
      throw new Error(
        `대차균형 불일치: 차변 ${totalDebit} ≠ 대변 ${totalCredit}`
      );
    }

    const ids = [];
    for (const entry of args.entries) {
      const id = await ctx.db.insert("journalEntries", {
        journalId: args.journalId,
        ...entry,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const deleteByJournal = mutation({
  args: { journalId: v.id("journals") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_journal", (q) => q.eq("journalId", args.journalId))
      .collect();
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
  },
});
