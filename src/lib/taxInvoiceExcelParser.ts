import * as XLSX from "xlsx";

export interface TaxInvoiceRow {
  id: string;
  invoiceType: "sales" | "purchase"; // 매출/매입
  invoiceDate: string;               // YYYY-MM-DD
  invoiceNumber: string;             // 승인번호
  partnerName: string;               // 거래처명
  partnerBusinessNumber: string;     // 사업자등록번호
  supplyAmount: number;              // 공급가액
  taxAmount: number;                 // 세액
  totalAmount: number;               // 합계
  description: string;               // 품목/비고
  taxType: "taxable" | "zero_rated" | "exempt"; // 과세유형
  invoiceCount?: number;             // 매수 (합계표용)
  periodLabel?: string;              // 기수 라벨 (1기/2기)
}

// 파싱 결과 메타데이터
export interface TaxInvoiceParseResult {
  rows: TaxInvoiceRow[];
  invoiceType: "sales" | "purchase";
  period: { start: string; end: string } | null;
  periodLabel: string; // "1기" | "2기"
}

// ─── 헤더 패턴 매핑 ───
const HEADER_PATTERNS: Record<string, string> = {
  // 날짜
  "작성일자": "date", "발급일자": "date", "발행일자": "date", "일자": "date",
  "전자발급일": "date", "발급일": "date", "작성일": "date",
  // 승인번호
  "승인번호": "invoiceNumber", "국세청승인번호": "invoiceNumber",
  // 거래처
  "공급자상호": "partnerName", "공급받는자상호": "partnerName",
  "상호": "partnerName", "거래처명": "partnerName", "거래처": "partnerName",
  "상호명": "partnerName",
  // 사업자번호
  "사업자등록번호": "bizNumber", "공급자등록번호": "bizNumber",
  "공급받는자등록번호": "bizNumber", "등록번호": "bizNumber",
  // 금액
  "공급가액": "supply", "공급가액합계": "supply",
  "세액": "tax", "세액합계": "tax",
  "합계금액": "total", "총액": "total",
  // 품목
  "품목": "description", "비고": "description", "적요": "description", "품명": "description",
  // 구분
  "구분": "type", "매출매입": "type", "유형": "type",
  // 과세유형
  "과세유형": "taxType", "세율구분": "taxType",
  // 합계표 전용
  "일련번호": "seq", "매수": "count", "수취구분": "receiveType",
};

// ─── 유틸리티 함수 ───

function parseDate(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{4}\.\d{2}\.\d{2}/.test(str)) return str.slice(0, 10).replace(/\./g, "-");
  if (/^\d{8}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  if (/^\d{4}\/\d{2}\/\d{2}/.test(str)) return str.slice(0, 10).replace(/\//g, "-");
  return str;
}

function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = String(raw).replace(/[,\s원₩\-]/g, "").trim();
  if (!cleaned) return 0;
  return Math.round(Number(cleaned)) || 0;
}

function formatBizNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return raw.trim();
}

function detectInvoiceType(raw: unknown): "sales" | "purchase" | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (str.includes("매출") || str.includes("발급") || str === "1") return "sales";
  if (str.includes("매입") || str.includes("수취") || str === "2") return "purchase";
  return null;
}

function detectTaxType(raw: unknown): "taxable" | "zero_rated" | "exempt" {
  if (!raw) return "taxable";
  const str = String(raw).trim();
  if (str.includes("영세") || str.includes("0%")) return "zero_rated";
  if (str.includes("면세")) return "exempt";
  return "taxable";
}

// ─── 합계표 전용: 헤더 행 자동 탐색 ───
function findDataHeaderRow(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const row = (rawRows[i] || []).map((v) => String(v ?? "").trim());
    const hasSupply = row.some((c) => c.includes("공급가액"));
    const hasTax = row.some((c) => c === "세액" || c === "세액합계");
    const hasPartner = row.some((c) => c.includes("상호") || c.includes("등록번호"));
    if (hasSupply && hasTax && hasPartner) return i;
  }
  return -1;
}

// ─── 합계표 전용: 매출/매입 자동 감지 ───
function detectTypeFromContent(rawRows: unknown[][]): "sales" | "purchase" | null {
  for (let i = 0; i < Math.min(rawRows.length, 12); i++) {
    const text = (rawRows[i] || []).map((v) => String(v ?? "")).join(" ");
    if (/매출.*(합계표|명세서)/.test(text)) return "sales";
    if (/매입.*(합계표|명세서)/.test(text)) return "purchase";
    if (text.includes("매출처")) return "sales";
    if (text.includes("매입처")) return "purchase";
  }
  return null;
}

// ─── 합계표 전용: 거래기간 추출 ───
function extractPeriod(rawRows: unknown[][]): { start: string; end: string } | null {
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
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

// ─── 합계/소계 행 판별 ───
function isSummaryRow(values: string[]): boolean {
  const text = values.join(" ");
  return /^합계|사업자등록번호\s*발급분|주민등록번호\s*발급분|사업자등록번호\s*수취분|주민등록번호\s*수취분|소계/.test(text.trim());
}

// ─── 합계표 형식 파싱 (헤더 자동 탐색) ───
function parseAsSummaryTable(
  rawRows: unknown[][],
  sheetType: "sales" | "purchase" | null,
  defaultType: "sales" | "purchase",
): { rows: TaxInvoiceRow[]; type: "sales" | "purchase"; period: { start: string; end: string } | null } {
  const contentType = detectTypeFromContent(rawRows);
  const period = extractPeriod(rawRows);
  const headerIdx = findDataHeaderRow(rawRows);
  const invoiceType = contentType ?? sheetType ?? defaultType;
  const periodLabel = detectPeriodLabel(period);

  if (headerIdx === -1) return { rows: [], type: invoiceType, period };

  const headerRow = rawRows[headerIdx].map((v) => String(v ?? "").trim());

  // 인덱스 기반 컬럼 매핑
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

  // "합계" 패턴이 "total"로 잡혀야 하지만 "합계금액"이 우선 → total 보정
  // "합계금액"이 있으면 그것을 사용, 없으면 "합계" 사용
  // 이미 HEADER_PATTERNS에서 "합계금액"이 "total"보다 먼저이므로 OK

  const result: TaxInvoiceRow[] = [];
  let counter = 0;

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    if (row.length === 0) continue;

    const values = row.map((v) => String(v ?? ""));
    if (isSummaryRow(values)) continue;

    const partnerName = colMap.partnerName !== undefined ? String(row[colMap.partnerName] ?? "").trim() : "";
    const bizNumber = colMap.bizNumber !== undefined ? String(row[colMap.bizNumber] ?? "").trim() : "";
    if (!partnerName && !bizNumber) continue;

    const supply = parseAmount(colMap.supply !== undefined ? row[colMap.supply] : 0);
    const tax = parseAmount(colMap.tax !== undefined ? row[colMap.tax] : 0);
    let total = parseAmount(colMap.total !== undefined ? row[colMap.total] : 0);

    if (supply === 0 && total === 0) continue;
    if (total === 0) total = supply + tax;
    const finalSupply = supply || (total - tax);

    const dateStr = colMap.date !== undefined ? parseDate(row[colMap.date]) : "";
    const invoiceDate = dateStr || (period?.end ?? new Date().toISOString().split("T")[0]);

    const rowType = colMap.type !== undefined ? detectInvoiceType(row[colMap.type]) : null;
    const count = colMap.count !== undefined ? parseAmount(row[colMap.count]) : undefined;

    counter++;
    result.push({
      id: `inv-${counter}`,
      invoiceType: rowType ?? invoiceType,
      invoiceDate,
      invoiceNumber: colMap.invoiceNumber !== undefined ? String(row[colMap.invoiceNumber] ?? "").trim() : "",
      partnerName: partnerName || `사업자 ${bizNumber}`,
      partnerBusinessNumber: bizNumber ? formatBizNumber(bizNumber) : "",
      supplyAmount: finalSupply,
      taxAmount: tax,
      totalAmount: total,
      description: colMap.description !== undefined ? String(row[colMap.description] ?? "").trim() : "",
      taxType: colMap.taxType !== undefined ? detectTaxType(row[colMap.taxType]) : "taxable",
      invoiceCount: count,
      periodLabel,
    });
  }

  return { rows: result, type: invoiceType, period };
}

// ─── 기존 명세서 형식 파싱 (Row 0 = 헤더) ───
function parseAsDetailList(
  ws: XLSX.WorkSheet,
  sheetName: string,
  defaultType: "sales" | "purchase",
  counterRef: { value: number },
): TaxInvoiceRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length === 0) return [];

  let sheetType: "sales" | "purchase" | null = null;
  if (sheetName.includes("매출") || sheetName.includes("발급")) sheetType = "sales";
  else if (sheetName.includes("매입") || sheetName.includes("수취")) sheetType = "purchase";

  const headers = Object.keys(rows[0]);
  const colMap: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.trim().replace(/\s+/g, "");
    for (const [pattern, field] of Object.entries(HEADER_PATTERNS)) {
      if (normalized.includes(pattern)) {
        if (!colMap[field]) colMap[field] = header;
        break;
      }
    }
  }

  if (!colMap.partnerName && !colMap.bizNumber) return [];
  if (!colMap.supply && !colMap.total) return [];

  const result: TaxInvoiceRow[] = [];
  for (const row of rows) {
    const partnerName = String(colMap.partnerName ? row[colMap.partnerName] : "").trim();
    const bizNumber = String(colMap.bizNumber ? row[colMap.bizNumber] : "").trim();
    if (!partnerName && !bizNumber) continue;

    const supply = parseAmount(colMap.supply ? row[colMap.supply] : 0);
    const tax = parseAmount(colMap.tax ? row[colMap.tax] : 0);
    let total = parseAmount(colMap.total ? row[colMap.total] : 0);
    if (supply === 0 && total === 0) continue;
    if (total === 0) total = supply + tax;
    const finalSupply = supply || (total - tax);

    const dateStr = parseDate(colMap.date ? row[colMap.date] : "");
    const rowType = colMap.type ? detectInvoiceType(row[colMap.type]) : null;
    const invoiceType = rowType ?? sheetType ?? defaultType;

    counterRef.value++;
    result.push({
      id: `inv-${counterRef.value}`,
      invoiceType,
      invoiceDate: dateStr || new Date().toISOString().split("T")[0],
      invoiceNumber: String(colMap.invoiceNumber ? row[colMap.invoiceNumber] : "").trim(),
      partnerName: partnerName || `사업자 ${bizNumber}`,
      partnerBusinessNumber: bizNumber ? formatBizNumber(bizNumber) : "",
      supplyAmount: finalSupply,
      taxAmount: tax,
      totalAmount: total,
      description: String(colMap.description ? row[colMap.description] : "").trim(),
      taxType: colMap.taxType ? detectTaxType(row[colMap.taxType]) : "taxable",
    });
  }
  return result;
}

// ─── 메인 파서: 합계표/명세서 자동 감지 ───
export function parseTaxInvoiceExcel(
  file: File,
  defaultType: "sales" | "purchase" = "sales",
): Promise<TaxInvoiceRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const allRows: TaxInvoiceRow[] = [];
        const counterRef = { value: 0 };

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
          if (rawRows.length === 0) continue;

          // 합계표 형식인지 감지: 첫 20행 내에 "공급가액+세액+상호" 헤더가 있는 행 탐색
          const headerIdx = findDataHeaderRow(rawRows);

          if (headerIdx > 0) {
            // 합계표 형식 (헤더가 Row 0이 아닌 경우)
            let sheetType: "sales" | "purchase" | null = null;
            if (sheetName.includes("매출") || sheetName.includes("발급")) sheetType = "sales";
            else if (sheetName.includes("매입") || sheetName.includes("수취")) sheetType = "purchase";

            const parsed = parseAsSummaryTable(rawRows, sheetType, defaultType);
            // id 재부여
            for (const row of parsed.rows) {
              counterRef.value++;
              row.id = `inv-${counterRef.value}`;
            }
            allRows.push(...parsed.rows);
          } else {
            // 기존 명세서 형식 (Row 0이 헤더)
            const parsed = parseAsDetailList(ws, sheetName, defaultType, counterRef);
            allRows.push(...parsed);
          }
        }

        if (allRows.length === 0) {
          reject(new Error(
            "유효한 세금계산서 데이터를 찾을 수 없습니다.\n상호(거래처명), 공급가액, 세액 컬럼이 필요합니다."
          ));
          return;
        }

        allRows.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
        resolve(allRows);
      } catch (err) {
        reject(new Error(`엑셀 파싱 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`));
      }
    };

    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── 멀티파일 파서: 합계표 4장 일괄 파싱 ───
export function parseTaxInvoiceMultiFiles(
  files: File[],
  defaultType: "sales" | "purchase" = "sales",
): Promise<TaxInvoiceParseResult[]> {
  return Promise.all(
    files.map(async (file) => {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(data), { type: "array", cellDates: true });
      const results: TaxInvoiceParseResult[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        if (rawRows.length === 0) continue;

        let sheetType: "sales" | "purchase" | null = null;
        if (sheetName.includes("매출") || sheetName.includes("발급")) sheetType = "sales";
        else if (sheetName.includes("매입") || sheetName.includes("수취")) sheetType = "purchase";

        const headerIdx = findDataHeaderRow(rawRows);
        if (headerIdx > 0) {
          const parsed = parseAsSummaryTable(rawRows, sheetType, defaultType);
          results.push({
            rows: parsed.rows,
            invoiceType: parsed.type,
            period: parsed.period,
            periodLabel: detectPeriodLabel(parsed.period),
          });
        } else {
          // 기존 형식 폴백
          const counterRef = { value: 0 };
          const rows = parseAsDetailList(ws, sheetName, defaultType, counterRef);
          if (rows.length > 0) {
            const type = rows[0].invoiceType;
            results.push({
              rows,
              invoiceType: type,
              period: null,
              periodLabel: "",
            });
          }
        }
      }

      return results;
    }),
  ).then((nested) => nested.flat());
}
