import type { BankTransaction } from "./bankExcelParser";

export interface ClassificationResult {
  transactionId: string;
  stage: 1 | 2 | 3;
  confidence: "high" | "medium" | "low";
  journalType: string;
  accountCode: string;
  accountName: string;
  counterAccountCode: string;  // 상대 계정 (보통예금 반대편)
  counterAccountName: string;
  partnerName?: string;
  partnerId?: string;
  vatSeparation: boolean;
  supplyAmount: number;
  taxAmount: number;
  reasoning: string;
}

interface AccountInfo {
  _id: string;
  code: string;
  name: string;
  category: string;
  subCategory: string;
  accountType: string;
}

interface PartnerInfo {
  _id: string;
  name: string;
  businessNumber: string;
  partnerType: string;
}

interface ExampleInfo {
  inputDescription: string;
  inputType: string;
  resultEntries: {
    accountCode: string;
    accountName: string;
    debitAmount: number;
    creditAmount: number;
    partnerName?: string;
  }[];
}

// 1차 분개: 키워드 → 계정과목 매핑
const KEYWORD_RULES: {
  keywords: string[];
  accountCode: string;
  exempt: boolean; // 면세 여부 (부가세 분리 안함)
}[] = [
  // 인건비 (면세)
  { keywords: ["급여", "월급", "상여", "상여금", "급료"], accountCode: "511", exempt: true },
  { keywords: ["퇴직금", "퇴직급여"], accountCode: "512", exempt: true },
  { keywords: ["4대보험", "국민연금", "건강보험", "고용보험", "산재보험", "사회보험"], accountCode: "520", exempt: true },
  { keywords: ["복리후생", "식대", "중식", "야근식대"], accountCode: "513", exempt: true },

  // 임차/시설 (과세)
  { keywords: ["임차료", "월세", "사무실임대", "사무실월세", "임대료"], accountCode: "518", exempt: false },
  { keywords: ["관리비", "건물관리"], accountCode: "518", exempt: false },

  // 통신/유틸리티
  { keywords: ["전기", "전기요금", "한국전력"], accountCode: "516", exempt: true },
  { keywords: ["수도", "수도요금", "가스", "도시가스"], accountCode: "516", exempt: true },
  { keywords: ["통신비", "전화", "인터넷", "KT", "SK텔레콤", "LGU+", "휴대폰"], accountCode: "515", exempt: false },

  // 교통/출장
  { keywords: ["택시", "교통", "주차", "주차비", "고속도로", "톨게이트", "대중교통"], accountCode: "514", exempt: true },
  { keywords: ["출장", "숙박", "항공", "KTX", "기차"], accountCode: "514", exempt: true },

  // 접대/회의
  { keywords: ["접대", "회식"], accountCode: "522", exempt: true },
  { keywords: ["회의", "회의비", "다과"], accountCode: "529", exempt: true },

  // 세금 (면세)
  { keywords: ["세금", "국세", "지방세", "재산세", "자동차세", "주민세", "면허세"], accountCode: "517", exempt: true },
  { keywords: ["법인세중간예납", "법인세"], accountCode: "590", exempt: true },
  { keywords: ["원천세", "원천징수"], accountCode: "206", exempt: true }, // 예수금

  // 수수료
  { keywords: ["수수료", "이체수수료", "카드수수료", "송금수수료"], accountCode: "525", exempt: true },

  // 이자
  { keywords: ["이자", "이자수익", "예금이자"], accountCode: "451", exempt: true }, // 입금시 이자수익
  { keywords: ["이자비용", "대출이자", "이자지급"], accountCode: "551", exempt: true }, // 출금시 이자비용

  // 보험
  { keywords: ["보험", "보험료", "화재보험", "배상책임보험"], accountCode: "520", exempt: true },

  // 차량
  { keywords: ["주유", "주유소", "차량정비", "자동차정비", "세차"], accountCode: "526", exempt: false },

  // 사무용품/소모품
  { keywords: ["사무용품", "문구", "토너", "복사용지"], accountCode: "530", exempt: false },
  { keywords: ["소모품", "청소용품"], accountCode: "524", exempt: false },

  // 광고
  { keywords: ["광고", "홍보", "마케팅", "네이버광고", "구글광고"], accountCode: "523", exempt: false },

  // 외주/용역
  { keywords: ["외주", "용역", "개발비", "디자인비", "컨설팅"], accountCode: "531", exempt: false },

  // 도서/교육
  { keywords: ["도서", "서적", "인쇄", "출판"], accountCode: "528", exempt: true },
  { keywords: ["교육", "훈련", "세미나", "강의"], accountCode: "527", exempt: false },

  // 기부금
  { keywords: ["기부", "기부금", "후원"], accountCode: "552", exempt: true },

  // 매출 (입금 시)
  { keywords: ["매출", "용역매출", "개발대금", "계약금", "중도금", "잔금"], accountCode: "403", exempt: false },
];

// 이자 관련: 입금이면 이자수익, 출금이면 이자비용
function resolveInterestAccount(isDeposit: boolean): string {
  return isDeposit ? "451" : "551";
}

// 1차: 키워드 기반 분류
function classifyByKeyword(
  tx: BankTransaction,
  partners: PartnerInfo[],
  accounts: AccountInfo[],
): ClassificationResult | null {
  const desc = tx.description.toLowerCase();
  const counterpart = (tx.counterpart || "").toLowerCase();
  const searchText = `${desc} ${counterpart}`.trim();
  const isDeposit = tx.deposit > 0;

  // 거래처명 매칭 먼저 (적요 + 의뢰인/수취인 모두 검색)
  let matchedPartner: PartnerInfo | undefined;
  for (const p of partners) {
    const pName = p.name.toLowerCase();
    if (searchText.includes(pName) || pName.includes(desc) || (counterpart && pName.includes(counterpart))) {
      matchedPartner = p;
      break;
    }
  }

  // 키워드 매칭
  for (const rule of KEYWORD_RULES) {
    const matched = rule.keywords.some((kw) => searchText.includes(kw.toLowerCase()));
    if (!matched) continue;

    let code = rule.accountCode;

    // 이자 특수처리
    if (code === "451" && !isDeposit) code = "551";
    if (code === "551" && isDeposit) code = "451";

    const account = accounts.find((a) => a.code === code);
    if (!account) continue;

    const amount = isDeposit ? tx.deposit : tx.withdrawal;
    const vatSep = !rule.exempt && amount > 0;
    const supplyAmount = vatSep ? Math.round(amount / 1.1) : amount;
    const taxAmount = vatSep ? amount - supplyAmount : 0;

    return {
      transactionId: tx.id,
      stage: 1,
      confidence: "high",
      journalType: isDeposit ? "입금" : "출금",
      accountCode: "102",
      accountName: "보통예금",
      counterAccountCode: code,
      counterAccountName: account.name,
      partnerName: matchedPartner?.name,
      partnerId: matchedPartner?._id,
      vatSeparation: vatSep,
      supplyAmount,
      taxAmount,
      reasoning: `키워드 "${rule.keywords.find((kw) => searchText.includes(kw.toLowerCase()))}" 매칭 → ${account.name}`,
    };
  }

  // 거래처만 매칭된 경우 (키워드 없이)
  if (matchedPartner) {
    const isCustomer = matchedPartner.partnerType === "customer" || matchedPartner.partnerType === "both";
    const isVendor = matchedPartner.partnerType === "vendor" || matchedPartner.partnerType === "both";

    if (isDeposit && isCustomer) {
      const amount = tx.deposit;
      const supplyAmount = Math.round(amount / 1.1);
      const taxAmount = amount - supplyAmount;
      return {
        transactionId: tx.id, stage: 1, confidence: "high",
        journalType: "입금", accountCode: "102", accountName: "보통예금",
        counterAccountCode: "403", counterAccountName: "용역매출",
        partnerName: matchedPartner.name, partnerId: matchedPartner._id,
        vatSeparation: true, supplyAmount, taxAmount,
        reasoning: `거래처 "${matchedPartner.name}" 매칭 (매출처) → 용역매출`,
      };
    }
    if (!isDeposit && isVendor) {
      const amount = tx.withdrawal;
      const supplyAmount = Math.round(amount / 1.1);
      const taxAmount = amount - supplyAmount;
      return {
        transactionId: tx.id, stage: 1, confidence: "high",
        journalType: "출금", accountCode: "102", accountName: "보통예금",
        counterAccountCode: "531", counterAccountName: "외주용역비",
        partnerName: matchedPartner.name, partnerId: matchedPartner._id,
        vatSeparation: true, supplyAmount, taxAmount,
        reasoning: `거래처 "${matchedPartner.name}" 매칭 (매입처) → 외주용역비`,
      };
    }
  }

  return null;
}

// 2차: 금액 패턴 매칭
function classifyByAmountPattern(
  tx: BankTransaction,
  examples: ExampleInfo[],
  accounts: AccountInfo[],
): ClassificationResult | null {
  const isDeposit = tx.deposit > 0;
  const amount = isDeposit ? tx.deposit : tx.withdrawal;
  const desc = tx.description.toLowerCase();

  // 과거 동일 금액 + 유사 적요 패턴
  for (const ex of examples) {
    if (!ex.resultEntries || ex.resultEntries.length === 0) continue;

    const exDesc = ex.inputDescription.toLowerCase();
    // 적요 유사도 체크 (2글자 이상 겹치는 단어)
    const descWords = desc.split(/\s+/).filter((w) => w.length >= 2);
    const exWords = exDesc.split(/\s+/).filter((w) => w.length >= 2);
    const overlap = descWords.some((w) => exWords.some((ew) => ew.includes(w) || w.includes(ew)));

    if (!overlap) continue;

    // 상대 계정 찾기 (보통예금이 아닌 계정)
    const counterEntry = ex.resultEntries.find((e) => e.accountCode !== "102");
    if (!counterEntry) continue;

    const account = accounts.find((a) => a.code === counterEntry.accountCode);
    if (!account) continue;

    const vatSep = amount % 11 === 0 && amount > 10000;
    const supplyAmount = vatSep ? Math.round(amount / 1.1) : amount;
    const taxAmount = vatSep ? amount - supplyAmount : 0;

    return {
      transactionId: tx.id, stage: 2, confidence: "medium",
      journalType: isDeposit ? "입금" : "출금",
      accountCode: "102", accountName: "보통예금",
      counterAccountCode: counterEntry.accountCode,
      counterAccountName: counterEntry.accountName,
      partnerName: counterEntry.partnerName,
      vatSeparation: vatSep, supplyAmount, taxAmount,
      reasoning: `과거 유사 거래 패턴: "${ex.inputDescription}" → ${counterEntry.accountName}`,
    };
  }

  // VAT 1.1배수 역산 (과세 거래 추정)
  if (amount % 11 === 0 && amount > 10000) {
    // 이것만으로는 계정을 확정할 수 없으므로 null 반환
    // Stage 3 AI에서 처리
  }

  return null;
}

// 메인 분류 함수: 1차 + 2차 실행
export function classifyTransactionsLocal(
  transactions: BankTransaction[],
  accounts: AccountInfo[],
  partners: PartnerInfo[],
  examples: ExampleInfo[],
): { classified: ClassificationResult[]; unclassified: BankTransaction[] } {
  const classified: ClassificationResult[] = [];
  const unclassified: BankTransaction[] = [];

  for (const tx of transactions) {
    // 1차 시도
    let result = classifyByKeyword(tx, partners, accounts);

    // 2차 시도
    if (!result) {
      result = classifyByAmountPattern(tx, examples, accounts);
    }

    if (result) {
      classified.push(result);
    } else {
      unclassified.push(tx);
    }
  }

  return { classified, unclassified };
}
