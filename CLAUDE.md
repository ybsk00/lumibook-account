# LumiBooks — 루미브리즈 법인결산 회계시스템

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | LumiBooks (루미북스) |
| 목적 | 주식회사 루미브리즈 자체 법인결산 및 홈택스 제출용 회계시스템 |
| 사용자 | 1인 (대표이사 유범석) — 어드민 전용 |
| 회계연도 | 2025년 (제3기) 1월~12월 |
| 핵심 목표 | 전표 입력 → 재무제표 자동 생성 → 홈택스 입력용 데이터 출력 |

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | Next.js 14+ (App Router) | TypeScript |
| DB / 백엔드 | Convex (무료 Starter) | TypeScript 네이티브, 실시간 반영 |
| 인증 | NextAuth.js (Auth.js v5) | Credentials Provider, 1인 어드민 |
| AI 분개 엔진 | Gemini 2.5 Flash | Google AI SDK |
| 스타일링 | Tailwind CSS + shadcn/ui | 라이트/다크 모드 |
| 배포 | Vercel (무료) | |
| 월 비용 | $0 | 전부 무료 플랜 |

---

## 디렉토리 구조

```
lumibooks/
├── CLAUDE.md
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                          # 환경변수
├── convex/
│   ├── _generated/                     # Convex 자동생성
│   ├── schema.ts                       # DB 스키마 정의
│   ├── accounts.ts                     # 계정과목 함수
│   ├── partners.ts                     # 거래처 함수
│   ├── journals.ts                     # 전표 CRUD
│   ├── journalEntries.ts              # 분개라인 함수
│   ├── taxInvoices.ts                 # 세금계산서 함수
│   ├── vatPeriods.ts                  # 부가세 기간 함수
│   ├── openingBalances.ts             # 기초잔액 함수
│   ├── settings.ts                    # 회사설정 함수
│   ├── ledger.ts                      # 원장 조회 (총계정/계정별/거래처별)
│   ├── statements.ts                  # 재무제표 생성 (B/S, P/L, 시산표)
│   ├── hometax.ts                     # 홈택스 출력용 데이터 집계
│   ├── aiJournal.ts                   # AI 분개 생성 (Gemini 연동 action)
│   └── seed.ts                        # 기본 계정과목 시드 데이터
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # 루트 레이아웃
│   │   ├── page.tsx                   # → /dashboard 리다이렉트
│   │   ├── auth/
│   │   │   └── signin/page.tsx        # 로그인 페이지
│   │   ├── dashboard/
│   │   │   └── page.tsx               # 대시보드
│   │   ├── journals/
│   │   │   ├── page.tsx               # 전표 목록
│   │   │   ├── new/page.tsx           # 간편 전표 입력 (AI)
│   │   │   └── [id]/page.tsx          # 전표 상세/수정
│   │   ├── ledger/
│   │   │   ├── general/page.tsx       # 총계정원장
│   │   │   ├── account/page.tsx       # 계정별원장
│   │   │   └── partner/page.tsx       # 거래처별원장
│   │   ├── statements/
│   │   │   ├── balance-sheet/page.tsx # 재무상태표
│   │   │   ├── income/page.tsx        # 손익계산서
│   │   │   └── trial-balance/page.tsx # 합계잔액시산표
│   │   ├── vat/
│   │   │   ├── page.tsx               # 부가세 기간 관리
│   │   │   └── invoices/page.tsx      # 세금계산서 목록/등록
│   │   ├── export/
│   │   │   └── page.tsx               # 홈택스 출력 (표준대차대조표/손익계산서)
│   │   ├── settings/
│   │   │   ├── company/page.tsx       # 회사정보
│   │   │   ├── accounts/page.tsx      # 계정과목 관리
│   │   │   └── partners/page.tsx      # 거래처 관리
│   │   └── api/
│   │       └── auth/[...nextauth]/route.ts  # NextAuth API
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 컴포넌트
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx            # 좌측 사이드바 네비게이션
│   │   │   ├── Header.tsx             # 상단 헤더 (회계연도 선택, 유저 아바타)
│   │   │   └── AppShell.tsx           # Sidebar + Header + Content 래퍼
│   │   ├── journal/
│   │   │   ├── SimpleEntryForm.tsx    # AI 간편 입력 폼
│   │   │   ├── AiResultPreview.tsx    # AI 분개 결과 미리보기
│   │   │   ├── ManualEntryForm.tsx    # 수동 전표 입력 (복식부기)
│   │   │   ├── JournalTable.tsx       # 전표 목록 테이블
│   │   │   └── EntryLineRow.tsx       # 분개라인 행
│   │   ├── statements/
│   │   │   ├── BalanceSheet.tsx       # 재무상태표 렌더링
│   │   │   ├── IncomeStatement.tsx    # 손익계산서 렌더링
│   │   │   └── TrialBalance.tsx       # 합계잔액시산표 렌더링
│   │   ├── hometax/
│   │   │   ├── HometaxBalanceSheet.tsx    # 홈택스용 표준대차대조표
│   │   │   └── HometaxIncomeStatement.tsx # 홈택스용 표준손익계산서
│   │   └── common/
│   │       ├── AmountInput.tsx        # 금액 입력 (천단위 자동 포맷)
│   │       ├── AccountCombobox.tsx    # 계정과목 검색 드롭다운
│   │       ├── PartnerCombobox.tsx    # 거래처 검색 드롭다운
│   │       ├── DateRangePicker.tsx    # 기간 선택
│   │       └── ExportButtons.tsx      # PDF/엑셀/클립보드 출력 버튼
│   ├── lib/
│   │   ├── auth.ts                    # NextAuth 설정
│   │   ├── convex.ts                  # Convex 클라이언트 설정
│   │   ├── gemini.ts                  # Gemini AI 클라이언트
│   │   ├── format.ts                  # 금액 포맷팅 유틸
│   │   ├── accountRules.ts            # 계정과목 분류 규칙
│   │   └── hometaxMapping.ts          # 홈택스 양식 칸번호 매핑
│   └── hooks/
│       ├── useCurrentFiscalYear.ts
│       ├── useJournalValidation.ts    # 대차균형 실시간 검증
│       └── useExport.ts              # PDF/엑셀 출력 훅
```

---

## 환경변수 (.env.local)

```
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>
ADMIN_EMAIL=billy@lumibreeze.com
ADMIN_PASSWORD_HASH=<bcrypt-hash>

# Convex
NEXT_PUBLIC_CONVEX_URL=<convex-deployment-url>
CONVEX_DEPLOY_KEY=<deploy-key>

# Gemini AI
GOOGLE_AI_API_KEY=<gemini-api-key>
```

---

## 인증 — NextAuth Credentials (1인 어드민)

### 설계 원칙
- 사용자는 대표이사 1명뿐이므로 DB에 users 테이블 불필요
- 환경변수에 이메일/비밀번호 해시를 저장하고 Credentials Provider로 검증
- 모든 페이지는 인증 필수 (미인증 시 /auth/signin으로 리다이렉트)

### src/lib/auth.ts

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "LumiBooks Admin",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const isEmailValid = credentials.email === process.env.ADMIN_EMAIL;
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          process.env.ADMIN_PASSWORD_HASH!
        );

        if (isEmailValid && isPasswordValid) {
          return {
            id: "admin",
            name: "유범석",
            email: process.env.ADMIN_EMAIL,
            role: "admin",
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = "admin";
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role as string;
      return session;
    },
  },
});
```

### 로그인 페이지 (/auth/signin)
- 심플한 카드 중앙 정렬 레이아웃
- "LumiBooks" 로고 + 이메일/비밀번호 필드 + 로그인 버튼
- 에러 메시지: "이메일 또는 비밀번호가 올바르지 않습니다"
- 로그인 성공 시 /dashboard로 리다이렉트

### middleware.ts
```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

---

## Convex DB 스키마

### convex/schema.ts

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── 계정과목 ───
  accounts: defineTable({
    code: v.string(),             // "101", "403", "511" 등
    name: v.string(),             // "현금", "용역매출", "급여"
    category: v.string(),         // "자산" | "부채" | "자본" | "수익" | "비용"
    subCategory: v.string(),      // "유동자산", "비유동자산", "매출액", "판관비" 등
    accountType: v.string(),      // "debit" | "credit" (기본 성격)
    isActive: v.boolean(),
    parentCode: v.optional(v.string()),
    taxType: v.optional(v.string()),  // "taxable" | "zero_rated" | "exempt"
    description: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // ─── 거래처 ───
  partners: defineTable({
    businessNumber: v.string(),    // 사업자등록번호 "000-00-00000"
    name: v.string(),
    representative: v.optional(v.string()),
    businessType: v.optional(v.string()),    // 업태
    businessItem: v.optional(v.string()),    // 종목
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    partnerType: v.string(),       // "customer" | "vendor" | "both"
    isActive: v.boolean(),
  })
    .index("by_name", ["name"])
    .index("by_business_number", ["businessNumber"]),

  // ─── 전표 ───
  journals: defineTable({
    journalNumber: v.string(),     // "20251228-001"
    journalDate: v.string(),       // "2025-12-28" (ISO date string)
    journalType: v.string(),       // "입금" | "출금" | "대체" | "매입" | "매출"
    description: v.string(),       // 적요
    totalAmount: v.number(),       // 합계금액 (원 단위 정수)
    status: v.string(),            // "draft" | "confirmed" | "cancelled"
    fiscalYear: v.number(),        // 2025
    fiscalMonth: v.number(),       // 1~12
    // AI 간편입력 원본 데이터 (있을 경우)
    aiInput: v.optional(v.object({
      type: v.string(),            // "입금" | "출금"
      amount: v.number(),
      description: v.string(),
    })),
  })
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
    debitAmount: v.number(),       // 차변 (0이면 대변에 금액)
    creditAmount: v.number(),      // 대변 (0이면 차변에 금액)
    description: v.optional(v.string()),
    taxInvoiceId: v.optional(v.id("taxInvoices")),
  })
    .index("by_journal", ["journalId"])
    .index("by_account", ["accountId"])
    .index("by_partner", ["partnerId"]),

  // ─── 세금계산서 ───
  taxInvoices: defineTable({
    invoiceType: v.string(),       // "sales" | "purchase"
    invoiceNumber: v.optional(v.string()),  // 승인번호
    invoiceDate: v.string(),
    partnerId: v.id("partners"),
    supplyAmount: v.number(),      // 공급가액
    taxAmount: v.number(),         // 세액
    totalAmount: v.number(),       // 합계
    taxType: v.string(),           // "taxable" | "zero_rated" | "exempt"
    description: v.optional(v.string()),
    isElectronic: v.boolean(),
    journalId: v.optional(v.id("journals")),
  })
    .index("by_date", ["invoiceDate"])
    .index("by_type", ["invoiceType"])
    .index("by_partner", ["partnerId"]),

  // ─── 부가세 신고기간 ───
  vatPeriods: defineTable({
    periodType: v.string(),        // "1기확정" | "1기예정" | "2기확정" | "2기예정"
    startDate: v.string(),
    endDate: v.string(),
    fiscalYear: v.number(),
    status: v.string(),            // "open" | "closed" | "filed"
    salesTaxable: v.number(),
    salesZeroRated: v.number(),
    salesExempt: v.number(),
    purchaseTaxable: v.number(),
    outputTax: v.number(),         // 매출세액
    inputTax: v.number(),          // 매입세액
    taxPayable: v.number(),        // 납부(환급)세액
  })
    .index("by_fiscal_year", ["fiscalYear"]),

  // ─── 기초잔액 ───
  openingBalances: defineTable({
    fiscalYear: v.number(),
    accountId: v.id("accounts"),
    debitBalance: v.number(),
    creditBalance: v.number(),
  })
    .index("by_fiscal_year", ["fiscalYear"])
    .index("by_account", ["accountId"]),

  // ─── 회사 설정 ───
  companySettings: defineTable({
    companyName: v.string(),       // "주식회사 루미브리즈"
    businessNumber: v.string(),    // 사업자등록번호
    corporateNumber: v.optional(v.string()), // 법인등록번호
    representative: v.string(),    // "유범석"
    businessType: v.optional(v.string()),
    businessItem: v.optional(v.string()),
    address: v.optional(v.string()),
    fiscalYearStart: v.number(),   // 1 (1월 시작)
    currentFiscalYear: v.number(), // 2025
  }),

  // ─── AI 분개 학습 데이터 ───
  aiJournalExamples: defineTable({
    inputDescription: v.string(),  // 사용자 입력 원문 "캐스팅엔 개발비"
    inputType: v.string(),         // "입금" | "출금"
    resultEntries: v.array(v.object({
      accountCode: v.string(),
      accountName: v.string(),
      debitAmount: v.number(),
      creditAmount: v.number(),
      partnerName: v.optional(v.string()),
    })),
    wasApproved: v.boolean(),      // 사용자가 승인했는지
    approvedAt: v.optional(v.string()),
  })
    .index("by_description", ["inputDescription"]),
});
```

---

## 기본 계정과목 시드 데이터 (K-GAAP)

### convex/seed.ts

seed 함수 실행 시 아래 계정과목을 일괄 삽입한다. isActive: true, sortOrder는 코드 순.

### 자산 (1xx) — category: "자산", accountType: "debit"

| code | name | subCategory |
|------|------|-------------|
| 101 | 현금 | 유동자산 |
| 102 | 보통예금 | 유동자산 |
| 103 | 정기예금 | 유동자산 |
| 108 | 외상매출금 | 유동자산 |
| 109 | 받을어음 | 유동자산 |
| 110 | 미수금 | 유동자산 |
| 111 | 선급금 | 유동자산 |
| 112 | 선급비용 | 유동자산 |
| 113 | 부가세대급금 | 유동자산 |
| 114 | 가지급금 | 유동자산 |
| 115 | 단기대여금 | 유동자산 |
| 120 | 재고자산 | 유동자산 |
| 151 | 토지 | 비유동자산 |
| 152 | 건물 | 비유동자산 |
| 153 | 구축물 | 비유동자산 |
| 154 | 기계장치 | 비유동자산 |
| 155 | 차량운반구 | 비유동자산 |
| 156 | 비품 | 비유동자산 |
| 157 | 감가상각누계액 | 비유동자산 |
| 160 | 무형자산 | 비유동자산 |
| 161 | 영업권 | 비유동자산 |
| 170 | 장기투자증권 | 비유동자산 |
| 171 | 장기대여금 | 비유동자산 |
| 172 | 임차보증금 | 비유동자산 |

### 부채 (2xx) — category: "부채", accountType: "credit"

| code | name | subCategory |
|------|------|-------------|
| 201 | 외상매입금 | 유동부채 |
| 202 | 지급어음 | 유동부채 |
| 203 | 미지급금 | 유동부채 |
| 204 | 미지급비용 | 유동부채 |
| 205 | 선수금 | 유동부채 |
| 206 | 예수금 | 유동부채 |
| 207 | 부가세예수금 | 유동부채 |
| 208 | 단기차입금 | 유동부채 |
| 209 | 유동성장기부채 | 유동부채 |
| 210 | 미지급법인세 | 유동부채 |
| 251 | 장기차입금 | 비유동부채 |
| 252 | 사채 | 비유동부채 |
| 253 | 퇴직급여충당부채 | 비유동부채 |
| 254 | 임대보증금 | 비유동부채 |

### 자본 (3xx) — category: "자본", accountType: "credit"

| code | name | subCategory |
|------|------|-------------|
| 301 | 자본금 | 자본금 |
| 311 | 자본잉여금 | 자본잉여금 |
| 321 | 이익잉여금 | 이익잉여금 |
| 322 | 이월이익잉여금 | 이익잉여금 |
| 331 | 자본조정 | 자본조정 |

### 수익 (4xx) — category: "수익", accountType: "credit"

| code | name | subCategory |
|------|------|-------------|
| 401 | 상품매출 | 매출액 |
| 402 | 제품매출 | 매출액 |
| 403 | 용역매출 | 매출액 |
| 404 | 기타매출 | 매출액 |
| 451 | 이자수익 | 영업외수익 |
| 452 | 배당금수익 | 영업외수익 |
| 453 | 임대료수익 | 영업외수익 |
| 454 | 유형자산처분이익 | 영업외수익 |
| 455 | 잡이익 | 영업외수익 |

### 비용 (5xx) — category: "비용", accountType: "debit"

| code | name | subCategory |
|------|------|-------------|
| 501 | 상품매출원가 | 매출원가 |
| 502 | 제품매출원가 | 매출원가 |
| 511 | 급여 | 판관비 |
| 512 | 퇴직급여 | 판관비 |
| 513 | 복리후생비 | 판관비 |
| 514 | 여비교통비 | 판관비 |
| 515 | 통신비 | 판관비 |
| 516 | 수도광열비 | 판관비 |
| 517 | 세금과공과 | 판관비 |
| 518 | 임차료 | 판관비 |
| 519 | 감가상각비 | 판관비 |
| 520 | 보험료 | 판관비 |
| 521 | 수선비 | 판관비 |
| 522 | 접대비 | 판관비 |
| 523 | 광고선전비 | 판관비 |
| 524 | 소모품비 | 판관비 |
| 525 | 지급수수료 | 판관비 |
| 526 | 차량유지비 | 판관비 |
| 527 | 교육훈련비 | 판관비 |
| 528 | 도서인쇄비 | 판관비 |
| 529 | 회의비 | 판관비 |
| 530 | 사무용품비 | 판관비 |
| 531 | 외주용역비 | 판관비 |
| 551 | 이자비용 | 영업외비용 |
| 552 | 기부금 | 영업외비용 |
| 553 | 유형자산처분손실 | 영업외비용 |
| 554 | 잡손실 | 영업외비용 |
| 590 | 법인세비용 | 법인세비용 |

---

## 핵심 비즈니스 로직

### 복식부기 대차균형 검증

전표 저장 시 반드시 검증. 불일치 시 저장 차단.

```typescript
function validateJournal(entries: JournalEntry[]): { valid: boolean; diff: number } {
  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);
  return {
    valid: totalDebit === totalCredit && totalDebit > 0,
    diff: totalDebit - totalCredit,
  };
}
```

### 계정 잔액 계산

```typescript
// 자산·비용 계정: 잔액 = 기초잔액 + 차변합계 - 대변합계
// 부채·자본·수익 계정: 잔액 = 기초잔액 + 대변합계 - 차변합계
function calculateBalance(
  category: "자산" | "부채" | "자본" | "수익" | "비용",
  openingBalance: number,
  totalDebit: number,
  totalCredit: number,
): number {
  if (category === "자산" || category === "비용") {
    return openingBalance + totalDebit - totalCredit;
  }
  return openingBalance + totalCredit - totalDebit;
}
```

### 금액 처리 규칙

- 모든 금액은 원(₩) 단위 정수(number)로 처리 — 소수점 절대 불가
- 화면 표시 시에만 천단위 콤마 포맷팅: `new Intl.NumberFormat('ko-KR').format(amount)`
- 음수 표시: 빨간색 또는 (괄호) — 설정에 따라
- 감가상각누계액(157)은 자산이지만 음수로 표시

### 전표번호 자동 채번

```typescript
// 형식: YYYYMMDD-NNN (해당 일자 내 순번)
// 예: 20251228-001, 20251228-002
async function generateJournalNumber(date: string): Promise<string> {
  const prefix = date.replace(/-/g, "");
  const existing = await getJournalsByDate(date);
  const seq = String(existing.length + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}
```

---

## AI 간편 분개 엔진

### 개요

사용자가 "입금/출금 + 금액 + 한 줄 설명"만 입력하면 Gemini 2.5 Flash가 복식부기 분개를 자동 생성한다.

### convex/aiJournal.ts (Convex action)

Convex action에서 Gemini API를 호출한다. action은 외부 API 호출이 가능하다.

### Gemini 시스템 프롬프트

```
너는 한국 기업회계기준(K-GAAP)에 따른 복식부기 분개 전문가다.
주식회사 루미브리즈는 AI/소프트웨어 개발 법인이다.

## 사용 가능한 계정과목
{accounts 테이블에서 code + name 목록을 동적 삽입}

## 등록된 거래처
{partners 테이블에서 name + businessNumber 목록을 동적 삽입}

## 과거 승인된 분개 예시
{aiJournalExamples에서 최근 20건 삽입 — few-shot learning}

## 규칙
1. 반드시 차변 합계 = 대변 합계 (대차균형)
2. 과세 거래는 부가세 10% 자동 분리 (공급가액 + 세액)
   - 매출: 부가세예수금(207) 대변
   - 매입: 부가세대급금(113) 차변
3. 면세 거래: 급여, 이자, 4대보험, 보험료 → 부가세 분리 안함
4. 입금 = 보통예금(102) 차변 / 출금 = 보통예금(102) 대변
5. 거래처명이 입력 내용에 포함되면 등록 거래처에서 매칭
6. 100만원 이상 장비/비품 구매는 비품(156)으로, 미만은 소모품비(524)로 처리
7. 결과는 아래 JSON 형식으로만 응답 (마크다운/설명 없이):

{
  "journalType": "매출",
  "entries": [
    {
      "accountCode": "102",
      "accountName": "보통예금",
      "debitAmount": 22000000,
      "creditAmount": 0,
      "partnerName": null,
      "description": "입금"
    },
    {
      "accountCode": "403",
      "accountName": "용역매출",
      "debitAmount": 0,
      "creditAmount": 20000000,
      "partnerName": "캐스팅엔",
      "description": "공급가액"
    },
    {
      "accountCode": "207",
      "accountName": "부가세예수금",
      "debitAmount": 0,
      "creditAmount": 2000000,
      "partnerName": "캐스팅엔",
      "description": "세액"
    }
  ],
  "reasoning": "캐스팅엔 → 등록 거래처 매칭, 개발비 입금 → 용역매출, 과세 거래 → 부가세 10% 분리"
}
```

### AI 분개 흐름

```
[사용자 입력]
  날짜: 2025-12-28
  구분: 입금
  금액: 22,000,000원
  내용: "캐스팅엔 IP Assist 개발비"
       │
       ▼
[프론트엔드] → Convex action 호출
       │
       ▼
[convex/aiJournal.ts]
  1. accounts 테이블에서 활성 계정과목 로드
  2. partners 테이블에서 활성 거래처 로드
  3. aiJournalExamples에서 유사 과거 사례 로드
  4. 시스템 프롬프트 + 사용자 입력 → Gemini 2.5 Flash API 호출
  5. JSON 응답 파싱 + 대차균형 검증
  6. 결과 반환
       │
       ▼
[프론트엔드 — AiResultPreview]
  분개 결과 테이블 + AI 판단 근거 표시
  버튼: [승인 저장] [수정 후 저장] [다시 생성]
       │
       ▼
[승인 저장 클릭 시]
  1. journals 테이블에 전표 생성 (status: "confirmed")
  2. journalEntries에 분개라인 생성
  3. aiJournalExamples에 학습 데이터 저장 (wasApproved: true)
  → 다음번 유사 입력 시 few-shot으로 활용
```

### AI 판단이 애매한 경우

- Gemini가 계정과목을 확정하지 못하면 상위 2~3개 후보를 제시하고 사용자가 선택
- 대차균형이 안 맞는 결과가 나오면 자동 재시도 (최대 2회), 실패 시 수동 입력 폼으로 전환

---

## 장부 조회 (원장)

### 총계정원장 (ledger/general)

**기능**: 선택 기간 내 모든 계정의 기초잔액, 차변합계, 대변합계, 기말잔액을 한 화면에 표시

**Convex 쿼리 로직** (convex/ledger.ts):
1. 해당 회계연도의 openingBalances 로드
2. 기간 내 confirmed 전표의 journalEntries를 accountId별로 그룹핑
3. 각 계정별 SUM(debitAmount), SUM(creditAmount) 계산
4. 계정 category에 따라 기말잔액 = 기초 + (차변-대변) 또는 기초 + (대변-차변)
5. accounts.sortOrder 순서로 정렬

**UI**:
- 상단: 기간 선택 (DateRangePicker), 카테고리 필터 (전체/자산/부채/자본/수익/비용)
- 테이블 컬럼: 계정코드 | 계정명 | 기초잔액 | 차변합계 | 대변합계 | 기말잔액
- 계정명 클릭 → 해당 계정의 계정별원장으로 이동
- 하단: 차변총합/대변총합 표시 (일치 확인)
- 잔액이 0인 계정은 기본 숨김 (토글로 표시 가능)

### 계정별원장 (ledger/account)

**기능**: 특정 계정 하나의 거래 내역을 날짜순으로 표시, 건별 잔액 변동 추적

**Convex 쿼리 로직**:
1. 선택된 accountId + 기간으로 journalEntries 조회
2. 각 entry의 journalId로 journals 조인 → 날짜, 전표번호, 적요 가져오기
3. 기초잔액에서 시작해서 건별 누적 잔액 계산
4. 날짜순 정렬

**UI**:
- 상단: 계정과목 선택 (AccountCombobox), 기간 선택
- 현재 선택된 계정명 + 코드 크게 표시
- 테이블 컬럼: 일자 | 전표번호 | 적요 | 거래처 | 차변 | 대변 | 잔액
- 전표번호 클릭 → 전표 상세 페이지로 이동
- 상단에 기초잔액, 하단에 합계 + 기말잔액

### 거래처별원장 (ledger/partner)

**기능**: 특정 거래처와의 모든 거래 내역 조회. 미수금/미지급금 잔액 파악.

**Convex 쿼리 로직**:
1. 선택된 partnerId로 journalEntries 조회 (by_partner 인덱스)
2. journals + accounts 조인
3. 날짜순 정렬

**UI**:
- 상단: 거래처 선택 (PartnerCombobox), 기간 선택
- 거래처 정보 요약 카드 (상호, 사업자번호, 대표자)
- 테이블 컬럼: 일자 | 전표번호 | 계정과목 | 적요 | 차변 | 대변
- 하단: 매출/매입 합계 요약

---

## 재무제표 자동 생성

### 재무상태표 (statements/balance-sheet)

**계산 로직** (convex/statements.ts):

```
자산총계 = Σ(자산 계정 기말잔액)
  Ⅰ. 유동자산 = Σ(subCategory="유동자산" 계정 잔액)
  Ⅱ. 비유동자산 = Σ(subCategory="비유동자산" 계정 잔액)

부채총계 = Σ(부채 계정 기말잔액)
  Ⅰ. 유동부채 = Σ(subCategory="유동부채" 계정 잔액)
  Ⅱ. 비유동부채 = Σ(subCategory="비유동부채" 계정 잔액)

자본총계 = Σ(자본 계정 기말잔액) + 당기순이익
  ※ 당기순이익 = 수익총합 - 비용총합 (손익계산서에서 계산)

검증: 자산총계 === 부채총계 + 자본총계
```

**UI**:
- 좌우 2단 레이아웃: 왼쪽 "자산의 부", 오른쪽 "부채와 자본의 부"
- 각 계정별 금액 표시 (잔액 0인 계정 숨김 가능)
- 소계/합계 강조 표시
- 대차일치 배지 (일치: 녹색, 불일치: 빨간색 + 차액)
- 기간: "제 3기 2025년 12월 31일 현재"

### 손익계산서 (statements/income)

**계산 로직**:

```
Ⅰ. 매출액 = Σ(subCategory="매출액" 수익 계정)
Ⅱ. 매출원가 = Σ(subCategory="매출원가" 비용 계정)
Ⅲ. 매출총이익 = 매출액 - 매출원가
Ⅳ. 판매비와관리비 = Σ(subCategory="판관비" 비용 계정)
Ⅴ. 영업이익 = 매출총이익 - 판관비
Ⅵ. 영업외수익 = Σ(subCategory="영업외수익" 수익 계정)
Ⅶ. 영업외비용 = Σ(subCategory="영업외비용" 비용 계정)
Ⅷ. 법인세비용차감전순이익 = 영업이익 + 영업외수익 - 영업외비용
Ⅸ. 법인세비용 = Σ(subCategory="법인세비용" 비용 계정)
Ⅹ. 당기순이익 = 법인세비용차감전순이익 - 법인세비용
```

**UI**:
- 단일 컬럼 세로 레이아웃
- 각 단계별 소계 강조
- 판관비는 세부 계정별 금액 표시 (접기/펼치기)
- 기간: "제 3기 2025년 01월 01일 ~ 2025년 12월 31일"

### 합계잔액시산표 (statements/trial-balance)

**UI**:
- 테이블 컬럼: 계정코드 | 계정명 | 차변잔액 | 대변잔액
- 모든 계정 표시 (잔액 있는 것만)
- 하단: 차변잔액 합계 = 대변잔액 합계 (일치 확인)

---

## 부가세 관리

### 세금계산서 (vat/invoices)

- 매출/매입 세금계산서 CRUD
- 전자세금계산서 승인번호, 공급가액, 세액, 합계
- 세금계산서 → 전표 자동 생성 버튼 (AI 분개 또는 정형 분개)

### 부가세 신고 (vat)

- 1기(1~6월), 2기(7~12월) 확정/예정 기간 관리
- 기간별 매출/매입 세금계산서 자동 집계
- 매출세액 - 매입세액 = 납부(환급)세액 자동 계산

---

## 홈택스 출력 (/export)

### 핵심: 홈택스 입력 칸번호와 1:1 매핑

사용자가 홈택스 법인세 전자신고 화면 옆에 LumiBooks 출력 화면을 띄워놓고 같은 칸번호끼리 숫자를 옮겨 입력하는 방식.

### 표준대차대조표 (별지 제3호의2)

**홈택스 칸번호 매핑** (src/lib/hometaxMapping.ts):

```typescript
// 자산의 부
export const BS_ASSET_MAPPING = [
  { field: 1, accountCodes: ["101"], label: "현금" },
  { field: 2, accountCodes: ["102", "103"], label: "예금" },
  { field: 3, accountCodes: ["108"], label: "외상매출금" },
  { field: 4, accountCodes: ["109"], label: "받을어음" },
  { field: 5, accountCodes: ["110"], label: "미수금" },
  { field: 6, accountCodes: ["111"], label: "선급금" },
  { field: 7, accountCodes: ["112"], label: "선급비용" },
  { field: 8, accountCodes: ["113"], label: "부가세대급금" },
  { field: 9, accountCodes: ["114", "115"], label: "가지급금·단기대여금" },
  { field: 10, accountCodes: ["120"], label: "재고자산" },
  // ... 유동자산 소계
  { field: 20, accountCodes: ["151"], label: "토지" },
  { field: 21, accountCodes: ["152"], label: "건물" },
  { field: 22, accountCodes: ["154"], label: "기계장치" },
  { field: 23, accountCodes: ["155", "156"], label: "차량·비품" },
  { field: 24, accountCodes: ["157"], label: "감가상각누계액", negative: true },
  { field: 25, accountCodes: ["160", "161"], label: "무형자산" },
  { field: 26, accountCodes: ["170"], label: "투자자산" },
  { field: 27, accountCodes: ["172"], label: "임차보증금" },
  // ... 비유동자산 소계, 자산총계
];

// 부채의 부
export const BS_LIABILITY_MAPPING = [
  { field: 31, accountCodes: ["201"], label: "외상매입금" },
  { field: 32, accountCodes: ["202"], label: "지급어음" },
  { field: 33, accountCodes: ["203"], label: "미지급금" },
  { field: 34, accountCodes: ["204"], label: "미지급비용" },
  { field: 35, accountCodes: ["205"], label: "선수금" },
  { field: 36, accountCodes: ["206"], label: "예수금" },
  { field: 37, accountCodes: ["207"], label: "부가세예수금" },
  { field: 38, accountCodes: ["208"], label: "단기차입금" },
  { field: 39, accountCodes: ["210"], label: "미지급법인세" },
  // ... 유동부채 소계
  { field: 45, accountCodes: ["251"], label: "장기차입금" },
  { field: 46, accountCodes: ["253"], label: "퇴직급여충당부채" },
  // ... 비유동부채 소계, 부채총계
];

// 자본의 부
export const BS_EQUITY_MAPPING = [
  { field: 51, accountCodes: ["301"], label: "자본금" },
  { field: 52, accountCodes: ["311"], label: "자본잉여금" },
  { field: 53, accountCodes: ["321", "322"], label: "이익잉여금" },
  { field: 54, accountCodes: ["331"], label: "자본조정" },
  // ... 자본총계, 부채와자본총계
];
```

### 표준손익계산서 (별지 제3호의3)

```typescript
export const IS_MAPPING = [
  { field: 1, accountCodes: ["401", "402", "403", "404"], label: "매출액" },
  { field: 2, accountCodes: ["501", "502"], label: "매출원가" },
  // field: 3 = 매출총이익 (계산)
  { field: 4, accountCodes: ["511"], label: "급여" },
  { field: 5, accountCodes: ["512"], label: "퇴직급여" },
  { field: 6, accountCodes: ["513"], label: "복리후생비" },
  { field: 7, accountCodes: ["518"], label: "임차료" },
  { field: 8, accountCodes: ["522"], label: "접대비" },
  { field: 9, accountCodes: ["519"], label: "감가상각비" },
  { field: 10, accountCodes: ["517"], label: "세금과공과" },
  { field: 11, accountCodes: ["523"], label: "광고선전비" },
  { field: 12, accountCodes: ["525"], label: "지급수수료" },
  { field: 13, accountCodes: ["531"], label: "외주용역비" },
  { field: 14, accountCodes: ["514", "515", "516", "520", "521", "524", "526", "527", "528", "529", "530"], label: "기타 판관비" },
  // field: 15 = 판관비 소계 (합산)
  // field: 16 = 영업이익 (계산)
  { field: 17, accountCodes: ["451", "452", "453", "454", "455"], label: "영업외수익" },
  { field: 18, accountCodes: ["551", "552", "553", "554"], label: "영업외비용" },
  // field: 19 = 법인세비용차감전순이익 (계산)
  { field: 20, accountCodes: ["590"], label: "법인세비용" },
  // field: 21 = 당기순이익 (계산)
];
```

### 출력 UI

- 화면 상단: "홈택스 입력용 — 표준대차대조표" / "표준손익계산서" 탭 전환
- 각 행: (칸번호) | 과목명 | 금액 — 홈택스 입력 칸 번호와 동일
- 소계/합계 행은 배경색 강조
- 안내 문구: "* (칸) 번호는 홈택스 입력 칸 번호와 동일합니다"
- 출력 버튼: PDF 다운로드 / 엑셀 다운로드 / 클립보드 복사
- 클립보드 복사: 칸번호 탭 금액 형식으로 복사 (홈택스 붙여넣기용)

---

## UI/UX 설계

### 디자인 시스템

- **프레임워크**: Tailwind CSS + shadcn/ui
- **테마**: 라이트 모드 기본 (다크 모드 지원)
- **폰트**: Pretendard (한글 최적화) — CDN으로 로드
- **금액 컬러**: 차변(파란색 text-blue-600), 대변(빨간색 text-red-600), 잔액(기본)
- **컴포넌트**: shadcn/ui의 Table, Combobox, Dialog, Sheet, Button, Input, Select, Card 활용
- **인쇄**: 재무제표/홈택스 출력 화면은 @media print CSS로 A4 최적화

### 전체 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ [Sidebar 200px]  │  [Header - 회계연도, 유저 아바타]  │
│                  │  ────────────────────────────────  │
│ LumiBooks        │                                    │
│                  │  [Content Area]                    │
│ ─ 전표관리       │                                    │
│   전표 입력      │                                    │
│   전표 목록      │                                    │
│                  │                                    │
│ ─ 장부조회       │                                    │
│   총계정원장     │                                    │
│   계정별원장     │                                    │
│   거래처별원장   │                                    │
│                  │                                    │
│ ─ 재무제표       │                                    │
│   재무상태표     │                                    │
│   손익계산서     │                                    │
│   합계잔액시산표 │                                    │
│                  │                                    │
│ ─ 부가세         │                                    │
│   세금계산서     │                                    │
│   부가세 신고    │                                    │
│                  │                                    │
│ ─ 홈택스 출력    │                                    │
│   표준대차대조표 │                                    │
│   표준손익계산서 │                                    │
│                  │                                    │
│ ─ 설정           │                                    │
│   회사정보       │                                    │
│   계정과목       │                                    │
│   거래처         │                                    │
└──────────────────────────────────────────────────────┘
```

### Sidebar (components/layout/Sidebar.tsx)

- 너비 200px 고정, 좌측 배치
- 상단: "LumiBooks" 로고 텍스트
- 메뉴 그룹: 라벨(11px 대문자, text-muted) + 하위 메뉴 아이템(13px)
- 현재 활성 메뉴: 파란색 배경 + 우측 2px 보더
- 하단: 로그아웃 버튼

### Header (components/layout/Header.tsx)

- 좌측: 현재 페이지 제목 + 회계연도 ("제 3기 2025.01.01 ~ 2025.12.31")
- 우측: 회계연도 선택 드롭다운 + 유저 아바타 ("YB" 이니셜)

### 대시보드 (/dashboard)

**메트릭 카드 4개** (grid 4열):
1. 당기 매출액 (파란색)
2. 당기 비용 (기본)
3. 당기순이익 (파란색)
4. 미처리 전표 수 (경고색)

**좌측 카드**: 최근 전표 5건 (일자, 적요, 금액)
**우측 카드**: 결산 체크리스트
- ✅ 전표 입력 완료
- ✅ 세금계산서 대사 완료
- ⚠️ 감가상각비 계상 (미처리)
- ○ 법인세 추산
- ○ 재무제표 확정
- ○ 홈택스 제출

### 간편 전표 입력 (/journals/new)

이 화면이 가장 핵심. 두 가지 모드:

**[탭 1] AI 간편 입력** (기본):
- 날짜 선택
- 입금/출금 토글 버튼
- 금액 입력 (AmountInput — 천단위 자동 포맷)
- 내용 한 줄 텍스트 입력 (placeholder: "예: 사무실 월세, 캐스팅엔 개발비...")
- [AI 분개 생성] 버튼 → 로딩 → AiResultPreview 표시
- AiResultPreview: 분개라인 테이블 + AI 판단 근거 + [승인 저장] [수정 후 저장] [다시 생성]

**[탭 2] 수동 입력**:
- 기존 복식부기 전표 입력 폼
- 전표 헤더: 일자, 유형, 적요
- 분개라인 테이블: # | 계정과목(Combobox) | 거래처(Combobox) | 차변 | 대변 | 적요 | 삭제(×)
- [+ 라인 추가] 버튼
- 하단: 차변합계 / 대변합계 / 대차균형 배지
- 키보드 네비게이션: Tab/Enter로 빠르게 이동

### 전표 목록 (/journals)

- 상단: 기간 선택, 상태 필터 (전체/임시/승인/취소), 검색 (전표번호/적요)
- 테이블: 전표번호 | 일자 | 유형 | 적요 | 금액 | 상태
- 상태 배지: draft=회색, confirmed=녹색, cancelled=빨간색
- 행 클릭 → 전표 상세/수정

### 금액 입력 컴포넌트 (AmountInput)

- 숫자만 입력 허용
- 입력 중에도 천단위 콤마 실시간 표시
- 우측 정렬
- 포커스 시 전체 선택 (빠른 덮어쓰기)

### 계정과목 Combobox (AccountCombobox)

- 코드 또는 이름으로 검색 가능
- 드롭다운에 "101 현금", "403 용역매출" 형식 표시
- 카테고리별 그루핑 (자산/부채/자본/수익/비용)
- 최근 사용 계정 상단 노출

### 재무제표/홈택스 출력 화면

- 화면 보기 + 인쇄용 CSS 분리 (@media print)
- 출력 버튼: PDF (jspdf + jspdf-autotable), 엑셀 (xlsx), 클립보드
- 인쇄 시 A4 세로 기준, 회사명/기간/제목 헤더 포함

---

## 결산 워크플로우 (사용자 관점)

```
1. [설정] 회사정보 입력, 계정과목 확인
2. [설정] 거래처 등록 (캐스팅엔, 서울온케어 등)
3. [설정] 기초잔액 입력 (전기 이월)
4. [전표 입력] 1년치 통장 거래를 AI 간편 입력으로 전표 생성
   → 건건이 입금/출금/금액/내용 입력 → AI 분개 → 승인
   → 또는 엑셀 일괄 업로드 (향후)
5. [장부조회] 총계정원장에서 전체 현황 확인
6. [장부조회] 계정별원장에서 통장 대사 (보통예금 잔액 = 실제 통장 잔액?)
7. [부가세] 세금계산서 대사 확인
8. [전표 입력] 결산 정리 분개 (수동 입력)
   - 감가상각비 계상
   - 미수/미지급 정리
   - 법인세 추산 계상
9. [재무제표] 재무상태표/손익계산서 확인 → 대차일치 확인
10. [홈택스 출력] 표준대차대조표/표준손익계산서 출력
11. [홈택스] 출력물 보면서 홈택스에 숫자 입력 → 전자신고 완료
```

---

## 법인세 관련 참고사항

- 이 시스템은 **회계장부 기록 및 재무제표 생성** 도구
- **세무조정**은 시스템 범위 밖 (세무사 검토 필요)
- 법인세 신고서 자체는 홈택스에서 직접 작성, 본 시스템은 기초 데이터 제공
- 12월 결산 법인 → 매년 3월 31일까지 법인세 신고
- 루미브리즈 예상 세율: 과세표준 2억 이하 9%, 2억 초과~200억 이하 19%

---

## 구현 순서 (Phase)

### Phase 1 — 기반 (우선)
1. Next.js 프로젝트 초기 설정 (App Router, TypeScript, Tailwind, shadcn/ui)
2. Convex 프로젝트 생성 + schema.ts 배포
3. NextAuth 설정 + 로그인 페이지
4. AppShell 레이아웃 (Sidebar + Header)
5. 계정과목 시드 데이터 삽입
6. 회사정보 설정 페이지
7. Pretendard 폰트 적용

### Phase 2 — 전표 + AI
1. 거래처 CRUD
2. AI 간편 전표 입력 (Gemini 연동)
3. 수동 전표 입력 (복식부기)
4. 전표 목록/조회/수정/삭제
5. 전표 승인 워크플로우
6. AI 학습 데이터 축적 로직

### Phase 3 — 장부 + 재무제표
1. 총계정원장
2. 계정별원장
3. 거래처별원장
4. 합계잔액시산표
5. 재무상태표 자동 생성
6. 손익계산서 자동 생성
7. 기초잔액 설정

### Phase 4 — 부가세 + 홈택스
1. 세금계산서 등록/관리
2. 부가세 기간 관리
3. 부가세 신고 데이터 집계
4. 홈택스 표준대차대조표 출력
5. 홈택스 표준손익계산서 출력
6. PDF/엑셀/클립보드 출력 기능

### Phase 5 — 고도화 (선택)
1. 엑셀 일괄 전표 업로드 (통장 내역 CSV)
2. 이익잉여금처분계산서
3. 감가상각 자동 계산
4. 결산 마감 처리
5. 전기 이월 자동화

---

## 패키지 의존성

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "convex": "latest",
    "next-auth": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "@google/generative-ai": "latest",
    "tailwindcss": "^3.x",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "date-fns": "^3.x",
    "xlsx": "^0.18.x",
    "jspdf": "^2.x",
    "jspdf-autotable": "^3.x",
    "recharts": "^2.x",
    "zod": "^3.x",
    "react-hook-form": "^7.x",
    "@hookform/resolvers": "latest"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/bcryptjs": "latest"
  }
}
```
