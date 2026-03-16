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

// 출금 쪽 변환 되돌리기: 201로 잘못 변환된 직접비용을 원래 비용계정으로 복원
export const revertExpenseMigration = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const acc201 = byCode.get("201");
    const acc113 = byCode.get("113");
    const acc531 = byCode.get("531"); // 기본 비용계정 (외주용역비)
    if (!acc201 || !acc113 || !acc531) throw new Error("필수 계정 없음");

    // 세금계산서 매입 거래처 ID 목록
    const taxInvoices = await ctx.db
      .query("taxInvoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const purchasePartnerIds = new Set(
      taxInvoices.filter((t) => t.invoiceType === "purchase").map((t) => t.partnerId)
    );

    // 은행 출금 전표
    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const bankOutJournals = journals.filter(
      (j) => j.status === "confirmed" && j.journalType !== "매출" && j.journalType !== "매입"
    );
    const bankIds = new Set(bankOutJournals.map((j) => j._id));

    const allEntries = await ctx.db.query("journalEntries").collect();

    let reverted = 0;
    let addedVat = 0;
    let kept201 = 0;

    for (const journal of bankOutJournals) {
      const entries = allEntries.filter((e) => e.journalId === journal._id);

      // 201 외상매입금 차변 엔트리 찾기
      const debit201 = entries.filter(
        (e) => e.debitAmount > 0 && e.accountId === acc201._id
      );
      if (debit201.length === 0) continue;

      // 이 전표의 거래처가 세금계산서 거래처인지 확인
      const entryPartnerIds = entries
        .map((e) => e.partnerId)
        .filter(Boolean);
      const hasTaxInvoiceVendor = entryPartnerIds.some((pid) =>
        purchasePartnerIds.has(pid!)
      );

      if (hasTaxInvoiceVendor) {
        // 세금계산서 거래처 → 201 유지
        kept201++;
        continue;
      }

      // 세금계산서 거래처가 아님 → 비용계정으로 되돌리기
      for (const entry of debit201) {
        const totalAmount = entry.debitAmount;
        const supplyAmount = Math.round(totalAmount / 1.1);
        const taxAmount = totalAmount - supplyAmount;

        // 비용계정으로 복원 (공급가액만)
        await ctx.db.patch(entry._id, {
          accountId: acc531._id,
          debitAmount: supplyAmount,
          description: entry.description === "외상매입금 상환" ? undefined : entry.description,
        });

        // 부가세대급금 엔트리 재생성
        if (taxAmount > 0) {
          await ctx.db.insert("journalEntries", {
            journalId: journal._id,
            lineNumber: 99,
            accountId: acc113._id,
            debitAmount: taxAmount,
            creditAmount: 0,
            description: "부가세",
          });
          addedVat++;
        }
        reverted++;
      }
    }

    return { reverted, addedVat, kept201 };
  },
});

// 매입→501 매출원가, 매출 403→401 (마타주 제외) 일괄 변환
export const migrateAccountCodes = mutation({
  args: {
    userId: v.id("users"),
    matajoPartnerName: v.optional(v.string()), // 마타주 거래처명
  },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const acc401 = byCode.get("401"); // 상품매출
    const acc403 = byCode.get("403"); // 용역매출
    const acc501 = byCode.get("501"); // 상품매출원가
    const acc113 = byCode.get("113");
    const acc201 = byCode.get("201");
    if (!acc401 || !acc403 || !acc501 || !acc113 || !acc201)
      throw new Error("필수 계정 없음");

    // 마타주 거래처 ID 찾기
    const partners = await ctx.db
      .query("partners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const matajoPartner = partners.find((p) =>
      p.name.includes("마타주")
    );

    const journals = await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const allEntries = await ctx.db.query("journalEntries").collect();

    let salesConverted = 0;
    let purchaseConverted = 0;

    // === 매출 전표: 403→401 (마타주 제외) ===
    const salesJournals = journals.filter(
      (j) => j.journalType === "매출" && j.status === "confirmed"
    );
    for (const journal of salesJournals) {
      const entries = allEntries.filter((e) => e.journalId === journal._id);
      // 마타주 전표인지 확인
      const isMatajo = matajoPartner &&
        entries.some((e) => e.partnerId === matajoPartner._id);
      if (isMatajo) continue; // 마타주는 403 유지

      for (const entry of entries) {
        if (entry.accountId === acc403._id && entry.creditAmount > 0) {
          await ctx.db.patch(entry._id, { accountId: acc401._id });
          salesConverted++;
        }
      }
    }

    // === 매입 전표: 비용계정/201→501 매출원가 ===
    const purchaseJournals = journals.filter(
      (j) => j.journalType === "매입" && j.status === "confirmed"
    );
    for (const journal of purchaseJournals) {
      const entries = allEntries.filter((e) => e.journalId === journal._id);
      for (const entry of entries) {
        if (entry.debitAmount > 0 && entry.accountId !== acc113._id) {
          // 대변 201은 건드리지 않음
          if (entry.creditAmount > 0) continue;
          if (entry.accountId === acc501._id) continue; // 이미 501
          await ctx.db.patch(entry._id, { accountId: acc501._id });
          purchaseConverted++;
        }
      }
    }

    return { salesJournals: salesJournals.length, salesConverted, purchaseJournals: purchaseJournals.length, purchaseConverted };
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
