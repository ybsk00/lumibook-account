"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
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
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

interface EntryLine {
  id?: Id<"journalEntries">;
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

export default function JournalEditPage() {
  const params = useParams();
  const router = useRouter();
  const journalId = params.id as Id<"journals">;
  const userId = useUserId();

  const journal = useQuery(api.journals.getById, { id: journalId });
  const entries = useQuery(api.journalEntries.getByJournal, { journalId });

  const updateJournal = useMutation(api.journals.update);
  const deleteEntries = useMutation(api.journalEntries.deleteByJournal);
  const createEntries = useMutation(api.journalEntries.createBatch);
  const removeJournal = useMutation(api.journals.remove);

  const [date, setDate] = useState("");
  const [journalType, setJournalType] = useState("대체");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 데이터 로드
  useEffect(() => {
    if (journal && entries && !loaded) {
      setDate(journal.journalDate);
      setJournalType(journal.journalType);
      setDescription(journal.description);
      setLines(
        entries.map((e) => ({
          id: e._id,
          accountId: e.accountId,
          partnerId: e.partnerId ?? null,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          description: e.description ?? "",
        }))
      );
      setLoaded(true);
    }
  }, [journal, entries, loaded]);

  const { totalDebit, totalCredit, valid } = useJournalValidation(lines);

  const updateLine = (index: number, updates: Partial<EntryLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)));
    setSaved(false);
  };

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!userId || !valid) return;
    if (!description) { alert("적요를 입력해주세요."); return; }
    if (lines.some((l) => !l.accountId)) { alert("모든 라인의 계정과목을 선택해주세요."); return; }

    setSaving(true);
    try {
      // 전표 헤더 업데이트
      await updateJournal({
        id: journalId,
        journalDate: date,
        journalType,
        description,
        totalAmount: totalDebit,
      });

      // 기존 분개라인 삭제 후 재생성
      await deleteEntries({ journalId });
      const newEntries = lines
        .filter((l) => l.debitAmount > 0 || l.creditAmount > 0)
        .map((l, i) => ({
          lineNumber: i + 1,
          accountId: l.accountId!,
          partnerId: l.partnerId ?? undefined,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: l.description || undefined,
        }));
      await createEntries({ journalId, entries: newEntries });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("이 전표를 삭제하시겠습니까? 분개라인도 함께 삭제됩니다.")) return;
    try {
      await removeJournal({ id: journalId });
      router.push("/journals");
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  if (!journal || !entries) {
    return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/journals")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">전표 수정</h1>
          <Badge variant="outline" className="font-mono">{journal.journalNumber}</Badge>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          삭제
        </Button>
      </div>

      {/* 전표 헤더 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>날짜</Label>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSaved(false); }} />
        </div>
        <div className="space-y-2">
          <Label>유형</Label>
          <Select value={journalType} onValueChange={(v) => { setJournalType(v ?? "대체"); setSaved(false); }}>
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
            onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
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
            <span className="font-mono font-bold text-blue-600">{formatAmount(totalDebit)}</span>
          </span>
          <span>
            대변 합계:{" "}
            <span className="font-mono font-bold text-red-600">{formatAmount(totalCredit)}</span>
          </span>
        </div>
        <Badge variant={valid ? "default" : "destructive"}>
          {valid ? "대차균형" : `차액: ${formatAmount(Math.abs(totalDebit - totalCredit))}`}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !valid} className="flex-1">
          <Save className="h-4 w-4 mr-1" />
          {saving ? "저장 중..." : "전표 수정 저장"}
        </Button>
        {saved && <span className="text-sm text-green-600">저장되었습니다.</span>}
      </div>
    </div>
  );
}
