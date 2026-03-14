import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getExamples = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const examples = await ctx.db
      .query("aiJournalExamples")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);
    return examples;
  },
});

export const saveExample = mutation({
  args: {
    userId: v.id("users"),
    inputDescription: v.string(),
    inputType: v.string(),
    resultEntries: v.array(
      v.object({
        accountCode: v.string(),
        accountName: v.string(),
        debitAmount: v.number(),
        creditAmount: v.number(),
        partnerName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiJournalExamples", {
      userId: args.userId,
      inputDescription: args.inputDescription,
      inputType: args.inputType,
      resultEntries: args.resultEntries,
      wasApproved: true,
      approvedAt: new Date().toISOString(),
    });
  },
});
