import * as XLSX from "xlsx";

export interface OnlineSalesRow {
  id: string;
  salesPeriod: string;        // "2025-01" (YYYY-MM)
  count: number;              // 건수
  salesAmount: number;        // 판매금액
  platformName: string;       // 판매처명
  periodLabel: string;        // "1기" | "2기"
}

export interface OnlineSalesParseResult {
  rows: OnlineSalesRow[];
  period: { start: string; end: string } | null;
  periodLabel: string;
}

// ─── 헤더 패턴 매핑 ───
const HEADER_PATTERNS: Record<string, string> = {
  "번호": "seq",
  "판매기간": "salesPeriod",
  "기간": "salesPeriod",
  "건수": "count",
  "판매금액": "salesAmount",
  "금액": "salesAmount",
  "판매처": "platformName",
  "판매자": "platformName",
  "상호": "platformName",
  "판매처명": "platformName",
};

// ─── 유틸리티 ───

function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = String(raw).replace(/[,\s원₩\-]/g, "").trim();
  if (!cleaned) return 0;
  return Math.round(Number(cleaned)) || 0;
}

// ─── 거래기간 추출 ───
function extractPeriod(rawRows: unknown[][]): { start: string; end: string } | null {
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const text = (rawRows[i] || []).map((v) => String(v ?? "")).join(" ");
    const match = text.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    if (match) return { start: match[1], end: match[2] };
  }
  return null;
}

// ─── 기수 판별 ───
function detectPeriodLabel(period: { start: string; end: string } | null): string {
  if (!period) return "";
  const endMonth = parseInt(period.end.split("-")[1]);
  return endMonth <= 6 ? "1기" : "2기";
}

// ─── 헤더 행 탐색 ───
function findHeaderRow(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = (rawRows[i] || []).map((v) => String(v ?? "").trim());
    const hasPeriod = row.some((c) => c.includes("판매기간") || c.includes("기간"));
    const hasAmount = row.some((c) => c.includes("판매금액") || c.includes("금액"));
    const hasPlatform = row.some((c) => c.includes("판매처") || c.includes("판매자") || c.includes("상호"));
    if ((hasPeriod || hasAmount) && hasPlatform) return i;
    // Also try: if row has both 건수 and 금액
    const hasCount = row.some((c) => c.includes("건수"));
    if (hasCount && hasAmount) return i;
  }
  return -1;
}

// ─── 합계/소계 행 판별 ───
function isSummaryRow(values: string[]): boolean {
  const text = values.join(" ");
  return /합계|소계|총계|Total/i.test(text.trim());
}

// ─── 판매기간으로부터 기수 판별 ───
function detectPeriodLabelFromMonth(salesPeriod: string): string {
  if (!salesPeriod) return "";
  const month = parseInt(salesPeriod.split("-")[1]);
  if (isNaN(month)) return "";
  return month <= 6 ? "1기" : "2기";
}

// ─── 메인 파서 ───
export function parseOnlineSalesExcel(file: File): Promise<OnlineSalesRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const allRows: OnlineSalesRow[] = [];
        let counter = 0;

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
          if (rawRows.length === 0) continue;

          const period = extractPeriod(rawRows);
          const periodLabel = detectPeriodLabel(period);
          const headerIdx = findHeaderRow(rawRows);

          if (headerIdx === -1) continue;

          const headerRow = rawRows[headerIdx].map((v) => String(v ?? "").trim());

          // Column index mapping
          const colMap: Record<string, number> = {};
          for (let ci = 0; ci < headerRow.length; ci++) {
            const normalized = headerRow[ci].replace(/\s+/g, "");
            for (const [pattern, field] of Object.entries(HEADER_PATTERNS)) {
              if (normalized.includes(pattern)) {
                if (colMap[field] === undefined) colMap[field] = ci;
                break;
              }
            }
          }

          for (let i = headerIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i] || [];
            if (row.length === 0) continue;

            const values = row.map((v) => String(v ?? ""));
            if (isSummaryRow(values)) continue;

            // Extract sales period (YYYY-MM format)
            let salesPeriod = "";
            if (colMap.salesPeriod !== undefined) {
              const raw = String(row[colMap.salesPeriod] ?? "").trim();
              // Handle formats: "2025-01", "2025.01", "202501", "2025/01"
              if (/^\d{4}[-./]\d{2}$/.test(raw)) {
                salesPeriod = raw.replace(/[./]/g, "-");
              } else if (/^\d{6}$/.test(raw)) {
                salesPeriod = `${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
              } else if (raw) {
                salesPeriod = raw;
              }
            }

            const salesAmount = parseAmount(colMap.salesAmount !== undefined ? row[colMap.salesAmount] : 0);
            const count = parseAmount(colMap.count !== undefined ? row[colMap.count] : 0);
            const platformName = colMap.platformName !== undefined
              ? String(row[colMap.platformName] ?? "").trim()
              : "";

            // Skip rows with no meaningful data
            if (!salesPeriod && salesAmount === 0) continue;
            if (!platformName && salesAmount === 0) continue;

            counter++;
            allRows.push({
              id: `os-${counter}`,
              salesPeriod: salesPeriod || "",
              count: count || 0,
              salesAmount,
              platformName: platformName || "기타",
              periodLabel: periodLabel || detectPeriodLabelFromMonth(salesPeriod),
            });
          }
        }

        if (allRows.length === 0) {
          reject(new Error(
            "유효한 온라인매출 데이터를 찾을 수 없습니다.\n판매기간, 판매금액, 판매처 컬럼이 필요합니다."
          ));
          return;
        }

        allRows.sort((a, b) => a.salesPeriod.localeCompare(b.salesPeriod));
        resolve(allRows);
      } catch (err) {
        reject(new Error(`엑셀 파싱 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`));
      }
    };

    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsArrayBuffer(file);
  });
}
