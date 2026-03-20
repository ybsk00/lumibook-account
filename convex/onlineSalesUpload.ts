import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const batchCreateWithJournals = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        salesPeriod: v.string(),       // "2025-01"
        count: v.number(),
        salesAmount: v.number(),
        platformName: v.string(),
        periodLabel: v.string(),       // "1기" | "2기"
      })
    ),
  },
  handler: async (ctx, args) => {
    // Load accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const accountByCode = new Map(accounts.map((a) => [a.code, a]));

    // Load partners for dedup
    const partners = await ctx.db
      .query("partners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const partnerByName = new Map(partners.map((p) => [p.name, p]));

    // Duplicate check: existing online sales
    const existingSales = await ctx.db
      .query("onlineSales")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingSet = new Set(
      existingSales.map((s) => `${s.salesPeriod}|${s.platformName}|${s.salesAmount}`)
    );

    const dateCountCache = new Map<string, number>();
    let created = 0;
    let createdJournals = 0;
    let skippedDuplicates = 0;

    for (const item of args.items) {
      // Duplicate check
      const key = `${item.salesPeriod}|${item.platformName}|${item.salesAmount}`;
      if (existingSet.has(key)) {
        skippedDuplicates++;
        continue;
      }
      existingSet.add(key);

      const fiscalYear = parseInt(item.salesPeriod.split("-")[0]);
      const fiscalMonth = parseInt(item.salesPeriod.split("-")[1]);

      // Create online sales record
      const salesId = await ctx.db.insert("onlineSales", {
        userId: args.userId,
        salesPeriod: item.salesPeriod,
        count: item.count,
        salesAmount: item.salesAmount,
        platformName: item.platformName,
        periodLabel: item.periodLabel,
        fiscalYear,
      });
      created++;

      // Auto-create journal entry
      // Use last day of the month as journal date
      const lastDay = new Date(fiscalYear, fiscalMonth, 0).getDate();
      const journalDate = `${item.salesPeriod}-${String(lastDay).padStart(2, "0")}`;

      if (!dateCountCache.has(journalDate)) {
        const existing = await ctx.db
          .query("journals")
          .withIndex("by_user_date", (q) =>
            q.eq("userId", args.userId).eq("journalDate", journalDate)
          )
          .collect();
        dateCountCache.set(journalDate, existing.length);
      }
      const count = dateCountCache.get(journalDate)! + 1;
      dateCountCache.set(journalDate, count);

      const prefix = journalDate.replace(/-/g, "");
      const journalNumber = `${prefix}-${String(count).padStart(3, "0")}`;

      const desc = `${item.platformName} 온라인매출 ${item.salesPeriod} (${item.count}건)`;

      // Find or create partner for the platform
      let partner = partnerByName.get(item.platformName);
      if (!partner) {
        const partnerId = await ctx.db.insert("partners", {
          userId: args.userId,
          name: item.platformName,
          businessNumber: "000-00-00000",
          partnerType: "customer",
          isActive: true,
        });
        partner = await ctx.db.get(partnerId) ?? undefined;
        if (partner) {
          partnerByName.set(partner.name, partner);
        }
      }

      const journalId = await ctx.db.insert("journals", {
        userId: args.userId,
        journalNumber,
        journalDate,
        journalType: "매출",
        description: desc,
        totalAmount: item.salesAmount,
        status: "confirmed",
        fiscalYear,
        fiscalMonth,
      });

      // Journal entries:
      // 온라인매출은 면세 매출로 처리 (부가세 없음, 이미 입금된 것으로 가정)
      // (차) 보통예금 102 = salesAmount
      // (대) 상품매출 401 = salesAmount
      const acc102 = accountByCode.get("102");
      const acc401 = accountByCode.get("401");

      if (acc102) {
        await ctx.db.insert("journalEntries", {
          journalId,
          lineNumber: 1,
          accountId: acc102._id,
          partnerId: partner?._id,
          debitAmount: item.salesAmount,
          creditAmount: 0,
          description: desc,
        });
      }

      if (acc401) {
        await ctx.db.insert("journalEntries", {
          journalId,
          lineNumber: 2,
          accountId: acc401._id,
          partnerId: partner?._id,
          debitAmount: 0,
          creditAmount: item.salesAmount,
          description: `온라인매출 ${item.platformName}`,
        });
      }

      // Link journal to sales record
      await ctx.db.patch(salesId, { journalId });
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
