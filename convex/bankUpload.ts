import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 분류에 필요한 모든 컨텍스트 한번에 로드
export const getClassificationContext = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const activeAccounts = accounts.filter((a) => a.isActive);

    const partners = await ctx.db
      .query("partners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const activePartners = partners.filter((p) => p.isActive);

    const examples = await ctx.db
      .query("aiJournalExamples")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const recentExamples = examples
      .filter((e) => e.wasApproved)
      .slice(-50);

    return {
      accounts: activeAccounts.map((a) => ({
        _id: a._id,
        code: a.code,
        name: a.name,
        category: a.category,
        subCategory: a.subCategory,
        accountType: a.accountType,
      })),
      partners: activePartners.map((p) => ({
        _id: p._id,
        name: p.name,
        businessNumber: p.businessNumber,
        partnerType: p.partnerType,
      })),
      examples: recentExamples.map((e) => ({
        inputDescription: e.inputDescription,
        inputType: e.inputType,
        resultEntries: e.resultEntries,
      })),
    };
  },
});

// 일괄 전표 생성
export const batchCreateJournals = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        journalDate: v.string(),
        journalType: v.string(),
        description: v.string(),
        totalAmount: v.number(),
        entries: v.array(
          v.object({
            accountCode: v.string(),
            debitAmount: v.number(),
            creditAmount: v.number(),
            partnerName: v.optional(v.string()),
            description: v.optional(v.string()),
          })
        ),
        // AI 학습 데이터
        inputType: v.string(),
        inputDescription: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const partners = await ctx.db
      .query("partners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const accountByCode = new Map(accounts.map((a) => [a.code, a]));
    const partnerByName = new Map(partners.map((p) => [p.name, p]));

    // 날짜별 기존 전표 수 캐시 (자동 채번용)
    const dateCountCache = new Map<string, number>();

    const createdIds: string[] = [];

    for (const item of args.items) {
      // 대차균형 검증
      const totalDebit = item.entries.reduce((s, e) => s + e.debitAmount, 0);
      const totalCredit = item.entries.reduce((s, e) => s + e.creditAmount, 0);
      if (totalDebit !== totalCredit || totalDebit === 0) {
        continue; // 불균형 건은 건너뛰기
      }

      // 전표번호 자동 채번
      if (!dateCountCache.has(item.journalDate)) {
        const existing = await ctx.db
          .query("journals")
          .withIndex("by_user_date", (q) =>
            q.eq("userId", args.userId).eq("journalDate", item.journalDate)
          )
          .collect();
        dateCountCache.set(item.journalDate, existing.length);
      }
      const count = dateCountCache.get(item.journalDate)! + 1;
      dateCountCache.set(item.journalDate, count);

      const prefix = item.journalDate.replace(/-/g, "");
      const journalNumber = `${prefix}-${String(count).padStart(3, "0")}`;

      const dateParts = item.journalDate.split("-");
      const fiscalYear = parseInt(dateParts[0]);
      const fiscalMonth = parseInt(dateParts[1]);

      // 전표 생성
      const journalId = await ctx.db.insert("journals", {
        userId: args.userId,
        journalNumber,
        journalDate: item.journalDate,
        journalType: item.journalType,
        description: item.description,
        totalAmount: item.totalAmount,
        status: "confirmed",
        fiscalYear,
        fiscalMonth,
        aiInput: {
          type: item.inputType,
          amount: item.totalAmount,
          description: item.inputDescription,
        },
      });

      // 분개라인 생성
      for (let i = 0; i < item.entries.length; i++) {
        const entry = item.entries[i];
        const account = accountByCode.get(entry.accountCode);
        if (!account) continue;

        const partner = entry.partnerName
          ? partnerByName.get(entry.partnerName)
          : undefined;

        await ctx.db.insert("journalEntries", {
          journalId,
          lineNumber: i + 1,
          accountId: account._id,
          partnerId: partner?._id,
          debitAmount: entry.debitAmount,
          creditAmount: entry.creditAmount,
          description: entry.description,
        });
      }

      // AI 학습 데이터 저장
      await ctx.db.insert("aiJournalExamples", {
        userId: args.userId,
        inputDescription: item.inputDescription,
        inputType: item.inputType,
        resultEntries: item.entries.map((e) => ({
          accountCode: e.accountCode,
          accountName: accountByCode.get(e.accountCode)?.name ?? e.accountCode,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          partnerName: e.partnerName,
        })),
        wasApproved: true,
        approvedAt: new Date().toISOString(),
      });

      createdIds.push(journalId);
    }

    return {
      created: createdIds.length,
      total: args.items.length,
    };
  },
});
