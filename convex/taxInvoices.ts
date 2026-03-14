import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    userId: v.id("users"),
    invoiceType: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let invoices = await ctx.db
      .query("taxInvoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (args.invoiceType) {
      invoices = invoices.filter((i) => i.invoiceType === args.invoiceType);
    }
    if (args.startDate) {
      invoices = invoices.filter((i) => i.invoiceDate >= args.startDate!);
    }
    if (args.endDate) {
      invoices = invoices.filter((i) => i.invoiceDate <= args.endDate!);
    }
    return invoices.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    invoiceType: v.string(),
    invoiceNumber: v.optional(v.string()),
    invoiceDate: v.string(),
    partnerId: v.id("partners"),
    supplyAmount: v.number(),
    taxAmount: v.number(),
    totalAmount: v.number(),
    taxType: v.string(),
    description: v.optional(v.string()),
    isElectronic: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("taxInvoices", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("taxInvoices"),
    invoiceNumber: v.optional(v.string()),
    invoiceDate: v.optional(v.string()),
    supplyAmount: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("taxInvoices") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
