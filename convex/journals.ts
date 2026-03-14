import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    userId: v.id("users"),
    fiscalYear: v.optional(v.number()),
    status: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (args.fiscalYear) {
      journals = journals.filter((j) => j.fiscalYear === args.fiscalYear);
    }
    if (args.status) {
      journals = journals.filter((j) => j.status === args.status);
    }
    if (args.startDate) {
      journals = journals.filter((j) => j.journalDate >= args.startDate!);
    }
    if (args.endDate) {
      journals = journals.filter((j) => j.journalDate <= args.endDate!);
    }

    return journals.sort((a, b) => b.journalDate.localeCompare(a.journalDate));
  },
});

export const getById = query({
  args: { id: v.id("journals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const generateNumber = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, args) => {
    const prefix = args.date.replace(/-/g, "");
    const existing = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const sameDateJournals = existing.filter(
      (j) => j.journalDate === args.date
    );
    const seq = String(sameDateJournals.length + 1).padStart(3, "0");
    return `${prefix}-${seq}`;
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    journalDate: v.string(),
    journalType: v.string(),
    description: v.string(),
    totalAmount: v.number(),
    status: v.string(),
    aiInput: v.optional(
      v.object({
        type: v.string(),
        amount: v.number(),
        description: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const prefix = args.journalDate.replace(/-/g, "");
    const existing = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const sameDateJournals = existing.filter(
      (j) => j.journalDate === args.journalDate
    );
    const seq = String(sameDateJournals.length + 1).padStart(3, "0");
    const journalNumber = `${prefix}-${seq}`;

    const dateParts = args.journalDate.split("-");
    const fiscalYear = parseInt(dateParts[0]);
    const fiscalMonth = parseInt(dateParts[1]);

    return await ctx.db.insert("journals", {
      userId: args.userId,
      journalNumber,
      journalDate: args.journalDate,
      journalType: args.journalType,
      description: args.description,
      totalAmount: args.totalAmount,
      status: args.status,
      fiscalYear,
      fiscalMonth,
      aiInput: args.aiInput,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("journals"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const update = mutation({
  args: {
    id: v.id("journals"),
    journalDate: v.optional(v.string()),
    journalType: v.optional(v.string()),
    description: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (args.journalDate) {
      const dateParts = args.journalDate.split("-");
      Object.assign(filtered, {
        fiscalYear: parseInt(dateParts[0]),
        fiscalMonth: parseInt(dateParts[1]),
      });
    }
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("journals") },
  handler: async (ctx, args) => {
    // 분개라인 삭제
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_journal", (q) => q.eq("journalId", args.id))
      .collect();
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
    await ctx.db.delete(args.id);
  },
});
