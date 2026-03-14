import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users"), fiscalYear: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vatPeriods")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((periods) =>
        periods.filter((p) => p.fiscalYear === args.fiscalYear)
      );
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    periodType: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    fiscalYear: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vatPeriods", {
      ...args,
      status: "open",
      salesTaxable: 0,
      salesZeroRated: 0,
      salesExempt: 0,
      purchaseTaxable: 0,
      outputTax: 0,
      inputTax: 0,
      taxPayable: 0,
    });
  },
});

export const recalculate = mutation({
  args: { id: v.id("vatPeriods") },
  handler: async (ctx, args) => {
    const period = await ctx.db.get(args.id);
    if (!period) throw new Error("부가세 기간을 찾을 수 없습니다.");

    const invoices = await ctx.db.query("taxInvoices").collect();
    const periodInvoices = invoices.filter(
      (i) => i.invoiceDate >= period.startDate && i.invoiceDate <= period.endDate
    );

    const salesTaxable = periodInvoices
      .filter((i) => i.invoiceType === "sales" && i.taxType === "taxable")
      .reduce((s, i) => s + i.supplyAmount, 0);
    const salesZeroRated = periodInvoices
      .filter((i) => i.invoiceType === "sales" && i.taxType === "zero_rated")
      .reduce((s, i) => s + i.supplyAmount, 0);
    const salesExempt = periodInvoices
      .filter((i) => i.invoiceType === "sales" && i.taxType === "exempt")
      .reduce((s, i) => s + i.supplyAmount, 0);
    const purchaseTaxable = periodInvoices
      .filter((i) => i.invoiceType === "purchase" && i.taxType === "taxable")
      .reduce((s, i) => s + i.supplyAmount, 0);
    const outputTax = periodInvoices
      .filter((i) => i.invoiceType === "sales")
      .reduce((s, i) => s + i.taxAmount, 0);
    const inputTax = periodInvoices
      .filter((i) => i.invoiceType === "purchase")
      .reduce((s, i) => s + i.taxAmount, 0);

    await ctx.db.patch(args.id, {
      salesTaxable,
      salesZeroRated,
      salesExempt,
      purchaseTaxable,
      outputTax,
      inputTax,
      taxPayable: outputTax - inputTax,
    });
  },
});
