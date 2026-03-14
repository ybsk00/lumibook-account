import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 이메일로 사용자 조회 (로그인 검증용)
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// 회원가입
export const register = mutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    companyName: v.string(),
    businessNumber: v.string(),
    corporateNumber: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 이메일 중복 체크
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) throw new Error("이미 등록된 이메일입니다.");

    const userId = await ctx.db.insert("users", {
      ...args,
      fiscalYearStart: 1,
      currentFiscalYear: new Date().getFullYear(),
    });

    return userId;
  },
});

// 사용자 정보 조회
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// 사용자 정보 업데이트 (회사정보 수정)
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    companyName: v.optional(v.string()),
    businessNumber: v.optional(v.string()),
    corporateNumber: v.optional(v.string()),
    name: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    fiscalYearStart: v.optional(v.number()),
    currentFiscalYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(userId, filtered);
  },
});
