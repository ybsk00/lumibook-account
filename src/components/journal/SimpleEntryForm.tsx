"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/common/AmountInput";
import { AiResultPreview } from "./AiResultPreview";
import { Loader2, Sparkles } from "lucide-react";
import { useUserId } from "@/hooks/useUserId";

interface AiResult {
  journalType: string;
  entries: {
    accountCode: string;
    accountName: string;
    debitAmount: number;
    creditAmount: number;
    partnerName: string | null;
    description: string;
  }[];
  reasoning: string;
}

export function SimpleEntryForm() {
  const userId = useUserId();
  const generateJournal = useAction(api.aiJournal.generateJournal);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"입금" | "출금">("출금");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);

  const handleGenerate = async () => {
    if (!userId) return;
    if (!amount || !description) {
      setError("금액과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await generateJournal({ userId, type, amount, description });
      setResult(res as AiResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 분개 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setAmount(0);
    setDescription("");
    setError("");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>날짜</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>구분</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={type === "입금" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("입금")}
            >
              입금
            </Button>
            <Button
              type="button"
              variant={type === "출금" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("출금")}
            >
              출금
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>금액</Label>
          <AmountInput value={amount} onChange={setAmount} />
        </div>

        <div className="space-y-2">
          <Label>내용</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: 사무실 월세, 캐스팅엔 개발비..."
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!result && (
        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI 분개 생성 중...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              AI 분개 생성
            </>
          )}
        </Button>
      )}

      {result && (
        <AiResultPreview
          result={result}
          date={date}
          inputType={type}
          inputAmount={amount}
          inputDescription={description}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
