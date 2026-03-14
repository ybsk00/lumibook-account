"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/format";

export default function BalanceSheetPage() {
  const userId = useUserId();
  const year = new Date().getFullYear();
  const data = useQuery(api.statements.getBalanceSheet, userId ? {
    userId,
    fiscalYear: year,
    endDate: `${year}-12-31`,
  } : "skip");
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  if (!data) return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;

  const companyName = user?.companyName ?? "주식회사 루미브리즈";
  const period = `제 ${year - 2022}기 ${year}년 12월 31일 현재`;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">재무상태표</h1>
        <Badge variant={data.balanced ? "default" : "destructive"}>
          {data.balanced ? "대차일치" : `대차불일치 (차액: ${formatAmount(data.diff)})`}
        </Badge>
      </div>

      <div className="text-center text-sm text-muted-foreground mb-4">
        <div className="font-medium text-foreground">{companyName}</div>
        <div>{period}</div>
        <div>(단위: 원)</div>
      </div>

      <div className="grid grid-cols-2 gap-6 print:gap-2">
        {/* 자산의 부 */}
        <div className="border rounded-lg p-4 print:border-0">
          <h2 className="font-bold text-center mb-3 text-lg">자산의 부</h2>

          <Section title="Ⅰ. 유동자산" items={data.assets.current.details} total={data.assets.current.total} />
          <Section title="Ⅱ. 비유동자산" items={data.assets.nonCurrent.details} total={data.assets.nonCurrent.total} />

          <div className="border-t-2 border-foreground mt-3 pt-2 flex justify-between font-bold text-lg">
            <span>자산총계</span>
            <span className="font-mono">{formatAmount(data.assets.total)}</span>
          </div>
        </div>

        {/* 부채와 자본의 부 */}
        <div className="border rounded-lg p-4 print:border-0">
          <h2 className="font-bold text-center mb-3 text-lg">부채와 자본의 부</h2>

          <Section title="Ⅰ. 유동부채" items={data.liabilities.current.details} total={data.liabilities.current.total} />
          <Section title="Ⅱ. 비유동부채" items={data.liabilities.nonCurrent.details} total={data.liabilities.nonCurrent.total} />

          <div className="border-t mt-2 pt-1 flex justify-between font-medium">
            <span>부채총계</span>
            <span className="font-mono">{formatAmount(data.liabilities.total)}</span>
          </div>

          <div className="mt-4">
            <h3 className="font-medium text-sm text-muted-foreground mb-1">자본</h3>
            {data.equity.details.map((d) => (
              <div key={d.code} className="flex justify-between text-sm py-0.5">
                <span className="pl-4">{d.name}</span>
                <span className="font-mono">{formatAmount(d.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm py-0.5">
              <span className="pl-4">당기순이익</span>
              <span className="font-mono">{formatAmount(data.equity.netIncome)}</span>
            </div>
            <div className="border-t mt-1 pt-1 flex justify-between font-medium">
              <span>자본총계</span>
              <span className="font-mono">{formatAmount(data.equity.total)}</span>
            </div>
          </div>

          <div className="border-t-2 border-foreground mt-3 pt-2 flex justify-between font-bold text-lg">
            <span>부채와자본총계</span>
            <span className="font-mono">{formatAmount(data.liabilities.total + data.equity.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  total,
}: {
  title: string;
  items: { code: string; name: string; amount: number }[];
  total: number;
}) {
  return (
    <div className="mb-3">
      <h3 className="font-medium text-sm text-muted-foreground mb-1">{title}</h3>
      {items.map((item) => (
        <div key={item.code} className="flex justify-between text-sm py-0.5">
          <span className="pl-4">{item.name}</span>
          <span className="font-mono">{formatAmount(item.amount)}</span>
        </div>
      ))}
      <div className="border-t mt-1 pt-1 flex justify-between text-sm font-medium">
        <span>{title} 소계</span>
        <span className="font-mono">{formatAmount(total)}</span>
      </div>
    </div>
  );
}
