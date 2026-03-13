"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format";
import { Check, RotateCcw, Lightbulb } from "lucide-react";

interface AiEntry {
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  partnerName: string | null;
  description: string;
}

interface AiResultPreviewProps {
  result: {
    journalType: string;
    entries: AiEntry[];
    reasoning: string;
  };
  date: string;
  inputType: string;
  inputAmount: number;
  inputDescription: string;
  onReset: () => void;
}

export function AiResultPreview({
  result,
  date,
  inputType,
  inputAmount,
  inputDescription,
  onReset,
}: AiResultPreviewProps) {
  const accounts = useQuery(api.accounts.list, { activeOnly: true });
  const partners = useQuery(api.partners.list, { activeOnly: true });
  const createJournal = useMutation(api.journals.create);
  const createEntries = useMutation(api.journalEntries.createBatch);
  const saveFn = useMutation(api.aiJournalExamples.saveExample);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalDebit = result.entries.reduce((s, e) => s + e.debitAmount, 0);
  const totalCredit = result.entries.reduce((s, e) => s + e.creditAmount, 0);
  const balanced = totalDebit === totalCredit;

  const handleSave = async () => {
    if (!accounts) return;
    setSaving(true);

    try {
      // 전표 생성
      const journalId = await createJournal({
        journalDate: date,
        journalType: result.journalType,
        description: inputDescription,
        totalAmount: totalDebit,
        status: "confirmed",
        aiInput: { type: inputType, amount: inputAmount, description: inputDescription },
      });

      // 분개라인 생성
      const entries = result.entries.map((e, i) => {
        const acc = accounts.find((a) => a.code === e.accountCode);
        const partner = e.partnerName
          ? partners?.find((p) => p.name === e.partnerName)
          : null;

        return {
          lineNumber: i + 1,
          accountId: acc!._id,
          partnerId: partner?._id,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          description: e.description,
        };
      });

      await createEntries({ journalId, entries });

      // AI 학습 데이터 저장
      await saveFn({
        inputDescription,
        inputType,
        resultEntries: result.entries.map((e) => ({
          accountCode: e.accountCode,
          accountName: e.accountName,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          partnerName: e.partnerName ?? undefined,
        })),
      });

      setSaved(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-600">
          <Check className="h-6 w-6" />
        </div>
        <p className="font-medium">전표가 저장되었습니다.</p>
        <Button variant="outline" onClick={onReset}>
          새 전표 입력
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge>{result.journalType}</Badge>
          <Badge variant={balanced ? "default" : "destructive"}>
            {balanced ? "대차균형" : "대차불일치"}
          </Badge>
        </div>
      </div>

      {/* 분개 테이블 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>계정코드</TableHead>
            <TableHead>계정명</TableHead>
            <TableHead>거래처</TableHead>
            <TableHead className="text-right text-blue-600">차변</TableHead>
            <TableHead className="text-right text-red-600">대변</TableHead>
            <TableHead>적요</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.entries.map((entry, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono">{entry.accountCode}</TableCell>
              <TableCell>{entry.accountName}</TableCell>
              <TableCell className="text-muted-foreground">
                {entry.partnerName ?? "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-blue-600">
                {entry.debitAmount > 0 ? formatAmount(entry.debitAmount) : ""}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {entry.creditAmount > 0 ? formatAmount(entry.creditAmount) : ""}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {entry.description}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold">
            <TableCell colSpan={3}>합계</TableCell>
            <TableCell className="text-right font-mono text-blue-600">
              {formatAmount(totalDebit)}
            </TableCell>
            <TableCell className="text-right font-mono text-red-600">
              {formatAmount(totalCredit)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>

      {/* AI 판단 근거 */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <div className="flex items-center gap-1 font-medium mb-1">
          <Lightbulb className="h-4 w-4" />
          AI 판단 근거
        </div>
        <p className="text-muted-foreground">{result.reasoning}</p>
      </div>

      {/* 버튼 */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !balanced} className="flex-1">
          {saving ? "저장 중..." : "승인 저장"}
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          다시 생성
        </Button>
      </div>
    </div>
  );
}
