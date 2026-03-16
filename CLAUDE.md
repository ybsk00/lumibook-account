# LumiBooks — 법인결산 회계시스템

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | LumiBooks (루미북스) |
| 목적 | 소규모 법인 결산 및 홈택스 제출용 회계시스템 |
| 사용 모델 | 멀티 어카운트 (1 ID = 1 법인) |
| 핵심 목표 | 전표 입력 → 재무제표 자동 생성 → 홈택스 입력용 데이터 출력 |
| Git | https://github.com/ybsk00/lumibook-account.git |
| Convex dev | admired-manatee-359 (로컬 개발) |
| Convex prod | adept-axolotl-540 (Vercel 실서비스) |
| 배포 | Vercel → https://lumibook.vercel.app |

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | Next.js 16.1.6 (App Router) | React 19, TypeScript |
| DB / 백엔드 | Convex | TypeScript 네이티브, 실시간 반영 |
| 인증 | NextAuth.js v4 | Credentials Provider, Convex HTTP 엔드포인트 연동 |
| AI 엔진 | Gemini 2.5 Flash | 분개 생성, 은행 거래 분류, 재무상태표 PDF 파싱 |
| 스타일링 | Tailwind CSS v4 + shadcn/ui v4 | @base-ui/react (NOT Radix) |
| 폰트 | Pretendard (CDN) | 한글 최적화 |
| 배포 | Vercel | GitHub push 시 자동 배포 |

### shadcn/ui v4 주의사항
- shadcn/ui v4는 Radix가 아닌 `@base-ui/react` 기반
- `asChild` prop 대신 `render` prop 사용
- 컴포넌트 추가: `npx shadcn@latest add <component>`

---

## 디렉토리 구조

```
lumibooks/
├── CLAUDE.md
├── package.json
├── next.config.ts
├── convex/
│   ├── _generated/                     # Convex 자동생성
│   ├── schema.ts                       # DB 스키마 (users 포함, 모든 테이블 userId 필수)
│   ├── auth.ts                         # 사용자 인증 (register, getUser, updateUser, getUserByEmail)
│   ├── http.ts                         # HTTP 엔드포인트 (/auth/verify — NextAuth 서버사이드 검증)
│   ├── accounts.ts                     # 계정과목 CRUD
│   ├── partners.ts                     # 거래처 CRUD
│   ├── journals.ts                     # 전표 CRUD
│   ├── journalEntries.ts              # 분개라인
│   ├── taxInvoices.ts                 # 세금계산서
│   ├── taxInvoiceUpload.ts            # 세금계산서 일괄 업로드 + 자동 분개
│   ├── vatPeriods.ts                  # 부가세 기간
│   ├── openingBalances.ts             # 기초잔액
│   ├── openingBalanceAi.ts            # 재무상태표 PDF AI 파싱 ("use node", Gemini)
│   ├── settings.ts                    # (비어있음 — auth.ts로 이전됨)
│   ├── ledger.ts                      # 원장 조회 (총계정/계정별/거래처별)
│   ├── statements.ts                  # 재무제표 생성 (B/S, P/L, 시산표)
│   ├── hometax.ts                     # 홈택스 출력용 데이터 집계
│   ├── aiJournal.ts                   # AI 분개 생성 ("use node", Gemini action)
│   ├── aiJournalExamples.ts           # AI 학습 데이터
│   ├── bankUpload.ts                  # 은행 거래 업로드
│   ├── bankUploadAi.ts                # 은행 거래 AI 분류 ("use node", Gemini)
│   └── seed.ts                        # 기본 계정과목 시드 (userId 필수)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # 루트 레이아웃 (ConvexProvider + SessionProvider)
│   │   ├── page.tsx                   # → /dashboard 리다이렉트
│   │   ├── auth/
│   │   │   ├── signin/page.tsx        # 로그인 페이지
│   │   │   └── signup/page.tsx        # 회원가입 (자동 계정과목 시드)
│   │   ├── dashboard/page.tsx         # 대시보드
│   │   ├── journals/
│   │   │   ├── page.tsx               # 전표 목록
│   │   │   ├── new/page.tsx           # 전표 입력 (AI 간편 + 수동 + 은행 업로드 + 세금계산서 업로드)
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
│   │   │   └── invoices/page.tsx      # 세금계산서 목록
│   │   ├── export/page.tsx            # 홈택스 출력
│   │   ├── settings/
│   │   │   ├── company/page.tsx       # 회사정보 (users 테이블에서 읽기/쓰기)
│   │   │   ├── accounts/page.tsx      # 계정과목 관리
│   │   │   ├── partners/page.tsx      # 거래처 관리
│   │   │   └── opening/page.tsx       # 기초잔액 (Excel + PDF AI 업로드 + 수동)
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── components/
│   │   ├── ui/                        # shadcn/ui v4 컴포넌트 (@base-ui/react 기반)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx             # useCompanyName() 훅 사용
│   │   │   └── AppShell.tsx
│   │   ├── journal/
│   │   │   ├── SimpleEntryForm.tsx    # AI 간편 입력
│   │   │   ├── AiResultPreview.tsx    # AI 분개 결과 미리보기
│   │   │   ├── ManualEntryForm.tsx    # 수동 전표 입력
│   │   │   ├── BankUploadForm.tsx     # 은행 엑셀 업로드 (3단계 분류)
│   │   │   ├── BankTransactionReviewTable.tsx  # 은행 거래 검토 테이블
│   │   │   ├── TaxInvoiceUploadForm.tsx        # 세금계산서 엑셀 업로드
│   │   │   ├── JournalTable.tsx
│   │   │   └── EntryLineRow.tsx
│   │   ├── statements/
│   │   ├── hometax/
│   │   └── common/
│   │       ├── AccountCombobox.tsx    # userId 전달 필수
│   │       ├── PartnerCombobox.tsx    # userId 전달 필수
│   │       └── ...
│   ├── lib/
│   │   ├── auth.ts                    # NextAuth 설정 (Convex HTTP 엔드포인트 연동)
│   │   ├── convex.ts
│   │   ├── format.ts
│   │   ├── accountRules.ts
│   │   ├── hometaxMapping.ts
│   │   ├── bankExcelParser.ts         # 은행 엑셀 파싱
│   │   └── bankClassificationRules.ts # 은행 거래 분류 규칙
│   └── hooks/
│       ├── useUserId.ts               # JWT에서 userId 추출 (모든 페이지/컴포넌트에서 사용)
│       ├── useCurrentFiscalYear.ts
│       └── ...
```

---

## 환경변수

### .env.local (로컬 개발)
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>
NEXT_PUBLIC_CONVEX_URL=https://admired-manatee-359.convex.cloud
CONVEX_SITE_URL=https://admired-manatee-359.convex.site
```

### Convex 환경변수 (npx convex env set)
```
GOOGLE_AI_API_KEY=<gemini-api-key>
```

### Vercel 환경변수 (prod 배포: adept-axolotl-540)
```
NEXTAUTH_URL=https://lumibook.vercel.app
NEXTAUTH_SECRET=<secret>
NEXT_PUBLIC_CONVEX_URL=https://adept-axolotl-540.convex.cloud
CONVEX_SITE_URL=https://adept-axolotl-540.convex.site
```

> **주의**: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`는 더 이상 사용하지 않음. 사용자 정보는 Convex users 테이블에 저장됨.

### Convex CLI 주의사항 (매우 중요!)
- **`npx convex run`은 항상 dev 배포(admired-manatee-359)를 사용** — 환경변수 오버라이드 안됨
- **prod 데이터 조회/수정**: `npx convex run --prod 'functionName' '{args}'`
- **prod 함수 배포**: `npx convex deploy --yes`
- **dev 함수 배포**: `npx convex dev --once`

### 중복 업로드 방지
- 통장 업로드 (`bankUpload.ts`): `날짜+적요+금액` 기준 중복 체크
- 세금계산서 업로드 (`taxInvoiceUpload.ts`): `날짜+거래처+금액+유형` 기준 중복 체크

### 회계연도 기본값
- 회원가입 시 `currentFiscalYear = 현재년도 - 1` (전년도 결산 기준)
- 모든 페이지에서 `useCurrentFiscalYear()` 훅 사용 (하드코딩 금지)

### DB 관리 함수
- `auth:resetAllData` — 사용자/계정과목 유지, 나머지 전부 삭제
- `auth:updateAllUsersFiscalYear` — 모든 사용자 회계연도 일괄 변경

---

## 인증 — 멀티 어카운트 (Convex 기반)

### 흐름
1. 회원가입 시 `auth.register` mutation → users 테이블에 저장 (bcrypt 해시)
2. 가입 즉시 `seed.seedAccounts({ userId })` → 80개 K-GAAP 계정과목 자동 생성
3. 로그인 시 NextAuth → Convex HTTP `/auth/verify` 엔드포인트로 이메일 검증
4. bcrypt 비밀번호 비교는 Next.js 서버에서 수행
5. JWT에 `userId` (Convex ID) + `companyName` 저장
6. 프론트엔드에서 `useUserId()` 훅으로 userId 추출

### src/lib/auth.ts
- NextAuth v4 Credentials Provider
- `authorize()` → `fetch(CONVEX_SITE_URL/auth/verify)` → bcrypt 비교
- JWT callbacks: `token.userId`, `token.companyName` 저장

### convex/http.ts
- `POST /auth/verify` — 이메일로 사용자 조회, passwordHash 포함 반환

### src/hooks/useUserId.ts
```typescript
export function useUserId(): Id<"users"> | null
export function useCompanyName(): string
```

### 데이터 격리 패턴
모든 Convex 쿼리/뮤테이션에 `userId` 파라미터 필수:
```typescript
const userId = useUserId();
const data = useQuery(api.xxx.list, userId ? { userId, ...args } : "skip");
```

---

## Convex DB 스키마

### 핵심 원칙
- **모든 테이블에 `userId: v.id("users")` 필수** (journalEntries 제외 — journalId로 간접 연결)
- 인덱스: `by_user`, `by_user_code`, `by_user_date`, `by_user_fiscal` 등
- `companySettings` 테이블은 삭제됨 → users 테이블에 회사 정보 통합

### 테이블 목록
| 테이블 | 설명 | userId |
|--------|------|--------|
| users | 사용자 + 회사정보 (email, passwordHash, name=대표자, companyName, businessNumber...) | N/A |
| accounts | K-GAAP 계정과목 80개 (code, name, category, subCategory...) | ✅ |
| partners | 거래처 (businessNumber, name, partnerType...) | ✅ |
| journals | 전표 (journalNumber, journalDate, journalType, totalAmount, status...) | ✅ |
| journalEntries | 분개라인 (journalId, accountId, debitAmount, creditAmount...) | ❌ (journalId) |
| taxInvoices | 세금계산서 (invoiceType, supplyAmount, taxAmount...) | ✅ |
| vatPeriods | 부가세 기간 (periodType, startDate, endDate...) | ✅ |
| openingBalances | 기초잔액 (fiscalYear, accountId, debitBalance, creditBalance) | ✅ |
| aiJournalExamples | AI 학습 데이터 (inputDescription, resultEntries...) | ✅ |

### users 테이블 필드
- `name` = 대표자명 (NOT representative)
- `companyName` = 회사명
- `businessNumber` = 사업자등록번호
- `fiscalYearStart` = 회계연도 시작월 (기본 1)
- `currentFiscalYear` = 현재 회계연도

---

## 기본 계정과목 (K-GAAP, 80개)

### 자산 (1xx) — debit
101 현금, 102 보통예금, 103 정기예금, 108 외상매출금, 109 받을어음,
110 미수금, 111 선급금, 112 선급비용, 113 부가세대급금, 114 가지급금,
115 단기대여금, 120 재고자산, 151 토지, 152 건물, 153 구축물,
154 기계장치, 155 차량운반구, 156 비품, 157 감가상각누계액,
160 무형자산, 161 영업권, 170 장기투자증권, 171 장기대여금, 172 임차보증금

### 부채 (2xx) — credit
201 외상매입금, 202 지급어음, 203 미지급금, 204 미지급비용, 205 선수금,
206 예수금, 207 부가세예수금, 208 단기차입금, 209 유동성장기부채, 210 미지급법인세,
251 장기차입금, 252 사채, 253 퇴직급여충당부채, 254 임대보증금

### 자본 (3xx) — credit
301 자본금, 311 자본잉여금, 321 이익잉여금, 322 이월이익잉여금, 331 자본조정

### 수익 (4xx) — credit
401 상품매출, 402 제품매출, 403 용역매출, 404 기타매출,
451 이자수익, 452 배당금수익, 453 임대료수익, 454 유형자산처분이익, 455 잡이익

### 비용 (5xx) — debit
501 상품매출원가, 502 제품매출원가,
511~531 판관비 (급여, 퇴직급여, 복리후생비, 여비교통비, 통신비, 수도광열비, 세금과공과, 임차료, 감가상각비, 보험료, 수선비, 접대비, 광고선전비, 소모품비, 지급수수료, 차량유지비, 교육훈련비, 도서인쇄비, 회의비, 사무용품비, 외주용역비),
551~554 영업외비용, 590 법인세비용

---

## 핵심 비즈니스 로직

### 복식부기 대차균형
- 전표 저장 시 차변합계 = 대변합계 필수
- 모든 금액은 원(₩) 단위 정수 — 소수점 불가

### 계정 잔액 계산
- 자산·비용: 잔액 = 기초 + 차변 - 대변
- 부채·자본·수익: 잔액 = 기초 + 대변 - 차변

### 전표번호 자동 채번
- 형식: `YYYYMMDD-NNN` (해당 일자 내 순번)

---

## AI 기능

### 1. AI 간편 분개 (convex/aiJournal.ts)
- "use node" action에서 Gemini 2.5 Flash API 직접 호출
- 입금/출금 + 금액 + 한 줄 설명 → 복식부기 분개 자동 생성
- 과거 승인 분개 few-shot 학습 (aiJournalExamples)
- 대차균형 검증 포함

### 2. 은행 거래 3단계 분류 (bankUpload / bankUploadAi)
- 1단계: 규칙 기반 분류 (bankClassificationRules.ts)
- 2단계: 패턴 매칭 분류
- 3단계: Gemini AI 분류
- BankTransactionReviewTable에서 검토/수정 후 일괄 승인

### 3. 세금계산서 일괄 업로드 (taxInvoiceUpload.ts)
- 홈택스 엑셀 파싱 → 세금계산서 + 전표 자동 생성
- 거래처 자동 등록
- 매출/매입 분개 자동 생성 (부가세 자동 분리)

### 4. 재무상태표 PDF 파싱 (openingBalanceAi.ts)
- "use node" action에서 Gemini API 호출
- PDF를 base64로 전송 → 계정별 금액 추출 → 기초잔액 자동 입력

---

## Convex "use node" 규칙
- 외부 API 호출이 필요한 파일은 `"use node"` 선언 필수
- "use node" 파일에는 action만 가능 (query/mutation 불가)
- query/mutation과 action은 반드시 별도 파일로 분리

---

## UI/UX

### 디자인
- Tailwind CSS v4 + shadcn/ui v4 (@base-ui/react 기반)
- Pretendard 폰트
- 금액: 차변=파란색(text-blue-600), 대변=빨간색(text-red-600)
- 인쇄: @media print CSS로 A4 최적화

### 주요 화면
- 전표 입력: 4개 탭 (AI 간편 / 수동 / 은행 업로드 / 세금계산서 업로드)
- 장부조회: 총계정원장, 계정별원장, 거래처별원장
- 재무제표: 재무상태표, 손익계산서, 합계잔액시산표
- 홈택스 출력: 칸번호 매핑 방식 (홈택스 입력 칸 번호와 1:1 대응)
- 설정: 회사정보, 계정과목, 거래처, 기초잔액

---

## 계정 정보
- **실서비스 (prod)**: ybsk00@naver.com (주식회사 루미브리즈)
- **dev 테스트**: admin1@admin.com / admin1234
