"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format";

export default function TrialBalancePage() {
  const year = new Date().getFullYear();
  const data = useQuery(api.statements.getTrialBalance, {
    fiscalYear: year,
    endDate: `${year}-12-31`,
  });
  const settings = useQuery(api.settings.get);

  if (!data) return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;

  const balanced = data.totalDebitBalance === data.totalCreditBalance;
  const companyName = settings?.companyName ?? "주식회사 루미브리즈";

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">합계잔액시산표</h1>
        <Badge variant={balanced ? "default" : "destructive"}>
          {balanced ? "차대일치" : "차대불일치"}
        </Badge>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{companyName}</div>
        <div>{year}년 12월 31일 현재 (단위: 원)</div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">코드</TableHead>
              <TableHead>계정명</TableHead>
              <TableHead className="text-right text-blue-600">차변잔액</TableHead>
              <TableHead className="text-right text-red-600">대변잔액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right font-mono text-blue-600">
                  {r.debitBalance > 0 ? formatAmount(r.debitBalance) : ""}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {r.creditBalance > 0 ? formatAmount(r.creditBalance) : ""}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold border-t-2">
              <TableCell colSpan={2}>합계</TableCell>
              <TableCell className="text-right font-mono text-blue-600">
                {formatAmount(data.totalDebitBalance)}
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {formatAmount(data.totalCreditBalance)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
