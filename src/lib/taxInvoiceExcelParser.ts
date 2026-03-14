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
}

// 홈택스 세금계산서 합계표 컬럼 헤더 매핑
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
  "합계금액": "total", "합계": "total", "총액": "total",
  // 품목
  "품목": "description", "비고": "description", "적요": "description", "품명": "description",
  // 구분
  "구분": "type", "매출매입": "type", "유형": "type",
  // 과세유형
  "과세유형": "taxType", "세율구분": "taxType",
};

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
  if (!raw) return 0;
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
        let counter = 0;

        // 모든 시트 처리 (홈택스는 매출/매입 별도 시트)
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
          if (rows.length === 0) continue;

          // 시트명으로 매출/매입 판단
          let sheetType: "sales" | "purchase" | null = null;
          if (sheetName.includes("매출") || sheetName.includes("발급")) sheetType = "sales";
          else if (sheetName.includes("매입") || sheetName.includes("수취")) sheetType = "purchase";

          // 헤더 매핑
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

          // 최소 필수 컬럼 확인 (거래처 + 금액)
          if (!colMap.partnerName && !colMap.bizNumber) continue;
          if (!colMap.supply && !colMap.total) continue;

          for (const row of rows) {
            const partnerName = String(colMap.partnerName ? row[colMap.partnerName] : "").trim();
            const bizNumber = String(colMap.bizNumber ? row[colMap.bizNumber] : "").trim();

            if (!partnerName && !bizNumber) continue;

            const supply = parseAmount(colMap.supply ? row[colMap.supply] : 0);
            const tax = parseAmount(colMap.tax ? row[colMap.tax] : 0);
            let total = parseAmount(colMap.total ? row[colMap.total] : 0);

            if (supply === 0 && total === 0) continue;

            // 합계가 없으면 계산
            if (total === 0) total = supply + tax;
            // 공급가액이 없으면 역산
            const finalSupply = supply || (total - tax);

            const dateStr = parseDate(colMap.date ? row[colMap.date] : "");
            const rowType = colMap.type ? detectInvoiceType(row[colMap.type]) : null;
            const invoiceType = rowType ?? sheetType ?? defaultType;

            counter++;
            allRows.push({
              id: `inv-${counter}`,
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
