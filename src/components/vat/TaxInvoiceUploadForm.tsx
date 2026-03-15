"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AccountCombobox } from "@/components/common/AccountCombobox";
import { parseTaxInvoiceExcel, type TaxInvoiceRow } from "@/lib/taxInvoiceExcelParser";
import { formatAmount } from "@/lib/format";
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";

type Phase = "upload" | "parsing" | "review" | "saving" | "done";

// 매입 비용 계정 추정 (거래처명/적요 기반)
const EXPENSE_RULES: { keywords: string[]; accountCode: string; accountName: string }[] = [
  { keywords: ["임대", "임차", "월세", "사무실"], accountCode: "518", accountName: "임차료" },
  { keywords: ["통신", "전화", "인터넷", "KT", "SK"], accountCode: "515", accountName: "통신비" },
  { keywords: ["전기", "수도", "가스", "난방"], accountCode: "516", accountName: "수도광열비" },
  { keywords: ["광고", "홍보", "마케팅"], accountCode: "523", accountName: "광고선전비" },
  { keywords: ["교육", "훈련", "세미나"], accountCode: "527", accountName: "교육훈련비" },
  { keywords: ["보험"], accountCode: "520", accountName: "보험료" },
  { keywords: ["차량", "자동차", "주유", "정비"], accountCode: "526", accountName: "차량유지비" },
  { keywords: ["수선", "수리", "보수"], accountCode: "521", accountName: "수선비" },
  { keywords: ["사무", "문구", "복사"], accountCode: "530", accountName: "사무용품비" },
  { keywords: ["소모품", "청소"], accountCode: "524", accountName: "소모품비" },
  { keywords: ["접대", "회식"], accountCode: "522", accountName: "접대비" },
  { keywords: ["도서", "서적", "인쇄"], accountCode: "528", accountName: "도서인쇄비" },
  { keywords: ["수수료", "카드수수료"], accountCode: "525", accountName: "지급수수료" },
  { keywords: ["외주", "용역", "개발", "디자인", "컨설팅"], accountCode: "531", accountName: "외주용역비" },
];

function guessExpenseAccount(
  partnerName: string,
  description: string,
): { code: string; name: string } {
  const text = `${partnerName} ${description}`.toLowerCase();
  for (const rule of EXPENSE_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return { code: rule.accountCode, name: rule.accountName };
    }
  }
  return { code: "531", name: "외주용역비" };
}

interface ReviewRow {
  invoice: TaxInvoiceRow;
  selected: boolean;
  expenseAccountCode: string;
  expenseAccountName: string;
}

interface UploadedFile {
  file: File;
  name: string;
  type: "sales" | "purchase" | null;
  period: string;
  count: number;
}

// 파일에서 매출/매입과 기수를 자동감지
async function detectFileInfo(file: File): Promise<{ type: "sales" | "purchase" | null; period: string; count: number }> {
  try {
    const invoices = await parseTaxInvoiceExcel(file);
    const type = invoices.length > 0 ? invoices[0].invoiceType : null;
    const periodLabel = invoices.length > 0 ? (invoices[0].periodLabel || "") : "";
    return { type, period: periodLabel, count: invoices.length };
  } catch {
    return { type: null, period: "", count: 0 };
  }
}

export function TaxInvoiceUploadForm() {
  const userId = useUserId();
  const [phase, setPhase] = useState<Phase>("upload");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    invoices: number;
    journals: number;
    newPartners: number;
  } | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "sales" | "purchase">("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");

  const batchCreate = useMutation(api.taxInvoiceUpload.batchCreateWithJournals);

  // 파일 추가
  const handleFilesAdd = useCallback(async (newFiles: FileList | File[]) => {
    setError(null);
    const filesArray = Array.from(newFiles);
    const excelFiles = filesArray.filter((f) =>
      f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")
    );

    if (excelFiles.length === 0) {
      setError("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.");
      return;
    }

    const newUploaded: UploadedFile[] = [];
    for (const file of excelFiles) {
      const info = await detectFileInfo(file);
      newUploaded.push({
        file,
        name: file.name,
        type: info.type,
        period: info.period,
        count: info.count,
      });
    }

    setUploadedFiles((prev) => [...prev, ...newUploaded]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFilesAdd(e.dataTransfer.files);
  }, [handleFilesAdd]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdd(e.target.files);
      e.target.value = "";
    }
  }, [handleFilesAdd]);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 전체 파싱 → 리뷰 진입
  const handleParseAll = useCallback(async () => {
    setError(null);
    setPhase("parsing");

    try {
      const allInvoices: TaxInvoiceRow[] = [];
      let globalCounter = 0;

      for (const uf of uploadedFiles) {
        const invoices = await parseTaxInvoiceExcel(uf.file);
        for (const inv of invoices) {
          globalCounter++;
          inv.id = `inv-${globalCounter}`;
        }
        allInvoices.push(...invoices);
      }

      if (allInvoices.length === 0) {
        setError("업로드된 파일에서 유효한 데이터를 찾을 수 없습니다.");
        setPhase("upload");
        return;
      }

      const reviewRows: ReviewRow[] = allInvoices.map((inv) => {
        const expense = inv.invoiceType === "purchase"
          ? guessExpenseAccount(inv.partnerName, inv.description)
          : { code: "", name: "" };
        return {
          invoice: inv,
          selected: true,
          expenseAccountCode: expense.code,
          expenseAccountName: expense.name,
        };
      });

      setRows(reviewRows);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 처리 중 오류가 발생했습니다.");
      setPhase("upload");
    }
  }, [uploadedFiles]);

  const toggleAll = () => {
    const filtered = getFilteredRows();
    const allSelected = filtered.every((r) => r.selected);
    const filteredIds = new Set(filtered.map((r) => r.invoice.id));
    setRows(rows.map((r) =>
      filteredIds.has(r.invoice.id) ? { ...r, selected: !allSelected } : r
    ));
  };

  const toggleRow = (id: string) => {
    setRows(rows.map((r) =>
      r.invoice.id === id ? { ...r, selected: !r.selected } : r
    ));
  };

  const updateExpenseAccount = (id: string, code: string, name: string) => {
    setRows(rows.map((r) =>
      r.invoice.id === id ? { ...r, expenseAccountCode: code, expenseAccountName: name } : r
    ));
    setEditingRow(null);
  };

  const handleApprove = async () => {
    if (!userId) return;
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setPhase("saving");

    try {
      const CHUNK_SIZE = 50;
      let totalInvoices = 0;
      let totalJournals = 0;
      let totalPartners = 0;

      const items = selected.map((r) => ({
        invoiceType: r.invoice.invoiceType,
        invoiceDate: r.invoice.invoiceDate,
        invoiceNumber: r.invoice.invoiceNumber,
        partnerName: r.invoice.partnerName,
        partnerBusinessNumber: r.invoice.partnerBusinessNumber,
        supplyAmount: r.invoice.supplyAmount,
        taxAmount: r.invoice.taxAmount,
        totalAmount: r.invoice.totalAmount,
        taxType: r.invoice.taxType,
        description: r.invoice.description,
        expenseAccountCode: r.invoice.invoiceType === "purchase"
          ? r.expenseAccountCode
          : undefined,
      }));

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const res = await batchCreate({ userId, items: chunk });
        totalInvoices += res.invoices;
        totalJournals += res.journals;
        totalPartners += res.newPartners;
      }

      setResult({
        invoices: totalInvoices,
        journals: totalJournals,
        newPartners: totalPartners,
      });
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
      setPhase("review");
    }
  };

  const handleReset = () => {
    setPhase("upload");
    setRows([]);
    setUploadedFiles([]);
    setError(null);
    setResult(null);
    setFilterType("all");
    setFilterPeriod("all");
  };

  // 필터링
  const getFilteredRows = () => {
    return rows.filter((r) => {
      if (filterType !== "all" && r.invoice.invoiceType !== filterType) return false;
      if (filterPeriod !== "all" && (r.invoice.periodLabel || "") !== filterPeriod) return false;
      return true;
    });
  };

  const filteredRows = getFilteredRows();
  const salesCount = rows.filter((r) => r.selected && r.invoice.invoiceType === "sales").length;
  const purchaseCount = rows.filter((r) => r.selected && r.invoice.invoiceType === "purchase").length;
  const totalSupply = rows.filter((r) => r.selected).reduce((s, r) => s + r.invoice.supplyAmount, 0);
  const totalTax = rows.filter((r) => r.selected).reduce((s, r) => s + r.invoice.taxAmount, 0);

  // 기수 목록
  const periodLabels = [...new Set(rows.map((r) => r.invoice.periodLabel || "").filter(Boolean))];

  // ─── Upload Phase ───
  if (phase === "upload") {
    const salesFiles = uploadedFiles.filter((f) => f.type === "sales");
    const purchaseFiles = uploadedFiles.filter((f) => f.type === "purchase");

    return (
      <div className="space-y-4">
        {/* 업로드 상태 표시 */}
        {uploadedFiles.length > 0 && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">업로드된 파일 ({uploadedFiles.length}장)</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>매출: {salesFiles.length}장</span>
                <span>매입: {purchaseFiles.length}장</span>
              </div>
            </div>
            <div className="space-y-2">
              {uploadedFiles.map((uf, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="text-sm">{uf.name}</span>
                    <Badge variant={uf.type === "sales" ? "default" : "secondary"} className="text-xs">
                      {uf.type === "sales" ? "매출" : uf.type === "purchase" ? "매입" : "미감지"}
                    </Badge>
                    {uf.period && (
                      <Badge variant="outline" className="text-xs">{uf.period}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{uf.count}건</span>
                  </div>
                  <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("tax-invoice-file-input")?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-medium mb-1">세금계산서 합계표 엑셀 업로드</p>
          <p className="text-sm text-muted-foreground mb-3">
            .xlsx, .xls 파일을 드래그하거나 클릭 (여러 장 동시 선택 가능)
          </p>
          <p className="text-xs text-muted-foreground">
            1기 매출 / 1기 매입 / 2기 매출 / 2기 매입 — 총 4장 업로드 권장
          </p>
          <input
            id="tax-invoice-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <pre className="whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* 파싱 시작 버튼 */}
        {uploadedFiles.length > 0 && (
          <Button onClick={handleParseAll} className="w-full" size="lg">
            <FileSpreadsheet className="h-5 w-5 mr-2" />
            {uploadedFiles.length}개 파일 파싱 시작 (총 {uploadedFiles.reduce((s, f) => s + f.count, 0)}건)
          </Button>
        )}

        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">자동 처리 내용</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>합계표에서 매출/매입, 기수(1기/2기) 자동 감지</li>
            <li>세금계산서 테이블에 자동 등록</li>
            <li>매출: 외상매출금(차) / 매출+부가세예수금(대) 자동 분개</li>
            <li>매입: 비용+부가세대급금(차) / 외상매입금(대) 자동 분개</li>
            <li>미등록 거래처는 자동 신규 등록</li>
            <li>매입 비용 계정은 거래처명 기반 추정 (수정 가능)</li>
          </ul>
        </div>
      </div>
    );
  }

  // ─── Parsing ───
  if (phase === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">{uploadedFiles.length}개 파일 파싱 중...</p>
      </div>
    );
  }

  // ─── Saving ───
  if (phase === "saving") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">세금계산서 등록 및 전표 생성 중...</p>
      </div>
    );
  }

  // ─── Done ───
  if (phase === "done" && result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600">
          <Check className="h-8 w-8" />
        </div>
        <p className="text-xl font-bold">처리 완료</p>
        <div className="text-center text-muted-foreground space-y-1">
          <p>세금계산서 <strong className="text-primary">{result.invoices}</strong>건 등록</p>
          <p>전표 <strong className="text-primary">{result.journals}</strong>건 자동 생성</p>
          {result.newPartners > 0 && (
            <p>신규 거래처 <strong className="text-primary">{result.newPartners}</strong>건 등록</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleReset}>새 파일 업로드</Button>
          <Button variant="outline" onClick={() => window.location.href = "/vat/invoices"}>
            세금계산서 목록
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/journals"}>
            전표 목록
          </Button>
        </div>
      </div>
    );
  }

  // ─── Review Phase ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <span className="font-medium">{rows.length}건 세금계산서</span>
          {uploadedFiles.length > 1 && (
            <Badge variant="outline" className="text-xs">{uploadedFiles.length}개 파일</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          다시 업로드
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* 필터 + 요약 바 */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-3 text-sm">
          {/* 타입 필터 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2 py-0.5 rounded text-xs ${filterType === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              전체
            </button>
            <button
              onClick={() => setFilterType("sales")}
              className={`px-2 py-0.5 rounded text-xs ${filterType === "sales" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
            >
              매출 {salesCount}
            </button>
            <button
              onClick={() => setFilterType("purchase")}
              className={`px-2 py-0.5 rounded text-xs ${filterType === "purchase" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
            >
              매입 {purchaseCount}
            </button>
          </div>
          {/* 기수 필터 */}
          {periodLabels.length > 1 && (
            <div className="flex items-center gap-1 border-l pl-3">
              <button
                onClick={() => setFilterPeriod("all")}
                className={`px-2 py-0.5 rounded text-xs ${filterPeriod === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                전체
              </button>
              {periodLabels.map((label) => (
                <button
                  key={label}
                  onClick={() => setFilterPeriod(label)}
                  className={`px-2 py-0.5 rounded text-xs ${filterPeriod === label ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <span className="border-l pl-3">공급가액 <strong>{formatAmount(totalSupply)}</strong></span>
          <span>세액 <strong>{formatAmount(totalTax)}</strong></span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {filteredRows.every((r) => r.selected) ? "전체 해제" : "전체 선택"}
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={salesCount + purchaseCount === 0}>
            선택 {salesCount + purchaseCount}건 승인
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={filteredRows.length > 0 && filteredRows.every((r) => r.selected)}
                  onChange={toggleAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead className="w-16">구분</TableHead>
              {periodLabels.length > 0 && <TableHead className="w-14">기수</TableHead>}
              <TableHead>날짜</TableHead>
              <TableHead>거래처</TableHead>
              <TableHead>사업자번호</TableHead>
              <TableHead className="text-right">공급가액</TableHead>
              <TableHead className="text-right">세액</TableHead>
              <TableHead className="text-right">합계</TableHead>
              <TableHead>비용계정</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const isSales = row.invoice.invoiceType === "sales";
              const isEditing = editingRow === row.invoice.id;

              return (
                <TableRow
                  key={row.invoice.id}
                  className={!row.selected ? "opacity-50" : undefined}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(row.invoice.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={isSales ? "default" : "secondary"}>
                      {isSales ? "매출" : "매입"}
                    </Badge>
                  </TableCell>
                  {periodLabels.length > 0 && (
                    <TableCell className="text-xs text-muted-foreground">
                      {row.invoice.periodLabel || "-"}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {row.invoice.invoiceDate}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate" title={row.invoice.partnerName}>
                    {row.invoice.partnerName}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.invoice.partnerBusinessNumber || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatAmount(row.invoice.supplyAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatAmount(row.invoice.taxAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatAmount(row.invoice.totalAmount)}
                  </TableCell>
                  <TableCell>
                    {isSales ? (
                      <span className="text-xs text-muted-foreground">매출 자동</span>
                    ) : isEditing ? (
                      <div className="w-[200px]">
                        <AccountCombobox
                          value={null}
                          onChange={(id, acc) => {
                            updateExpenseAccount(row.invoice.id, acc.code, acc.name);
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRow(row.invoice.id)}
                        className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.expenseAccountCode}
                        </span>
                        <span>{row.expenseAccountName}</span>
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing && (
                      <button onClick={() => setEditingRow(null)}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
