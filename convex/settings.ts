import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companySettings").first();
  },
});

export const upsert = mutation({
  args: {
    companyName: v.string(),
    businessNumber: v.string(),
    corporateNumber: v.optional(v.string()),
    representative: v.string(),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    fiscalYearStart: v.number(),
    currentFiscalYear: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("companySettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("companySettings", args);
  },
});
