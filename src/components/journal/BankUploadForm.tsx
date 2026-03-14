"use client";

import { useState, useCallback } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseBankExcel, type BankTransaction } from "@/lib/bankExcelParser";
import { classifyTransactionsLocal, type ClassificationResult } from "@/lib/bankClassificationRules";
import { BankTransactionReviewTable } from "./BankTransactionReviewTable";
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";

type Phase = "upload" | "parsing" | "classifying" | "review" | "saving" | "done";

export function BankUploadForm() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; total: number } | null>(null);

  const userId = useUserId();
  const context = useQuery(api.bankUpload.getClassificationContext, userId ? { userId } : "skip");
  const classifyAi = useAction(api.bankUploadAi.classifyBatch);
  const batchCreate = useMutation(api.bankUpload.batchCreateJournals);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setPhase("parsing");
    setProgress("엑셀 파일 파싱 중...");

    try {
      const txns = await parseBankExcel(file);
      setTransactions(txns);
      setProgress(`${txns.length}건 파싱 완료. 분류 시작...`);
      setPhase("classifying");

      if (!context) {
        setError("계정/거래처 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        setPhase("upload");
        return;
      }

      // 1차 + 2차: 클라이언트 사이드 분류
      setProgress("1차 규칙 분류 + 2차 패턴 매칭 중...");
      const { classified, unclassified } = classifyTransactionsLocal(
        txns,
        context.accounts as any,
        context.partners as any,
        context.examples as any,
      );

      let allClassified = [...classified];

      // 3차: AI 분류 (미분류 건이 있을 때만)
      if (unclassified.length > 0) {
        setProgress(`3차 AI 분류 중... (${unclassified.length}건)`);
        try {
          const aiResults = await classifyAi({
            userId: userId!,
            transactions: unclassified.map((tx) => ({
              id: tx.id,
              date: tx.date,
              description: tx.description,
              deposit: tx.deposit,
              withdrawal: tx.withdrawal,
            })),
          });

          // AI 결과를 ClassificationResult로 변환
          for (const tx of unclassified) {
            const aiResult = aiResults.find((r: any) => r.id === tx.id);
            const isDeposit = tx.deposit > 0;
            const amount = isDeposit ? tx.deposit : tx.withdrawal;

            if (aiResult && aiResult.counterAccountCode) {
              const vatSep = aiResult.vatSeparation ?? false;
              const supplyAmount = vatSep ? Math.round(amount / 1.1) : amount;
              const taxAmount = vatSep ? amount - supplyAmount : 0;

              allClassified.push({
                transactionId: tx.id,
                stage: 3,
                confidence: "low",
                journalType: aiResult.journalType || (isDeposit ? "입금" : "출금"),
                accountCode: "102",
                accountName: "보통예금",
                counterAccountCode: aiResult.counterAccountCode,
                counterAccountName: aiResult.counterAccountName || aiResult.counterAccountCode,
                partnerName: aiResult.partnerName || undefined,
                vatSeparation: vatSep,
                supplyAmount,
                taxAmount,
                reasoning: aiResult.reasoning || "AI 자동 분류",
              });
            } else {
              // AI도 분류 못한 건
              allClassified.push({
                transactionId: tx.id,
                stage: 3,
                confidence: "low",
                journalType: isDeposit ? "입금" : "출금",
                accountCode: "102",
                accountName: "보통예금",
                counterAccountCode: "",
                counterAccountName: "미분류",
                vatSeparation: false,
                supplyAmount: amount,
                taxAmount: 0,
                reasoning: "자동 분류 실패 — 수동 지정 필요",
              });
            }
          }
        } catch (err) {
          console.error("AI classification failed:", err);
          // AI 실패 시 미분류로 처리
          for (const tx of unclassified) {
            const isDeposit = tx.deposit > 0;
            const amount = isDeposit ? tx.deposit : tx.withdrawal;
            allClassified.push({
              transactionId: tx.id,
              stage: 3,
              confidence: "low",
              journalType: isDeposit ? "입금" : "출금",
              accountCode: "102",
              accountName: "보통예금",
              counterAccountCode: "",
              counterAccountName: "미분류",
              vatSeparation: false,
              supplyAmount: amount,
              taxAmount: 0,
              reasoning: "AI 분류 실패 — 수동 지정 필요",
            });
          }
        }
      }

      // 분류 통계
      const stage1 = allClassified.filter((c) => c.stage === 1).length;
      const stage2 = allClassified.filter((c) => c.stage === 2).length;
      const stage3 = allClassified.filter((c) => c.stage === 3).length;
      setProgress(`분류 완료: 1차 ${stage1}건, 2차 ${stage2}건, 3차 ${stage3}건`);

      setClassifications(allClassified);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 처리 중 오류가 발생했습니다.");
      setPhase("upload");
    }
  }, [context, classifyAi]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleApprove = async (items: {
    transaction: BankTransaction;
    classification: ClassificationResult;
  }[]) => {
    setPhase("saving");
    setProgress(`${items.length}건 전표 생성 중...`);

    try {
      const batchItems = items
        .filter((item) => item.classification.counterAccountCode) // 미분류 제외
        .map((item) => {
          const { transaction: tx, classification: cls } = item;
          const isDeposit = tx.deposit > 0;
          const amount = isDeposit ? tx.deposit : tx.withdrawal;

          // 분개라인 생성
          const entries: {
            accountCode: string;
            debitAmount: number;
            creditAmount: number;
            partnerName?: string;
            description?: string;
          }[] = [];

          if (cls.vatSeparation) {
            // 부가세 분리 거래
            if (isDeposit) {
              // 입금: 보통예금(차) / 매출(대) + 부가세예수금(대)
              entries.push({
                accountCode: "102",
                debitAmount: amount,
                creditAmount: 0,
                partnerName: cls.partnerName,
                description: tx.description,
              });
              entries.push({
                accountCode: cls.counterAccountCode,
                debitAmount: 0,
                creditAmount: cls.supplyAmount,
                partnerName: cls.partnerName,
                description: "공급가액",
              });
              entries.push({
                accountCode: "207",
                debitAmount: 0,
                creditAmount: cls.taxAmount,
                partnerName: cls.partnerName,
                description: "부가세",
              });
            } else {
              // 출금: 비용(차) + 부가세대급금(차) / 보통예금(대)
              entries.push({
                accountCode: cls.counterAccountCode,
                debitAmount: cls.supplyAmount,
                creditAmount: 0,
                partnerName: cls.partnerName,
                description: "공급가액",
              });
              entries.push({
                accountCode: "113",
                debitAmount: cls.taxAmount,
                creditAmount: 0,
                partnerName: cls.partnerName,
                description: "부가세",
              });
              entries.push({
                accountCode: "102",
                debitAmount: 0,
                creditAmount: amount,
                partnerName: cls.partnerName,
                description: tx.description,
              });
            }
          } else {
            // 면세 거래
            if (isDeposit) {
              entries.push({
                accountCode: "102",
                debitAmount: amount,
                creditAmount: 0,
                partnerName: cls.partnerName,
                description: tx.description,
              });
              entries.push({
                accountCode: cls.counterAccountCode,
                debitAmount: 0,
                creditAmount: amount,
                partnerName: cls.partnerName,
                description: tx.description,
              });
            } else {
              entries.push({
                accountCode: cls.counterAccountCode,
                debitAmount: amount,
                creditAmount: 0,
                partnerName: cls.partnerName,
                description: tx.description,
              });
              entries.push({
                accountCode: "102",
                debitAmount: 0,
                creditAmount: amount,
                partnerName: cls.partnerName,
                description: tx.description,
              });
            }
          }

          return {
            journalDate: tx.date,
            journalType: cls.journalType,
            description: tx.description,
            totalAmount: amount,
            entries,
            inputType: isDeposit ? "입금" : "출금",
            inputDescription: tx.description,
          };
        });

      // 50건씩 배치 처리
      const CHUNK_SIZE = 50;
      let totalCreated = 0;

      for (let i = 0; i < batchItems.length; i += CHUNK_SIZE) {
        const chunk = batchItems.slice(i, i + CHUNK_SIZE);
        setProgress(`전표 생성 중... (${i + 1}~${Math.min(i + CHUNK_SIZE, batchItems.length)} / ${batchItems.length})`);
        const res = await batchCreate({ userId: userId!, items: chunk });
        totalCreated += res.created;
      }

      setResult({ created: totalCreated, total: batchItems.length });
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "전표 생성 중 오류가 발생했습니다.");
      setPhase("review");
    }
  };

  const handleReset = () => {
    setPhase("upload");
    setTransactions([]);
    setClassifications([]);
    setError(null);
    setResult(null);
    setProgress("");
  };

  // ─── Upload Phase ───
  if (phase === "upload") {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("bank-file-input")?.click()}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">통장 거래내역 엑셀을 업로드하세요</p>
          <p className="text-sm text-muted-foreground mb-4">
            .xlsx, .xls, .csv 파일을 드래그하거나 클릭하여 선택
          </p>
          <p className="text-xs text-muted-foreground">
            기업은행, 국민은행, 신한은행, 하나은행, 우리은행 등 주요 은행 엑셀 형식 지원
          </p>
          <input
            id="bank-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
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
          <p className="font-medium">처리 과정</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li><strong className="text-green-600">1차 규칙 분개</strong> — 거래처명/키워드 매칭 (즉시)</li>
            <li><strong className="text-yellow-600">2차 패턴 매칭</strong> — 과거 유사 거래 패턴 (즉시)</li>
            <li><strong className="text-orange-600">3차 AI 분개</strong> — Gemini AI 자동 분류</li>
            <li><strong>최종 검토</strong> — 수정 및 승인은 사용자가 직접</li>
          </ol>
        </div>
      </div>
    );
  }

  // ─── Parsing / Classifying Phase ───
  if (phase === "parsing" || phase === "classifying") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">{progress}</p>
        {phase === "classifying" && transactions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {transactions.length}건 거래내역 처리 중...
          </p>
        )}
      </div>
    );
  }

  // ─── Saving Phase ───
  if (phase === "saving") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">{progress}</p>
      </div>
    );
  }

  // ─── Done Phase ───
  if (phase === "done" && result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600">
          <Check className="h-8 w-8" />
        </div>
        <p className="text-xl font-bold">전표 생성 완료</p>
        <p className="text-muted-foreground">
          {result.total}건 중 <strong className="text-primary">{result.created}건</strong> 전표가 생성되었습니다.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleReset}>새 파일 업로드</Button>
          <Button variant="outline" onClick={() => window.location.href = "/journals"}>
            전표 목록 보기
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
          <span className="font-medium">{transactions.length}건 거래내역</span>
          <Badge variant="outline">{progress}</Badge>
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

      <BankTransactionReviewTable
        transactions={transactions}
        classifications={classifications}
        onApprove={handleApprove}
        approving={false}
      />
    </div>
  );
}
