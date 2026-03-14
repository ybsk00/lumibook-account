"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/common/AmountInput";
import { AccountCombobox } from "@/components/common/AccountCombobox";
import { PartnerCombobox } from "@/components/common/PartnerCombobox";
import { useJournalValidation } from "@/hooks/useJournalValidation";
import { formatAmount } from "@/lib/format";
import { Plus, Trash2, Check } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";
import type { Id } from "../../../convex/_generated/dataModel";

interface EntryLine {
  accountId: Id<"accounts"> | null;
  partnerId: Id<"partners"> | null;
  debitAmount: number;
  creditAmount: number;
  description: string;
}

const EMPTY_LINE: EntryLine = {
  accountId: null,
  partnerId: null,
  debitAmount: 0,
  creditAmount: 0,
  description: "",
};

export function ManualEntryForm() {
  const userId = useUserId();
  const createJournal = useMutation(api.journals.create);
  const createEntries = useMutation(api.journalEntries.createBatch);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [journalType, setJournalType] = useState("대체");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { totalDebit, totalCredit, valid } = useJournalValidation(lines);

  const updateLine = (index: number, updates: Partial<EntryLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!valid) return;
    if (!description) {
      alert("적요를 입력해주세요.");
      return;
    }
    if (lines.some((l) => !l.accountId)) {
      alert("모든 라인의 계정과목을 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      const journalId = await createJournal({
        userId,
        journalDate: date,
        journalType,
        description,
        totalAmount: totalDebit,
        status: "confirmed",
      });

      const entries = lines
        .filter((l) => l.debitAmount > 0 || l.creditAmount > 0)
        .map((l, i) => ({
          lineNumber: i + 1,
          accountId: l.accountId!,
          partnerId: l.partnerId ?? undefined,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: l.description || undefined,
        }));

      await createEntries({ journalId, entries });
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
        <Button
          variant="outline"
          onClick={() => {
            setSaved(false);
            setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
            setDescription("");
          }}
        >
          새 전표 입력
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 전표 헤더 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>날짜</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>유형</Label>
          <Select value={journalType} onValueChange={(v) => setJournalType(v ?? "대체")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["입금", "출금", "대체", "매입", "매출"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-2">
          <Label>적요</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="거래 내용 입력"
          />
        </div>
      </div>

      {/* 분개라인 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_1fr_140px_140px_140px_40px] gap-2 p-2 bg-muted text-xs font-medium">
          <div>#</div>
          <div>계정과목</div>
          <div>거래처</div>
          <div className="text-right text-blue-600">차변</div>
          <div className="text-right text-red-600">대변</div>
          <div>적요</div>
          <div></div>
        </div>
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[40px_1fr_1fr_140px_140px_140px_40px] gap-2 p-2 border-t items-center"
          >
            <div className="text-sm text-muted-foreground">{i + 1}</div>
            <AccountCombobox
              value={line.accountId}
              onChange={(id) => updateLine(i, { accountId: id })}
            />
            <PartnerCombobox
              value={line.partnerId}
              onChange={(id) => updateLine(i, { partnerId: id })}
            />
            <AmountInput
              value={line.debitAmount}
              onChange={(v) => updateLine(i, { debitAmount: v, creditAmount: v > 0 ? 0 : line.creditAmount })}
            />
            <AmountInput
              value={line.creditAmount}
              onChange={(v) => updateLine(i, { creditAmount: v, debitAmount: v > 0 ? 0 : line.debitAmount })}
            />
            <Input
              value={line.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              placeholder="적요"
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeLine(i)}
              disabled={lines.length <= 2}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addLine}>
        <Plus className="h-4 w-4 mr-1" /> 라인 추가
      </Button>

      {/* 합계 + 대차균형 */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex gap-6 text-sm">
          <span>
            차변 합계:{" "}
            <span className="font-mono font-bold text-blue-600">
              {formatAmount(totalDebit)}
            </span>
          </span>
          <span>
            대변 합계:{" "}
            <span className="font-mono font-bold text-red-600">
              {formatAmount(totalCredit)}
            </span>
          </span>
        </div>
        <Badge variant={valid ? "default" : "destructive"}>
          {valid ? "대차균형" : `차액: ${formatAmount(Math.abs(totalDebit - totalCredit))}`}
        </Badge>
      </div>

      <Button onClick={handleSave} disabled={saving || !valid} className="w-full">
        {saving ? "저장 중..." : "전표 저장"}
      </Button>
    </div>
  );
}
