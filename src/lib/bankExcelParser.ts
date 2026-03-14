import * as XLSX from "xlsx";

export interface BankTransaction {
  id: string;
  date: string;        // YYYY-MM-DD
  description: string;
  deposit: number;     // 입금
  withdrawal: number;  // 출금
  balance: number;     // 잔액
  memo: string;
}

// 한국 주요 은행 엑셀 컬럼 헤더 매핑
const HEADER_MAPS: Record<string, string>[] = [
  // 기업은행
  { "거래일": "date", "거래일자": "date", "적요": "description", "입금": "deposit", "입금액": "deposit", "출금": "withdrawal", "출금액": "withdrawal", "잔액": "balance", "거래후잔액": "balance", "비고": "memo", "메모": "memo" },
  // 국민은행
  { "거래일시": "date", "내용": "description", "찾으신금액": "withdrawal", "맡기신금액": "deposit", "거래후잔액": "balance" },
  // 신한은행
  { "거래날짜": "date", "기재내용": "description", "출금(원)": "withdrawal", "입금(원)": "deposit", "잔액(원)": "balance" },
];

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

  // YYYY-MM-DD
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
  if (!raw) return 0;
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = String(raw).replace(/[,\s원₩]/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  return Math.round(Number(cleaned)) || 0;
}

function detectHeaderMapping(headers: string[]): Record<string, string> | null {
  const normalized = headers.map((h) => String(h).trim().replace(/\s+/g, ""));

  for (const map of HEADER_MAPS) {
    const keys = Object.keys(map);
    const matches = normalized.filter((h) => keys.some((k) => h.includes(k)));
    if (matches.length >= 3) return map;
  }

  // 폴백: 일반적인 키워드로 매칭
  const fallback: Record<string, string> = {};
  for (const h of normalized) {
    if (h.includes("일") || h.includes("날짜") || h.includes("date")) fallback[h] = "date";
    else if (h.includes("적요") || h.includes("내용") || h.includes("기재")) fallback[h] = "description";
    else if (h.includes("입금") || h.includes("맡기")) fallback[h] = "deposit";
    else if (h.includes("출금") || h.includes("찾으") || h.includes("지급")) fallback[h] = "withdrawal";
    else if (h.includes("잔액") || h.includes("잔고")) fallback[h] = "balance";
    else if (h.includes("비고") || h.includes("메모")) fallback[h] = "memo";
  }

  const fields = new Set(Object.values(fallback));
  if (fields.has("date") && fields.has("description") && (fields.has("deposit") || fields.has("withdrawal"))) {
    return fallback;
  }

  return null;
}

export function parseBankExcel(file: File): Promise<BankTransaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (rows.length === 0) {
          reject(new Error("엑셀 파일에 데이터가 없습니다."));
          return;
        }

        const headers = Object.keys(rows[0]);
        const mapping = detectHeaderMapping(headers);

        if (!mapping) {
          reject(new Error(
            "엑셀 컬럼을 인식할 수 없습니다.\n거래일, 적요, 입금, 출금, 잔액 컬럼이 필요합니다."
          ));
          return;
        }

        // 컬럼 인덱스 매핑
        const colMap: Record<string, string> = {};
        for (const header of headers) {
          const normalized = header.trim().replace(/\s+/g, "");
          for (const [pattern, field] of Object.entries(mapping)) {
            if (normalized.includes(pattern) || normalized === pattern) {
              colMap[field] = header;
              break;
            }
          }
        }

        const transactions: BankTransaction[] = [];
        let counter = 0;

        for (const row of rows) {
          const dateStr = parseDate(colMap.date ? row[colMap.date] : "");
          if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

          const desc = String(colMap.description ? row[colMap.description] : "").trim();
          if (!desc) continue;

          const deposit = parseAmount(colMap.deposit ? row[colMap.deposit] : 0);
          const withdrawal = parseAmount(colMap.withdrawal ? row[colMap.withdrawal] : 0);

          if (deposit === 0 && withdrawal === 0) continue;

          counter++;
          transactions.push({
            id: `tx-${counter}`,
            date: dateStr,
            description: desc,
            deposit,
            withdrawal,
            balance: parseAmount(colMap.balance ? row[colMap.balance] : 0),
            memo: String(colMap.memo ? row[colMap.memo] : "").trim(),
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
