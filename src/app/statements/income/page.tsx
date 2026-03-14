"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { formatAmount } from "@/lib/format";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function IncomeStatementPage() {
  const userId = useUserId();
  const year = new Date().getFullYear();
  const data = useQuery(api.statements.getIncomeStatement, userId ? {
    userId,
    fiscalYear: year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  } : "skip");
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  const [sgaOpen, setSgaOpen] = useState(false);

  if (!data) return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;

  const companyName = user?.companyName ?? "주식회사 루미브리즈";
  const period = `제 ${year - 2022}기 ${year}년 01월 01일 ~ ${year}년 12월 31일`;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">손익계산서</h1>

      <div className="text-center text-sm text-muted-foreground mb-4">
        <div className="font-medium text-foreground">{companyName}</div>
        <div>{period}</div>
        <div>(단위: 원)</div>
      </div>

      <div className="border rounded-lg p-6 space-y-1">
        <Row label="Ⅰ. 매출액" amount={data.revenue.total} bold details={data.revenue.details} />
        <Row label="Ⅱ. 매출원가" amount={data.cogs.total} details={data.cogs.details} />
        <Separator />
        <Row label="Ⅲ. 매출총이익" amount={data.grossProfit} bold highlight />

        <div className="pt-2">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-1">
              <span className="font-medium">Ⅳ. 판매비와관리비</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSgaOpen(!sgaOpen)}>
                {sgaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <span className="font-mono">{formatAmount(data.sga.total)}</span>
          </div>
          {sgaOpen && data.sga.details.map((d) => (
            <div key={d.code} className="flex justify-between text-sm py-0.5 pl-6 text-muted-foreground">
              <span>{d.name}</span>
              <span className="font-mono">{formatAmount(d.amount)}</span>
            </div>
          ))}
        </div>

        <Separator />
        <Row label="Ⅴ. 영업이익" amount={data.operatingIncome} bold highlight />

        <Row label="Ⅵ. 영업외수익" amount={data.otherRevenue.total} details={data.otherRevenue.details} />
        <Row label="Ⅶ. 영업외비용" amount={data.otherExpense.total} details={data.otherExpense.details} />
        <Separator />
        <Row label="Ⅷ. 법인세비용차감전순이익" amount={data.incomeBeforeTax} bold />

        <Row label="Ⅸ. 법인세비용" amount={data.tax.total} />
        <Separator />
        <Row label="Ⅹ. 당기순이익" amount={data.netIncome} bold highlight />
      </div>
    </div>
  );
}

function Row({
  label,
  amount,
  bold,
  highlight,
  details,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  highlight?: boolean;
  details?: { code: string; name: string; amount: number }[];
}) {
  return (
    <div>
      <div className={`flex justify-between py-1 ${bold ? "font-medium" : ""} ${highlight ? "bg-muted/50 px-2 rounded" : ""}`}>
        <span>{label}</span>
        <span className={`font-mono ${highlight ? "text-lg" : ""}`}>{formatAmount(amount)}</span>
      </div>
      {details?.map((d) => (
        <div key={d.code} className="flex justify-between text-sm py-0.5 pl-6 text-muted-foreground">
          <span>{d.name}</span>
          <span className="font-mono">{formatAmount(d.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function Separator() {
  return <div className="border-t my-1" />;
}
