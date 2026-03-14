import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users"), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (args.activeOnly) {
      return accounts.filter((a) => a.isActive);
    }
    return accounts;
  },
});

export const getByCode = query({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_user_code", (q) =>
        q.eq("userId", args.userId).eq("code", args.code)
      )
      .first();
  },
});

export const listByCategory = query({
  args: { userId: v.id("users"), category: v.string() },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return accounts.filter((a) => a.category === args.category);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    name: v.string(),
    category: v.string(),
    subCategory: v.string(),
    accountType: v.string(),
    parentCode: v.optional(v.string()),
    taxType: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_user_code", (q) =>
        q.eq("userId", args.userId).eq("code", args.code)
      )
      .first();
    if (existing) throw new Error(`계정코드 ${args.code}가 이미 존재합니다.`);

    return await ctx.db.insert("accounts", {
      ...args,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    taxType: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
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
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id);
    if (!account) throw new Error("계정과목을 찾을 수 없습니다.");
    await ctx.db.patch(args.id, { isActive: !account.isActive });
  },
});
