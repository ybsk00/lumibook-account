import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByJournal = query({
  args: { journalId: v.id("journals") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_journal", (q) => q.eq("journalId", args.journalId))
      .collect();
    return entries.sort((a, b) => a.lineNumber - b.lineNumber);
  },
});

export const getByAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
  },
});

export const getByPartner = query({
  args: { partnerId: v.id("partners") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalEntries")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
      .collect();
  },
});

export const createBatch = mutation({
  args: {
    journalId: v.id("journals"),
    entries: v.array(
      v.object({
        lineNumber: v.number(),
        accountId: v.id("accounts"),
        partnerId: v.optional(v.id("partners")),
        debitAmount: v.number(),
        creditAmount: v.number(),
        description: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 대차균형 검증
    const totalDebit = args.entries.reduce((sum, e) => sum + e.debitAmount, 0);
    const totalCredit = args.entries.reduce((sum, e) => sum + e.creditAmount, 0);
    if (totalDebit !== totalCredit || totalDebit === 0) {
      throw new Error(
        `대차균형 불일치: 차변 ${totalDebit} ≠ 대변 ${totalCredit}`
      );
    }

    const ids = [];
    for (const entry of args.entries) {
      const id = await ctx.db.insert("journalEntries", {
        journalId: args.journalId,
        ...entry,
      });
      ids.push(id);
    }
    return ids;
  },
});

// 은행 전표 일괄 변환: 매출계정→외상매출금, 비용계정→외상매입금
export const migrateRevenueToReceivable = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 계정과목 조회
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const byCode = new Map(accounts.map((a) => [a.code, a]));

    const acc108 = byCode.get("108"); // 외상매출금
    const acc201 = byCode.get("201"); // 외상매입금
    if (!acc108 || !acc201) throw new Error("108/201 계정이 없습니다.");

    const revenueIds = new Set(
      ["401", "402", "403", "404"].map((c) => byCode.get(c)?._id).filter(Boolean)
    );
    const vatOutId = byCode.get("207")?._id; // 부가세예수금
    const vatInId = byCode.get("113")?._id;  // 부가세대급금

    // 은행 전표 (매출/매입 유형 제외)
    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const bankJournals = journals.filter(
      (j) => j.status === "confirmed" && j.journalType !== "매출" && j.journalType !== "매입"
    );
    const bankJournalIds = new Set(bankJournals.map((j) => j._id));

    // 모든 분개라인
    const allEntries = await ctx.db.query("journalEntries").collect();
    const bankEntries = allEntries.filter((e) => bankJournalIds.has(e.journalId));

    // 전표별 그룹핑
    const byJournal = new Map<string, typeof bankEntries>();
    for (const e of bankEntries) {
      const key = e.journalId;
      if (!byJournal.has(key)) byJournal.set(key, []);
      byJournal.get(key)!.push(e);
    }

    let convertedRevenue = 0;
    let convertedExpense = 0;
    let deletedVat = 0;

    for (const [journalId, entries] of byJournal) {
      const journal = bankJournals.find((j) => j._id === journalId);
      if (!journal) continue;

      // === 입금 전표: 매출계정 → 108 외상매출금 ===
      const revenueEntries = entries.filter(
        (e) => e.creditAmount > 0 && revenueIds.has(e.accountId)
      );
      const vatOutEntries = entries.filter(
        (e) => e.creditAmount > 0 && vatOutId && e.accountId === vatOutId
      );

      if (revenueEntries.length > 0) {
        // 매출+부가세 합산 → 108 외상매출금 1건으로 변환
        const totalCredit = revenueEntries.reduce((s, e) => s + e.creditAmount, 0)
          + vatOutEntries.reduce((s, e) => s + e.creditAmount, 0);

        // 첫 번째 매출 엔트리를 108로 변환
        await ctx.db.patch(revenueEntries[0]._id, {
          accountId: acc108._id,
          creditAmount: totalCredit,
          description: "외상매출금 회수",
        });
        convertedRevenue++;

        // 나머지 매출 엔트리 삭제
        for (let i = 1; i < revenueEntries.length; i++) {
          await ctx.db.delete(revenueEntries[i]._id);
          deletedVat++;
        }
        // 부가세예수금 엔트리 삭제
        for (const ve of vatOutEntries) {
          await ctx.db.delete(ve._id);
          deletedVat++;
        }
      }

      // === 출금 전표: 비용계정(거래처 대금) → 201 외상매입금 ===
      // 비용 계정 차변 + 부가세대급금 차변이 같이 있는 패턴 = 거래처 대금 지급
      const expenseEntries = entries.filter(
        (e) => e.debitAmount > 0 && e.accountId !== byCode.get("102")?._id
          && e.accountId !== vatInId
      );
      const vatInEntries = entries.filter(
        (e) => e.debitAmount > 0 && vatInId && e.accountId === vatInId
      );

      // 부가세대급금이 함께 있으면 거래처 대금 지급으로 판단
      if (expenseEntries.length > 0 && vatInEntries.length > 0) {
        const totalDebit = expenseEntries.reduce((s, e) => s + e.debitAmount, 0)
          + vatInEntries.reduce((s, e) => s + e.debitAmount, 0);

        await ctx.db.patch(expenseEntries[0]._id, {
          accountId: acc201._id,
          debitAmount: totalDebit,
          description: "외상매입금 상환",
        });
        convertedExpense++;

        for (let i = 1; i < expenseEntries.length; i++) {
          await ctx.db.delete(expenseEntries[i]._id);
          deletedVat++;
        }
        for (const ve of vatInEntries) {
          await ctx.db.delete(ve._id);
          deletedVat++;
        }
      }
    }

    return { convertedRevenue, convertedExpense, deletedVat };
  },
});

export const deleteByJournal = mutation({
  args: { journalId: v.id("journals") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_journal", (q) => q.eq("journalId", args.journalId))
      .collect();
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
  },
});
