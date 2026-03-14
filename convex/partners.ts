import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users"), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const partners = await ctx.db
      .query("partners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (args.activeOnly) {
      return partners.filter((p) => p.isActive);
    }
    return partners;
  },
});

export const get = query({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    businessNumber: v.string(),
    name: v.string(),
    representative: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    partnerType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("partners", {
      ...args,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("partners"),
    businessNumber: v.optional(v.string()),
    name: v.optional(v.string()),
    representative: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    partnerType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const toggleActive = mutation({
  args: { id: v.id("partners") },
  handler: async (ctx, args) => {
    const partner = await ctx.db.get(args.id);
    if (!partner) throw new Error("거래처를 찾을 수 없습니다.");
    await ctx.db.patch(args.id, { isActive: !partner.isActive });
  },
});
