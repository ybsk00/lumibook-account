import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── 사용자 (1 ID = 1 법인) ───
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),              // 대표자명
    companyName: v.string(),       // 회사명
    businessNumber: v.string(),    // 사업자등록번호
    corporateNumber: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    fiscalYearStart: v.number(),   // 1 (1월)
    currentFiscalYear: v.number(), // 2025
  })
    .index("by_email", ["email"]),

  // ─── 계정과목 ───
  accounts: defineTable({
    userId: v.id("users"),
    code: v.string(),
    name: v.string(),
    category: v.string(),
    subCategory: v.string(),
    accountType: v.string(),
    isActive: v.boolean(),
    parentCode: v.optional(v.string()),
    taxType: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_code", ["userId", "code"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_code", ["code"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // ─── 거래처 ───
  partners: defineTable({
    userId: v.id("users"),
    businessNumber: v.string(),
    name: v.string(),
    representative: v.optional(v.string()),
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    partnerType: v.string(),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_name", ["name"])
    .index("by_business_number", ["businessNumber"]),

  // ─── 전표 ───
  journals: defineTable({
    userId: v.id("users"),
    journalNumber: v.string(),
    journalDate: v.string(),
    journalType: v.string(),
    description: v.string(),
    totalAmount: v.number(),
    status: v.string(),
    fiscalYear: v.number(),
    fiscalMonth: v.number(),
    aiInput: v.optional(
      v.object({
        type: v.string(),
        amount: v.number(),
        description: v.string(),
      })
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "journalDate"])
    .index("by_user_fiscal", ["userId", "fiscalYear"])
    .index("by_date", ["journalDate"])
    .index("by_fiscal", ["fiscalYear", "fiscalMonth"])
    .index("by_status", ["status"])
    .index("by_number", ["journalNumber"]),

  // ─── 분개라인 ───
  journalEntries: defineTable({
    journalId: v.id("journals"),
    lineNumber: v.number(),
    accountId: v.id("accounts"),
    partnerId: v.optional(v.id("partners")),
    debitAmount: v.number(),
    creditAmount: v.number(),
    description: v.optional(v.string()),
    taxInvoiceId: v.optional(v.id("taxInvoices")),
  })
    .index("by_journal", ["journalId"])
    .index("by_account", ["accountId"])
    .index("by_partner", ["partnerId"]),

  // ─── 세금계산서 ───
  taxInvoices: defineTable({
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
    journalId: v.optional(v.id("journals")),
  })
    .index("by_user", ["userId"])
    .index("by_date", ["invoiceDate"])
    .index("by_type", ["invoiceType"])
    .index("by_partner", ["partnerId"]),

  // ─── 부가세 신고기간 ───
  vatPeriods: defineTable({
    userId: v.id("users"),
    periodType: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    fiscalYear: v.number(),
    status: v.string(),
    salesTaxable: v.number(),
    salesZeroRated: v.number(),
    salesExempt: v.number(),
    purchaseTaxable: v.number(),
    outputTax: v.number(),
    inputTax: v.number(),
    taxPayable: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_fiscal_year", ["fiscalYear"]),

  // ─── 기초잔액 ───
  openingBalances: defineTable({
    userId: v.id("users"),
    fiscalYear: v.number(),
    accountId: v.id("accounts"),
    debitBalance: v.number(),
    creditBalance: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_fiscal", ["userId", "fiscalYear"])
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_account", ["accountId"]),

  // ─── AI 분개 학습 데이터 ───
  aiJournalExamples: defineTable({
    userId: v.id("users"),
    inputDescription: v.string(),
    inputType: v.string(),
    resultEntries: v.array(
      v.object({
        accountCode: v.string(),
        accountName: v.string(),
        debitAmount: v.number(),
        creditAmount: v.number(),
        partnerName: v.optional(v.string()),
      })
    ),
    wasApproved: v.boolean(),
    approvedAt: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_description", ["inputDescription"]),

  // ─── 온라인매출 ───
  onlineSales: defineTable({
    userId: v.id("users"),
    salesPeriod: v.string(),       // "2025-01" (YYYY-MM)
    count: v.number(),             // 건수
    salesAmount: v.number(),       // 판매금액
    platformName: v.string(),      // "네이버쇼핑", "쿠팡" 등
    periodLabel: v.string(),       // "1기" | "2기"
    fiscalYear: v.number(),
    journalId: v.optional(v.id("journals")),
  })
    .index("by_user", ["userId"])
    .index("by_user_fiscal", ["userId", "fiscalYear"])
    .index("by_platform", ["platformName"]),

  // ─── 사업용신용카드 ───
  creditCardExpenses: defineTable({
    userId: v.id("users"),
    period: v.string(),            // "2025-01" (YYYY-MM)
    paymentAmount: v.number(),     // 결제금액
    vatAmount: v.number(),         // 부가세
    totalAmount: v.number(),       // 합계
    periodLabel: v.string(),       // "1기" | "2기"
    fiscalYear: v.number(),
    journalId: v.optional(v.id("journals")),
  })
    .index("by_user", ["userId"])
    .index("by_user_fiscal", ["userId", "fiscalYear"]),
});
