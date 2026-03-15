import * as XLSX from "xlsx";

export interface BankTransaction {
  id: string;
  date: string;        // YYYY-MM-DD
  description: string;
  deposit: number;     // 입금
  withdrawal: number;  // 출금
  balance: number;     // 잔액
  memo: string;
  counterpart: string; // 의뢰인/수취인
}

// 한국 주요 은행 엑셀 컬럼 헤더 매핑
const HEADER_MAPS: Record<string, string>[] = [
  // 기업은행
  { "거래일": "date", "거래일자": "date", "적요": "description", "입금": "deposit", "입금액": "deposit", "출금": "withdrawal", "출금액": "withdrawal", "잔액": "balance", "거래후잔액": "balance", "비고": "memo", "메모": "memo" },
  // 국민은행
  { "거래일시": "date", "내용": "description", "찾으신금액": "withdrawal", "맡기신금액": "deposit", "거래후잔액": "balance" },
  // 신한은행
  { "거래날짜": "date", "기재내용": "description", "출금(원)": "withdrawal", "입금(원)": "deposit", "잔액(원)": "balance" },
  // 하나은행
  { "거래일시": "date", "적요": "description", "입금": "deposit", "출금": "withdrawal", "거래후잔액": "balance", "추가메모": "memo" },
  // 우리은행
  { "거래일": "date", "거래내용": "description", "입금금액": "deposit", "출금금액": "withdrawal", "거래후잔액": "balance" },
  // 농협
  { "거래일": "date", "적요": "description", "맡기기": "deposit", "찾기": "withdrawal", "잔고": "balance" },
];

// ─── 유틸리티 함수 ───

function parseDate(raw: unknown): string {
  if (!raw) return "";

  // Excel date serial number
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }

  const str = String(raw).trim();

  // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}/.test(str)) return str.slice(0, 10).replace(/\./g, "-");
  // YYYYMMDD
  if (/^\d{8}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  // YY.MM.DD or YY-MM-DD
  if (/^\d{2}[.\-/]\d{2}[.\-/]\d{2}$/.test(str)) {
    const parts = str.split(/[.\-/]/);
    return `20${parts[0]}-${parts[1]}-${parts[2]}`;
  }

  return str;
}

function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = String(raw).replace(/[,\s원₩]/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  return Math.round(Number(cleaned)) || 0;
}

// ─── 헤더 행 자동 탐색 ───
function findHeaderRowIndex(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = (rawRows[i] || []).map((v) => String(v ?? "").trim().replace(/\s+/g, ""));

    // 기존 HEADER_MAPS 매칭
    for (const map of HEADER_MAPS) {
      const keys = Object.keys(map);
      const matches = row.filter((h) => keys.some((k) => h.includes(k)));
      if (matches.length >= 3) return i;
    }

    // 폴백: 일반적인 키워드 매칭
    const hasDate = row.some((h) => h.includes("일시") || h.includes("일자") || h === "거래일" || h.includes("날짜"));
    const hasDesc = row.some((h) => h.includes("적요") || h.includes("내용") || h.includes("기재"));
    const hasAmount = row.some((h) => h.includes("입금") || h.includes("출금") || h.includes("맡기") || h.includes("찾으"));
    if (hasDate && hasDesc && hasAmount) return i;
  }
  return -1;
}

// ─── 헤더 → 필드 매핑 ───
function buildColumnMap(headerRow: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};

  // 우선: HEADER_MAPS에서 최다 매칭 맵 선택
  let bestMap: Record<string, string> | null = null;
  let bestScore = 0;

  const normalized = headerRow.map((h) => h.trim().replace(/\s+/g, ""));

  for (const map of HEADER_MAPS) {
    const keys = Object.keys(map);
    const score = normalized.filter((h) => keys.some((k) => h.includes(k))).length;
    if (score > bestScore) {
      bestScore = score;
      bestMap = map;
    }
  }

  if (bestMap && bestScore >= 3) {
    for (let ci = 0; ci < normalized.length; ci++) {
      for (const [pattern, field] of Object.entries(bestMap)) {
        if (normalized[ci].includes(pattern) && colMap[field] === undefined) {
          colMap[field] = ci;
          break;
        }
      }
    }
  }

  // 폴백: 키워드 기반 매칭 (누락 필드 보충)
  for (let ci = 0; ci < normalized.length; ci++) {
    const h = normalized[ci];
    if (colMap.date === undefined && (h.includes("일시") || h.includes("일자") || h === "거래일" || h.includes("날짜"))) colMap.date = ci;
    if (colMap.description === undefined && (h.includes("적요") || h.includes("내용") || h.includes("기재"))) colMap.description = ci;
    if (colMap.deposit === undefined && (h.includes("입금") || h.includes("맡기")) && !h.includes("출금")) colMap.deposit = ci;
    if (colMap.withdrawal === undefined && (h.includes("출금") || h.includes("찾으") || h.includes("지급")) && !h.includes("입금")) colMap.withdrawal = ci;
    if (colMap.balance === undefined && (h.includes("잔액") || h.includes("잔고"))) colMap.balance = ci;
    if (colMap.memo === undefined && (h.includes("비고") || h.includes("메모") || h.includes("추가메모"))) colMap.memo = ci;
    if (colMap.counterpart === undefined && (h.includes("의뢰인") || h.includes("수취인"))) colMap.counterpart = ci;
  }

  return colMap;
}

// ─── 합계 행 판별 ───
function isSummaryRow(row: unknown[]): boolean {
  const text = row.map((v) => String(v ?? "")).join(" ");
  return /합\s*계|총\s*합/.test(text);
}

// ─── 메인 파서 ───
export function parseBankExcel(file: File): Promise<BankTransaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // raw 배열로 읽어서 헤더 자동 탐색
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        if (rawRows.length === 0) {
          reject(new Error("엑셀 파일에 데이터가 없습니다."));
          return;
        }

        const headerIdx = findHeaderRowIndex(rawRows);
        if (headerIdx === -1) {
          reject(new Error(
            "엑셀 컬럼을 인식할 수 없습니다.\n거래일, 적요, 입금, 출금, 잔액 컬럼이 필요합니다.\n지원 은행: 기업, 국민, 신한, 하나, 우리, 농협"
          ));
          return;
        }

        const headerRow = (rawRows[headerIdx] as unknown[]).map((v) => String(v ?? ""));
        const colMap = buildColumnMap(headerRow);

        if (colMap.date === undefined || colMap.description === undefined) {
          reject(new Error("거래일 또는 적요 컬럼을 인식할 수 없습니다."));
          return;
        }

        if (colMap.deposit === undefined && colMap.withdrawal === undefined) {
          reject(new Error("입금 또는 출금 컬럼을 인식할 수 없습니다."));
          return;
        }

        const transactions: BankTransaction[] = [];
        let counter = 0;

        for (let i = headerIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i] as unknown[];
          if (!row || row.length === 0) continue;
          if (isSummaryRow(row)) continue;

          const dateStr = parseDate(row[colMap.date]);
          if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

          const deposit = parseAmount(colMap.deposit !== undefined ? row[colMap.deposit] : 0);
          const withdrawal = parseAmount(colMap.withdrawal !== undefined ? row[colMap.withdrawal] : 0);

          if (deposit === 0 && withdrawal === 0) continue;

          // 적요가 없는 경우 (이자 입금 등) 기본값 부여
          let desc = String(row[colMap.description] ?? "").trim();
          if (!desc) {
            const counterpart = colMap.counterpart !== undefined ? String(row[colMap.counterpart] ?? "").trim() : "";
            desc = counterpart || (deposit > 0 ? "이자입금" : "기타출금");
          }

          counter++;
          transactions.push({
            id: `tx-${counter}`,
            date: dateStr,
            description: desc,
            deposit,
            withdrawal,
            balance: parseAmount(colMap.balance !== undefined ? row[colMap.balance] : 0),
            memo: colMap.memo !== undefined ? String(row[colMap.memo] ?? "").trim() : "",
            counterpart: colMap.counterpart !== undefined ? String(row[colMap.counterpart] ?? "").trim() : "",
          });
        }

        if (transactions.length === 0) {
          reject(new Error("유효한 거래 내역을 찾을 수 없습니다."));
          return;
        }

        // 날짜순 정렬
        transactions.sort((a, b) => a.date.localeCompare(b.date));
        resolve(transactions);
      } catch (err) {
        reject(new Error(`엑셀 파싱 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`));
      }
    };

    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsArrayBuffer(file);
  });
}
