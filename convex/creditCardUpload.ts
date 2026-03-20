import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const batchCreateWithJournals = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        period: v.string(),           // "2025-01"
        paymentAmount: v.number(),
        vatAmount: v.number(),
        totalAmount: v.number(),
        periodLabel: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const accountByCode = new Map(accounts.map((a) => [a.code, a]));

    // Duplicate check
    const existing = await ctx.db
      .query("creditCardExpenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingSet = new Set(
      existing.map((e) => `${e.period}|${e.totalAmount}`)
    );

    const dateCountCache = new Map<string, number>();
    let created = 0;
    let createdJournals = 0;
    let skippedDuplicates = 0;

    for (const item of args.items) {
      const key = `${item.period}|${item.totalAmount}`;
      if (existingSet.has(key)) {
        skippedDuplicates++;
        continue;
      }
      existingSet.add(key);

      const fiscalYear = parseInt(item.period.split("-")[0]);
      const fiscalMonth = parseInt(item.period.split("-")[1]);

      const expenseId = await ctx.db.insert("creditCardExpenses", {
        userId: args.userId,
        period: item.period,
        paymentAmount: item.paymentAmount,
        vatAmount: item.vatAmount,
        totalAmount: item.totalAmount,
        periodLabel: item.periodLabel,
        fiscalYear,
      });
      created++;

      // Journal: last day of month
      const lastDay = new Date(fiscalYear, fiscalMonth, 0).getDate();
      const journalDate = `${item.period}-${String(lastDay).padStart(2, "0")}`;

      if (!dateCountCache.has(journalDate)) {
        const existingJ = await ctx.db
          .query("journals")
          .withIndex("by_user_date", (q) =>
            q.eq("userId", args.userId).eq("journalDate", journalDate)
          )
          .collect();
        dateCountCache.set(journalDate, existingJ.length);
      }
      const count = dateCountCache.get(journalDate)! + 1;
      dateCountCache.set(journalDate, count);

      const prefix = journalDate.replace(/-/g, "");
      const journalNumber = `${prefix}-${String(count).padStart(3, "0")}`;

      const desc = `사업용신용카드 ${item.period} 결제`;

      const journalId = await ctx.db.insert("journals", {
        userId: args.userId,
        journalNumber,
        journalDate,
        journalType: "출금",
        description: desc,
        totalAmount: item.totalAmount,
        status: "confirmed",
        fiscalYear,
        fiscalMonth,
      });

      // Journal entries (비용 처리):
      // (차) 소모품비 524 = paymentAmount (기본 비용 계정, 전표에서 수정 가능)
      // (차) 부가세대급금 113 = vatAmount
      // (대) 보통예금 102 = totalAmount
      const acc524 = accountByCode.get("524");
      const acc113 = accountByCode.get("113");
      const acc102 = accountByCode.get("102");

      let lineNum = 1;

      if (acc524 && item.paymentAmount > 0) {
        await ctx.db.insert("journalEntries", {
          journalId,
          lineNumber: lineNum++,
          accountId: acc524._id,
          debitAmount: item.paymentAmount,
          creditAmount: 0,
          description: `카드결제 ${item.period}`,
        });
      }

      if (acc113 && item.vatAmount > 0) {
        await ctx.db.insert("journalEntries", {
          journalId,
          lineNumber: lineNum++,
          accountId: acc113._id,
          debitAmount: item.vatAmount,
          creditAmount: 0,
          description: "부가세대급금",
        });
      }

      if (acc102) {
        await ctx.db.insert("journalEntries", {
          journalId,
          lineNumber: lineNum,
          accountId: acc102._id,
          debitAmount: 0,
          creditAmount: item.totalAmount,
          description: desc,
        });
      }

      await ctx.db.patch(expenseId, { journalId });
      createdJournals++;
    }

    return {
      created,
      journals: createdJournals,
      total: args.items.length,
      skippedDuplicates,
    };
  },
});
