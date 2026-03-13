"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { formatAmount } from "@/lib/format";
import Link from "next/link";

const CATEGORIES = ["전체", "자산", "부채", "자본", "수익", "비용"];

export default function GeneralLedgerPage() {
  const year = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${year}-01-01`);
  const [endDate, setEndDate] = useState(`${year}-12-31`);
  const [filter, setFilter] = useState("전체");
  const [showZero, setShowZero] = useState(false);

  const data = useQuery(api.ledger.getGeneralLedger, {
    fiscalYear: year,
    startDate,
    endDate,
  });

  const filtered = (data ?? [])
    .filter((r) => filter === "전체" || r.category === filter)
    .filter((r) => showZero || r.closing !== 0 || r.totalDebit !== 0 || r.totalCredit !== 0);

  const totalDebit = filtered.reduce((s, r) => s + r.totalDebit, 0);
  const totalCredit = filtered.reduce((s, r) => s + r.totalCredit, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">총계정원장</h1>

      <div className="flex items-end gap-4 flex-wrap">
        <DateRangePicker
          startDate={startDate} endDate={endDate}
          onStartChange={setStartDate} onEndChange={setEndDate}
        />
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <Button key={c} variant={filter === c ? "default" : "outline"} size="sm"
              onClick={() => setFilter(c)}>{c}</Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowZero(!showZero)}>
          {showZero ? "잔액 0 숨기기" : "잔액 0 표시"}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">코드</TableHead>
              <TableHead>계정명</TableHead>
              <TableHead>분류</TableHead>
              <TableHead className="text-right">기초잔액</TableHead>
              <TableHead className="text-right text-blue-600">차변합계</TableHead>
              <TableHead className="text-right text-red-600">대변합계</TableHead>
              <TableHead className="text-right">기말잔액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>
                  <Link href={`/ledger/account?id=${r.accountId}`} className="hover:underline text-primary">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.category}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{formatAmount(r.opening)}</TableCell>
                <TableCell className="text-right font-mono text-blue-600">
                  {r.totalDebit > 0 ? formatAmount(r.totalDebit) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  {r.totalCredit > 0 ? formatAmount(r.totalCredit) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatAmount(r.closing)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between text-sm p-3 bg-muted/50 rounded-lg">
        <span>총 {filtered.length}개 계정</span>
        <div className="flex gap-6">
          <span>차변총합: <span className="font-mono font-bold text-blue-600">{formatAmount(totalDebit)}</span></span>
          <span>대변총합: <span className="font-mono font-bold text-red-600">{formatAmount(totalCredit)}</span></span>
        </div>
      </div>
    </div>
  );
}
