import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getExamples = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("aiJournalExamples").order("desc").take(20);
  },
});

export const saveExample = mutation({
  args: {
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
      inputDescription: args.inputDescription,
      inputType: args.inputType,
      resultEntries: args.resultEntries,
      wasApproved: true,
      approvedAt: new Date().toISOString(),
    });
  },
});
