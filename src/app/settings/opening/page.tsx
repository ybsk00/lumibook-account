"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { useCurrentFiscalYear } from "@/hooks/useCurrentFiscalYear";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format";
import {
  Upload, Save, FileText, Loader2, AlertCircle, Building2, PlusCircle,
  CheckCircle2, ArrowLeft,
} from "lucide-react";
import * as XLSX from "xlsx";

type CorpType = null | "existing" | "new";
type Phase = "select" | "upload" | "input" | "saved";

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
  const { fiscalYear: currentFY } = useCurrentFiscalYear();
  const accounts = useQuery(api.accounts.list, userId ? { userId, activeOnly: true } : "skip");
  const existingBalances = useQuery(
    api.openingBalances.getByFiscalYear,
    userId ? { userId, fiscalYear: currentFY } : "skip"
  );
  const saveBalances = useMutation(api.openingBalances.saveBatch);
  const parseBalancePdf = useAction(api.openingBalanceAi.parseBalanceDocument);

  const [corpType, setCorpType] = useState<CorpType>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const [fiscalYear, setFiscalYear] = useState(currentFY);
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 신규법인 자본금
  const [capitalAmount, setCapitalAmount] = useState<number>(0);

  // 계정과목 로드 → 초기 rows 세팅
  const initRows = useCallback(() => {
    if (!accounts) return;
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
  }, [accounts, existingBalances]);

  if (accounts && !initialized) {
    initRows();
  }

  // 기존 잔액이 있으면 자동으로 입력 화면으로
  const hasExisting = existingBalances && existingBalances.length > 0;

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
      setPhase("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ─── 기존법인: PDF 업로드 ───
  const handlePdfUpload = useCallback(async (file: File) => {
    if (!userId) return;
    setError(null);
    setParsing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

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
        setPhase("input");

        if (mapped === 0) {
          setError("PDF에서 매핑된 계정이 없습니다. PDF 형식을 확인해주세요.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 파싱 오류");
    } finally {
      setParsing(false);
    }
  }, [rows, userId, parseBalancePdf]);

  // ─── 기존법인: 엑셀 업로드 ───
  const handleExcelUpload = useCallback(async (file: File) => {
    setError(null);
    setParsing(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(data), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      let mapped = 0;
      const newRows = [...rows];

      for (const row of jsonRows) {
        const values = Object.values(row).map((v) => String(v).trim());
        const codeMatch = values.find((v) => /^\d{3}$/.test(v));
        if (!codeMatch) continue;

        const rowIdx = newRows.findIndex((r) => r.code === codeMatch);
        if (rowIdx === -1) continue;

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
      setPhase("input");

      if (mapped === 0) {
        setError("매핑된 계정이 없습니다. 계정코드(3자리)가 포함된 엑셀인지 확인하세요.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 파싱 오류");
    } finally {
      setParsing(false);
    }
  }, [rows]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith(".pdf")) {
      handlePdfUpload(file);
    } else {
      handleExcelUpload(file);
    }
  }, [handleExcelUpload, handlePdfUpload]);

  // ─── 신규법인: 자본금 적용 ───
  const applyCapital = () => {
    if (capitalAmount <= 0) {
      setError("자본금을 입력해주세요.");
      return;
    }
    setError(null);

    const newRows = rows.map((r) => {
      if (r.code === "102") {
        // 보통예금 = 자본금 (차변)
        return { ...r, debitBalance: capitalAmount, creditBalance: 0 };
      }
      if (r.code === "301") {
        // 자본금 (대변)
        return { ...r, debitBalance: 0, creditBalance: capitalAmount };
      }
      return { ...r, debitBalance: 0, creditBalance: 0 };
    });

    setRows(newRows);
    setPhase("input");
  };

  const handleReset = () => {
    setCorpType(null);
    setPhase("select");
    setError(null);
    setSuccess(false);
    setCapitalAmount(0);
    setInitialized(false);
  };

  if (!userId) {
    return <p className="text-muted-foreground text-center py-8">로그인이 필요합니다.</p>;
  }

  // ─── Phase: 저장 완료 ───
  if (phase === "saved") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="text-xl font-bold">기초잔액 저장 완료</p>
        <div className="text-center text-muted-foreground space-y-1">
          <p>회계연도 <strong className="text-primary">{fiscalYear}년</strong></p>
          <p>차변 합계: <strong className="text-blue-600">{formatAmount(totalDebit)}</strong></p>
          <p>대변 합계: <strong className="text-red-600">{formatAmount(totalCredit)}</strong></p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPhase("input")}>수정하기</Button>
          <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
            대시보드
          </Button>
        </div>
      </div>
    );
  }

  // ─── Phase: 법인 유형 선택 ───
  if (phase === "select" && !hasExisting) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">전기 기초잔액 설정</h1>
          <p className="text-muted-foreground text-sm">법인 유형을 선택해주세요</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
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

        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* 기존 법인 */}
          <button
            onClick={() => { setCorpType("existing"); setPhase("upload"); }}
            className="border-2 rounded-xl p-8 text-center hover:border-primary hover:bg-accent/50 transition-all group"
          >
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
            <p className="text-lg font-bold mb-2">기존 법인</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              전기 재무제표가 있는 법인
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              홈택스 표준재무제표 PDF 또는<br />전기 재무상태표 엑셀 업로드
            </p>
          </button>

          {/* 신규 법인 */}
          <button
            onClick={() => { setCorpType("new"); setPhase("upload"); }}
            className="border-2 rounded-xl p-8 text-center hover:border-primary hover:bg-accent/50 transition-all group"
          >
            <PlusCircle className="h-12 w-12 mx-auto text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
            <p className="text-lg font-bold mb-2">신규 법인</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              올해 새로 설립한 법인
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              자본금만 입력하면<br />보통예금/자본금 자동 설정
            </p>
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm max-w-2xl mx-auto">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Phase: 신규법인 자본금 입력 ───
  if (phase === "upload" && corpType === "new") {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">신규 법인 — 자본금 입력</h1>
        </div>

        <div className="border rounded-xl p-6 space-y-4">
          <div className="text-center space-y-2">
            <PlusCircle className="h-10 w-10 mx-auto text-primary" />
            <p className="font-medium">법인 설립 자본금을 입력해주세요</p>
            <p className="text-xs text-muted-foreground">
              자본금은 보통예금(차변)과 자본금(대변)으로 자동 분개됩니다
            </p>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <Label className="text-sm font-medium">자본금</Label>
            <Input
              type="text"
              value={capitalAmount > 0 ? capitalAmount.toLocaleString() : ""}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
                setCapitalAmount(val);
              }}
              className="w-48 text-right font-mono text-lg"
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">원</span>
          </div>

          {capitalAmount > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-center">자동 분개 미리보기</p>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono mt-2">
                <span className="text-muted-foreground">102 보통예금</span>
                <span className="text-right text-blue-600">{formatAmount(capitalAmount)}</span>
                <span className="text-right text-muted-foreground">-</span>
                <span className="text-muted-foreground">301 자본금</span>
                <span className="text-right text-muted-foreground">-</span>
                <span className="text-right text-red-600">{formatAmount(capitalAmount)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={applyCapital}
            disabled={capitalAmount <= 0}
            className="w-full"
            size="lg"
          >
            자본금 적용 후 확인
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Phase: 기존법인 파일 업로드 ───
  if (phase === "upload" && (corpType === "existing" || hasExisting)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {!hasExisting && (
            <button onClick={handleReset} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-xl font-bold">
            {hasExisting ? "전기 기초잔액 입력" : "기존 법인 — 전기 재무제표 업로드"}
          </h1>
          <div className="ml-auto flex items-center gap-2">
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

        <div className="grid grid-cols-2 gap-3">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("balance-pdf-input")?.click()}
          >
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">표준재무제표 PDF 업로드</p>
            <p className="text-xs text-muted-foreground mt-1">홈택스에서 다운로드한 PDF</p>
            <p className="text-xs text-muted-foreground">AI가 자동으로 계정별 금액을 추출합니다</p>
            <input
              id="balance-pdf-input"
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("balance-excel-input")?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">재무상태표 엑셀 업로드</p>
            <p className="text-xs text-muted-foreground mt-1">전기 재무상태표 .xlsx</p>
            <p className="text-xs text-muted-foreground">계정코드(3자리)가 포함된 엑셀</p>
            <input
              id="balance-excel-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {parsing && (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>AI가 재무제표를 분석 중입니다...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <pre className="whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* 수동 입력으로 바로 가기 */}
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setPhase("input")}>
            파일 없이 직접 입력
          </Button>
        </div>
      </div>
    );
  }

  // ─── Phase: 잔액 입력/수정 테이블 ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPhase(corpType === "new" || corpType === "existing" ? "upload" : "select")}
            className="text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">기초잔액 확인 및 수정</h1>
          {corpType === "new" && (
            <Badge variant="outline">신규법인</Badge>
          )}
          {corpType === "existing" && (
            <Badge variant="outline">기존법인</Badge>
          )}
        </div>
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

      {/* 신규법인 안내 */}
      {corpType === "new" && totalDebit > 0 && balanced && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
          보통예금과 자본금이 자동 설정되었습니다. 필요시 다른 계정의 금액도 수정할 수 있습니다.
        </div>
      )}

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

              return catRows.map((row) => {
                const hasValue = row.debitBalance > 0 || row.creditBalance > 0;
                return (
                  <TableRow key={row.accountId} className={hasValue ? "bg-accent/30" : undefined}>
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
                );
              });
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
