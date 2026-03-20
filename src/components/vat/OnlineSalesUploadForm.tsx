"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { parseOnlineSalesExcel, type OnlineSalesRow } from "@/lib/onlineSalesExcelParser";
import { formatAmount } from "@/lib/format";
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, X } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";

type Phase = "upload" | "parsing" | "review" | "saving" | "done";

interface ReviewRow {
  row: OnlineSalesRow;
  selected: boolean;
}

export function OnlineSalesUploadForm() {
  const userId = useUserId();
  const [phase, setPhase] = useState<Phase>("upload");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    records: number;
    journals: number;
  } | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<string>("all");

  const batchCreate = useMutation(api.onlineSalesUpload.batchCreateWithJournals);

  const handleFileAdd = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const filesArray = Array.from(files);
    const excelFiles = filesArray.filter((f) =>
      f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );

    if (excelFiles.length === 0) {
      setError("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.");
      return;
    }

    setPhase("parsing");

    try {
      const allRows: OnlineSalesRow[] = [];
      let globalCounter = 0;

      for (const file of excelFiles) {
        const parsed = await parseOnlineSalesExcel(file);
        for (const row of parsed) {
          globalCounter++;
          row.id = `os-${globalCounter}`;
        }
        allRows.push(...parsed);
      }

      if (allRows.length === 0) {
        setError("업로드된 파일에서 유효한 데이터를 찾을 수 없습니다.");
        setPhase("upload");
        return;
      }

      const reviewRows: ReviewRow[] = allRows.map((row) => ({
        row,
        selected: true,
      }));

      setRows(reviewRows);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 처리 중 오류가 발생했습니다.");
      setPhase("upload");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFileAdd(e.dataTransfer.files);
  }, [handleFileAdd]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileAdd(e.target.files);
      e.target.value = "";
    }
  }, [handleFileAdd]);

  const getFilteredRows = () => {
    return rows.filter((r) => {
      if (filterPeriod !== "all" && (r.row.periodLabel || "") !== filterPeriod) return false;
      return true;
    });
  };

  const filteredRows = getFilteredRows();

  const toggleAll = () => {
    const filtered = getFilteredRows();
    const allSelected = filtered.every((r) => r.selected);
    const filteredIds = new Set(filtered.map((r) => r.row.id));
    setRows(rows.map((r) =>
      filteredIds.has(r.row.id) ? { ...r, selected: !allSelected } : r
    ));
  };

  const toggleRow = (id: string) => {
    setRows(rows.map((r) =>
      r.row.id === id ? { ...r, selected: !r.selected } : r
    ));
  };

  const selectedRows = rows.filter((r) => r.selected);
  const totalCount = selectedRows.reduce((s, r) => s + (r.row.count || 0), 0);
  const totalSalesAmount = selectedRows.reduce((s, r) => s + r.row.salesAmount, 0);
  const periodLabels = [...new Set(rows.map((r) => r.row.periodLabel || "").filter(Boolean))];

  const handleApprove = async () => {
    if (!userId) return;
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setPhase("saving");

    try {
      const CHUNK_SIZE = 50;
      let totalRecords = 0;
      let totalJournals = 0;

      const items = selected.map((r) => ({
        salesPeriod: r.row.salesPeriod || "",
        count: r.row.count || 0,
        salesAmount: r.row.salesAmount,
        platformName: r.row.platformName || "",
        periodLabel: r.row.periodLabel || "",
      }));

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const res = await batchCreate({ userId, items: chunk });
        totalRecords += res.created;
        totalJournals += res.journals;
      }

      setResult({
        records: totalRecords,
        journals: totalJournals,
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
    setError(null);
    setResult(null);
    setFilterPeriod("all");
  };

  // ─── Upload Phase ───
  if (phase === "upload") {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("online-sales-file-input")?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-medium mb-1">온라인매출 엑셀 업로드</p>
          <p className="text-sm text-muted-foreground mb-3">
            홈택스에서 다운로드한 온라인매출 내역 (.xlsx, .xls)
          </p>
          <p className="text-xs text-muted-foreground">
            파일을 드래그하거나 클릭하여 업로드
          </p>
          <input
            id="online-sales-file-input"
            type="file"
            accept=".xlsx,.xls"
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

        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">자동 처리 내용</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>온라인매출 내역에서 판매기간, 판매금액, 판매처 자동 파싱</li>
            <li>기수(1기/2기) 자동 감지</li>
            <li>온라인매출 테이블에 자동 등록</li>
            <li>매출 전표 자동 생성</li>
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
        <p className="text-lg font-medium">파일 파싱 중...</p>
      </div>
    );
  }

  // ─── Saving ───
  if (phase === "saving") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">온라인매출 등록 및 전표 생성 중...</p>
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
          <p>온라인매출 <strong className="text-primary">{result.records}</strong>건 등록, 전표 <strong className="text-primary">{result.journals}</strong>건 자동 생성</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleReset}>새 파일 업로드</Button>
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
          <span className="font-medium">{rows.length}건 온라인매출</span>
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
          {/* 기수 필터 */}
          {periodLabels.length > 0 && (
            <div className="flex items-center gap-1">
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
          <span className="border-l pl-3">건수 <strong>{totalCount}</strong></span>
          <span>판매금액 <strong>{formatAmount(totalSalesAmount)}</strong></span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {filteredRows.every((r) => r.selected) ? "전체 해제" : "전체 선택"}
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={selectedRows.length === 0}>
            선택 {selectedRows.length}건 승인
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
              <TableHead className="w-14">기수</TableHead>
              <TableHead>판매기간</TableHead>
              <TableHead className="text-right">건수</TableHead>
              <TableHead className="text-right">판매금액</TableHead>
              <TableHead>판매처</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow
                key={row.row.id}
                className={!row.selected ? "opacity-50" : undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleRow(row.row.id)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.row.periodLabel || "-"}
                </TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">
                  {row.row.salesPeriod || "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.row.count || 0}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatAmount(row.row.salesAmount)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={row.row.platformName}>
                  {row.row.platformName || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
