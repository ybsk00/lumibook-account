import { mutation } from "./_generated/server";
import { v } from "convex/values";

// 세금계산서 일괄 등록 + 자동 전표 생성
export const batchCreateWithJournals = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        invoiceType: v.string(),        // "sales" | "purchase"
        invoiceDate: v.string(),
        invoiceNumber: v.string(),
        partnerName: v.string(),
        partnerBusinessNumber: v.string(),
        supplyAmount: v.number(),
        taxAmount: v.number(),
        totalAmount: v.number(),
        taxType: v.string(),
        description: v.string(),
        // 분개용 비용 계정 (매입 시)
        expenseAccountCode: v.optional(v.string()),
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
    const partnerByBizNum = new Map(
      partners.filter((p) => p.businessNumber).map((p) => [p.businessNumber, p])
    );

    // 중복 방지: 기존 세금계산서 조회 (날짜+거래처+금액 기준)
    const existingInvoices = await ctx.db
      .query("taxInvoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingInvSet = new Set(
      existingInvoices.map((inv) => `${inv.invoiceDate}|${inv.partnerId}|${inv.totalAmount}|${inv.invoiceType}`)
    );

    const dateCountCache = new Map<string, number>();
    let createdInvoices = 0;
    let createdJournals = 0;
    let createdPartners = 0;
    let skippedDuplicates = 0;

    for (const item of args.items) {
      // 1. 거래처 찾기 또는 생성
      let partner = partnerByName.get(item.partnerName)
        ?? (item.partnerBusinessNumber ? partnerByBizNum.get(item.partnerBusinessNumber) : undefined);

      if (!partner) {
        // 신규 거래처 자동 등록
        const partnerId = await ctx.db.insert("partners", {
          userId: args.userId,
          name: item.partnerName,
          businessNumber: item.partnerBusinessNumber || "000-00-00000",
          partnerType: item.invoiceType === "sales" ? "customer" : "vendor",
          isActive: true,
        });
        partner = (await ctx.db.get(partnerId)) ?? undefined;
        if (partner) {
          partnerByName.set(partner.name, partner);
          if (partner.businessNumber) {
            partnerByBizNum.set(partner.businessNumber, partner);
          }
          createdPartners++;
        }
      }

      if (!partner) continue;

      // 중복 체크: 같은 날짜+거래처+금액+유형의 세금계산서가 이미 존재하면 건너뛰기
      const invKey = `${item.invoiceDate}|${partner._id}|${item.totalAmount}|${item.invoiceType}`;
      if (existingInvSet.has(invKey)) {
        skippedDuplicates++;
        continue;
      }
      existingInvSet.add(invKey);

      // 2. 세금계산서 등록
      const invoiceId = await ctx.db.insert("taxInvoices", {
        userId: args.userId,
        invoiceType: item.invoiceType,
        invoiceNumber: item.invoiceNumber || undefined,
        invoiceDate: item.invoiceDate,
        partnerId: partner._id,
        supplyAmount: item.supplyAmount,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
        taxType: item.taxType,
        description: item.description || undefined,
        isElectronic: true,
      });
      createdInvoices++;

      // 3. 전표 자동 생성
      if (!dateCountCache.has(item.invoiceDate)) {
        const existing = await ctx.db
          .query("journals")
          .withIndex("by_user_date", (q) =>
            q.eq("userId", args.userId).eq("journalDate", item.invoiceDate)
          )
          .collect();
        dateCountCache.set(item.invoiceDate, existing.length);
      }
      const count = dateCountCache.get(item.invoiceDate)! + 1;
      dateCountCache.set(item.invoiceDate, count);

      const prefix = item.invoiceDate.replace(/-/g, "");
      const journalNumber = `${prefix}-${String(count).padStart(3, "0")}`;
      const dateParts = item.invoiceDate.split("-");
      const fiscalYear = parseInt(dateParts[0]);
      const fiscalMonth = parseInt(dateParts[1]);

      const journalType = item.invoiceType === "sales" ? "매출" : "매입";
      const desc = item.description
        ? `${item.partnerName} ${item.description}`
        : `${item.partnerName} 세금계산서`;

      const journalId = await ctx.db.insert("journals", {
        userId: args.userId,
        journalNumber,
        journalDate: item.invoiceDate,
        journalType,
        description: desc,
        totalAmount: item.totalAmount,
        status: "confirmed",
        fiscalYear,
        fiscalMonth,
      });

      // 4. 분개라인 생성
      if (item.invoiceType === "sales") {
        // 매출 분개:
        // (차) 외상매출금 108 = totalAmount
        // (대) 매출 401(상품) 또는 403(용역) = supplyAmount
        // (대) 부가세예수금 207 = taxAmount (과세일 때)
        const acc108 = accountByCode.get("108");
        const acc401 = accountByCode.get("401"); // 상품매출 (기본)
        const acc207 = accountByCode.get("207");

        if (acc108) {
          await ctx.db.insert("journalEntries", {
            journalId,
            lineNumber: 1,
            accountId: acc108._id,
            partnerId: partner._id,
            debitAmount: item.totalAmount,
            creditAmount: 0,
            description: desc,
          });
        }

        if (acc401) {
          await ctx.db.insert("journalEntries", {
            journalId,
            lineNumber: 2,
            accountId: acc401._id,
            partnerId: partner._id,
            debitAmount: 0,
            creditAmount: item.supplyAmount,
            description: "공급가액",
          });
        }

        if (item.taxAmount > 0 && acc207) {
          await ctx.db.insert("journalEntries", {
            journalId,
            lineNumber: 3,
            accountId: acc207._id,
            partnerId: partner._id,
            debitAmount: 0,
            creditAmount: item.taxAmount,
            description: "부가세",
          });
        }
      } else {
        // 매입 분개:
        // (차) 비용계정 = supplyAmount
        // (차) 부가세대급금 113 = taxAmount (과세일 때)
        // (대) 외상매입금 201 = totalAmount
        const expCode = item.expenseAccountCode || "501"; // 기본: 매출원가
        const accExp = accountByCode.get(expCode);
        const acc113 = accountByCode.get("113");
        const acc201 = accountByCode.get("201");

        let lineNum = 1;

        if (accExp) {
          await ctx.db.insert("journalEntries", {
            journalId,
            lineNumber: lineNum++,
            accountId: accExp._id,
            partnerId: partner._id,
            debitAmount: item.supplyAmount,
            creditAmount: 0,
            description: "공급가액",
          });
        }

        if (item.taxAmount > 0 && acc113) {
          await ctx.db.insert("journalEntries", {
            journalId,
            lineNumber: lineNum++,
            accountId: acc113._id,
            partnerId: partner._id,
            debitAmount: item.taxAmount,
            creditAmount: 0,
            description: "부가세",
          });
        }

        if (acc201) {
          await ctx.db.insert("journalEntries", {
            journalId,
            lineNumber: lineNum,
            accountId: acc201._id,
            partnerId: partner._id,
            debitAmount: 0,
            creditAmount: item.totalAmount,
            description: desc,
          });
        }
      }

      // 세금계산서에 전표 연결
      await ctx.db.patch(invoiceId, { journalId });
      createdJournals++;
    }

    return {
      invoices: createdInvoices,
      journals: createdJournals,
      newPartners: createdPartners,
      total: args.items.length,
      skippedDuplicates,
    };
  },
});
