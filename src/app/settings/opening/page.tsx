"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format";
import { Upload, Save, FileSpreadsheet, FileText, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface BalanceRow {
  accountId: string;
  code: string;
  name: string;
  category: string;
  debitBalance: number;
  creditBalance: number;
}

export default function OpeningBalancePage() {
  const userId = useUserId();
  const accounts = useQuery(api.accounts.list, userId ? { userId, activeOnly: true } : "skip");
  const existingBalances = useQuery(
    api.openingBalances.getByFiscalYear,
    userId ? { userId, fiscalYear: new Date().getFullYear() } : "skip"
  );
  const saveBalances = useMutation(api.openingBalances.saveBatch);
  const parseBalancePdf = useAction(api.openingBalanceAi.parseBalanceDocument);

  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 계정과목 로드 → 초기 rows 세팅
  if (accounts && !initialized) {
    const bsAccounts = accounts.filter((a) =>
      ["자산", "부채", "자본"].includes(a.category)
    );

    const initial: BalanceRow[] = bsAccounts.map((a) => {
      const existing = existingBalances?.find((b) => b.accountId === a._id);
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        category: a.category,
        debitBalance: existing?.debitBalance ?? 0,
        creditBalance: existing?.creditBalance ?? 0,
      };
    });

    setRows(initial);
    setInitialized(true);
  }

  const totalDebit = rows.reduce((s, r) => s + r.debitBalance, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditBalance, 0);
  const balanced = totalDebit === totalCredit;

  const updateRow = (accountId: string, field: "debitBalance" | "creditBalance", value: number) => {
    setRows(rows.map((r) =>
      r.accountId === accountId ? { ...r, [field]: value } : r
    ));
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);

    try {
      const nonZeroRows = rows.filter((r) => r.debitBalance > 0 || r.creditBalance > 0);
      await saveBalances({
        userId,
        fiscalYear,
        balances: nonZeroRows.map((r) => ({
          accountId: r.accountId as any,
          debitBalance: r.debitBalance,
          creditBalance: r.creditBalance,
        })),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // Excel 업로드 처리
  const handleExcelUpload = useCallback(async (file: File) => {
    setError(null);
    setParsing(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(data), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      // 계정코드 + 금액 매핑
      let mapped = 0;
      const newRows = [...rows];

      for (const row of jsonRows) {
        const values = Object.values(row).map((v) => String(v).trim());
        // 계정코드 찾기 (3자리 숫자)
        const codeMatch = values.find((v) => /^\d{3}$/.test(v));
        if (!codeMatch) continue;

        const rowIdx = newRows.findIndex((r) => r.code === codeMatch);
        if (rowIdx === -1) continue;

        // 금액 찾기 (가장 큰 숫자)
        const amounts = values
          .map((v) => {
            const cleaned = v.replace(/[,\s원₩]/g, "");
            return /^\d+$/.test(cleaned) ? parseInt(cleaned) : 0;
          })
          .filter((n) => n > 0);

        if (amounts.length === 0) continue;
        const amount = Math.max(...amounts);

        const cat = newRows[rowIdx].category;
        if (cat === "자산") {
          newRows[rowIdx].debitBalance = amount;
          newRows[rowIdx].creditBalance = 0;
        } else {
          newRows[rowIdx].debitBalance = 0;
          newRows[rowIdx].creditBalance = amount;
        }
        mapped++;
      }

      setRows(newRows);
      if (mapped === 0) {
        setError("매핑된 계정이 없습니다. 계정코드(3자리)가 포함된 엑셀인지 확인하세요.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 파싱 오류");
    } finally {
      setParsing(false);
    }
  }, [rows]);

  // PDF 업로드 처리 (Gemini AI)
  const handlePdfUpload = useCallback(async (file: File) => {
    if (!userId) return;
    setError(null);
    setParsing(true);

    try {
      // PDF 텍스트 추출 (클라이언트)
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      // Gemini AI로 파싱
      const result = await parseBalancePdf({ base64Pdf: base64 });

      if (result && Array.isArray(result)) {
        const newRows = [...rows];
        let mapped = 0;

        for (const item of result) {
          const idx = newRows.findIndex((r) => r.code === item.code);
          if (idx === -1) continue;

          if (newRows[idx].category === "자산") {
            newRows[idx].debitBalance = item.amount;
            newRows[idx].creditBalance = 0;
          } else {
            newRows[idx].debitBalance = 0;
            newRows[idx].creditBalance = item.amount;
          }
          mapped++;
        }

        setRows(newRows);
        if (mapped === 0) {
          setError("PDF에서 매핑된 계정이 없습니다.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 파싱 오류");
    } finally {
      setParsing(false);
    }
  }, [rows, userId, parseBalancePdf]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".pdf")) {
      handlePdfUpload(file);
    } else {
      handleExcelUpload(file);
    }
  }, [handleExcelUpload, handlePdfUpload]);

  if (!userId) {
    return <p className="text-muted-foreground text-center py-8">로그인이 필요합니다.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">전기 기초잔액 입력</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>회계연도</Label>
            <Input
              type="number"
              value={fiscalYear}
              onChange={(e) => {
                setFiscalYear(parseInt(e.target.value));
                setInitialized(false);
              }}
              className="w-24"
            />
          </div>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("balance-excel-input")?.click()}
        >
          <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">엑셀 업로드</p>
          <p className="text-xs text-muted-foreground">전기 재무상태표 .xlsx</p>
          <input
            id="balance-excel-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("balance-pdf-input")?.click()}
        >
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">PDF 업로드 (AI 파싱)</p>
          <p className="text-xs text-muted-foreground">홈택스 재무상태표 PDF</p>
          <input
            id="balance-pdf-input"
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {parsing && (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>파일 분석 중...</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm text-center">
          기초잔액이 저장되었습니다.
        </div>
      )}

      {/* 잔액 합계 */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-4 text-sm">
          <span>차변 합계: <strong className="text-blue-600">{formatAmount(totalDebit)}</strong></span>
          <span>대변 합계: <strong className="text-red-600">{formatAmount(totalCredit)}</strong></span>
          <Badge variant={balanced ? "default" : "destructive"}>
            {balanced ? "대차균형" : `차이 ${formatAmount(Math.abs(totalDebit - totalCredit))}`}
          </Badge>
        </div>
        <Button onClick={handleSave} disabled={saving || !balanced} size="sm">
          <Save className="h-4 w-4 mr-1" />
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>

      {/* 잔액 입력 테이블 */}
      <div className="border rounded-lg overflow-auto max-h-[500px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-20">코드</TableHead>
              <TableHead>계정명</TableHead>
              <TableHead className="w-20">분류</TableHead>
              <TableHead className="text-right w-40">차변잔액</TableHead>
              <TableHead className="text-right w-40">대변잔액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {["자산", "부채", "자본"].map((cat) => {
              const catRows = rows.filter((r) => r.category === cat);
              if (catRows.length === 0) return null;

              return catRows.map((row) => (
                <TableRow key={row.accountId}>
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{row.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={row.debitBalance > 0 ? row.debitBalance.toLocaleString() : ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
                        updateRow(row.accountId, "debitBalance", val);
                      }}
                      className="text-right font-mono w-36 ml-auto"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="text"
                      value={row.creditBalance > 0 ? row.creditBalance.toLocaleString() : ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
                        updateRow(row.accountId, "creditBalance", val);
                      }}
                      className="text-right font-mono w-36 ml-auto"
                      placeholder="0"
                    />
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
