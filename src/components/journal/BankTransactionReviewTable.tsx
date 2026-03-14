"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AccountCombobox } from "@/components/common/AccountCombobox";
import { formatAmount } from "@/lib/format";
import type { BankTransaction } from "@/lib/bankExcelParser";
import type { ClassificationResult } from "@/lib/bankClassificationRules";
import { Check, Pencil, X } from "lucide-react";

interface ReviewRow {
  transaction: BankTransaction;
  classification: ClassificationResult;
  selected: boolean;
  edited: boolean;
}

interface BankTransactionReviewTableProps {
  transactions: BankTransaction[];
  classifications: ClassificationResult[];
  onApprove: (items: {
    transaction: BankTransaction;
    classification: ClassificationResult;
  }[]) => void;
  approving: boolean;
}

const CONFIDENCE_STYLES = {
  high: { label: "높음", color: "bg-green-100 text-green-800 border-green-200" },
  medium: { label: "중간", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  low: { label: "낮음", color: "bg-orange-100 text-orange-800 border-orange-200" },
};

const STAGE_LABELS = {
  1: "규칙",
  2: "패턴",
  3: "AI",
};

export function BankTransactionReviewTable({
  transactions,
  classifications,
  onApprove,
  approving,
}: BankTransactionReviewTableProps) {
  const userId = useUserId();
  const accounts = useQuery(api.accounts.list, userId ? { userId, activeOnly: true } : "skip");

  // classification을 transaction id로 매핑
  const classMap = new Map(classifications.map((c) => [c.transactionId, c]));

  const [rows, setRows] = useState<ReviewRow[]>(() =>
    transactions.map((tx) => ({
      transaction: tx,
      classification: classMap.get(tx.id) ?? {
        transactionId: tx.id,
        stage: 3 as const,
        confidence: "low" as const,
        journalType: tx.deposit > 0 ? "입금" : "출금",
        accountCode: "102",
        accountName: "보통예금",
        counterAccountCode: "",
        counterAccountName: "미분류",
        vatSeparation: false,
        supplyAmount: tx.deposit > 0 ? tx.deposit : tx.withdrawal,
        taxAmount: 0,
        reasoning: "자동 분류 실패 — 수동 지정 필요",
      },
      selected: true,
      edited: false,
    }))
  );

  const [editingRow, setEditingRow] = useState<string | null>(null);

  const selectedCount = rows.filter((r) => r.selected).length;
  const totalDeposit = rows.filter((r) => r.selected).reduce((s, r) => s + r.transaction.deposit, 0);
  const totalWithdrawal = rows.filter((r) => r.selected).reduce((s, r) => s + r.transaction.withdrawal, 0);

  const toggleAll = () => {
    const allSelected = rows.every((r) => r.selected);
    setRows(rows.map((r) => ({ ...r, selected: !allSelected })));
  };

  const toggleRow = (id: string) => {
    setRows(rows.map((r) =>
      r.transaction.id === id ? { ...r, selected: !r.selected } : r
    ));
  };

  const updateClassification = (
    id: string,
    accountCode: string,
    accountName: string,
  ) => {
    setRows(rows.map((r) => {
      if (r.transaction.id !== id) return r;
      const amount = r.transaction.deposit > 0 ? r.transaction.deposit : r.transaction.withdrawal;
      const vatSep = r.classification.vatSeparation;
      return {
        ...r,
        classification: {
          ...r.classification,
          counterAccountCode: accountCode,
          counterAccountName: accountName,
          confidence: "high" as const,
          reasoning: `수동 지정: ${accountName}`,
          supplyAmount: vatSep ? Math.round(amount / 1.1) : amount,
          taxAmount: vatSep ? amount - Math.round(amount / 1.1) : 0,
        },
        edited: true,
      };
    }));
    setEditingRow(null);
  };

  const toggleVat = (id: string) => {
    setRows(rows.map((r) => {
      if (r.transaction.id !== id) return r;
      const amount = r.transaction.deposit > 0 ? r.transaction.deposit : r.transaction.withdrawal;
      const newVat = !r.classification.vatSeparation;
      return {
        ...r,
        classification: {
          ...r.classification,
          vatSeparation: newVat,
          supplyAmount: newVat ? Math.round(amount / 1.1) : amount,
          taxAmount: newVat ? amount - Math.round(amount / 1.1) : 0,
        },
        edited: true,
      };
    }));
  };

  const handleApprove = () => {
    const selected = rows
      .filter((r) => r.selected && r.classification.counterAccountCode)
      .map((r) => ({
        transaction: r.transaction,
        classification: r.classification,
      }));
    onApprove(selected);
  };

  return (
    <div className="space-y-4">
      {/* 요약 바 */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-4 text-sm">
          <span>전체 <strong>{rows.length}</strong>건</span>
          <span>선택 <strong className="text-primary">{selectedCount}</strong>건</span>
          <span>입금 <strong className="text-blue-600">{formatAmount(totalDeposit)}</strong></span>
          <span>출금 <strong className="text-red-600">{formatAmount(totalWithdrawal)}</strong></span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
          >
            {rows.every((r) => r.selected) ? "전체 해제" : "전체 선택"}
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={approving || selectedCount === 0}
          >
            {approving ? "저장 중..." : `선택 ${selectedCount}건 승인`}
          </Button>
        </div>
      </div>

      {/* 신뢰도 범례 */}
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-400" /> 1차 규칙 (높음)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" /> 2차 패턴 (중간)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-400" /> 3차 AI (낮음)
        </span>
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={rows.every((r) => r.selected)}
                  onChange={toggleAll}
                  className="rounded"
                />
              </TableHead>
              <TableHead className="w-12">#</TableHead>
              <TableHead>날짜</TableHead>
              <TableHead>적요</TableHead>
              <TableHead className="text-right text-blue-600">입금</TableHead>
              <TableHead className="text-right text-red-600">출금</TableHead>
              <TableHead>분류 계정</TableHead>
              <TableHead className="w-16">부가세</TableHead>
              <TableHead className="w-16">신뢰도</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const conf = CONFIDENCE_STYLES[row.classification.confidence];
              const isEditing = editingRow === row.transaction.id;

              return (
                <TableRow
                  key={row.transaction.id}
                  className={!row.selected ? "opacity-50" : undefined}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(row.transaction.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{row.transaction.date}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={row.transaction.description}>
                    {row.transaction.description}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600">
                    {row.transaction.deposit > 0 ? formatAmount(row.transaction.deposit) : ""}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {row.transaction.withdrawal > 0 ? formatAmount(row.transaction.withdrawal) : ""}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="w-[220px]">
                        <AccountCombobox
                          value={null}
                          onChange={(id, acc) => {
                            updateClassification(row.transaction.id, acc.code, acc.name);
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRow(row.transaction.id)}
                        className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                        title={row.classification.reasoning}
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.classification.counterAccountCode}
                        </span>
                        <span>{row.classification.counterAccountName}</span>
                        {row.edited && <Check className="h-3 w-3 text-green-600" />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleVat(row.transaction.id)}
                      className={`text-xs px-1.5 py-0.5 rounded border ${
                        row.classification.vatSeparation
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                      }`}
                    >
                      {row.classification.vatSeparation ? "과세" : "면세"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${conf.color}`}
                      title={`${STAGE_LABELS[row.classification.stage]}차: ${row.classification.reasoning}`}
                    >
                      {STAGE_LABELS[row.classification.stage]}차
                    </span>
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
