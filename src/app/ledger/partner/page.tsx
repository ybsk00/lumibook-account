"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { PartnerCombobox } from "@/components/common/PartnerCombobox";
import { formatAmount, formatDate } from "@/lib/format";
import { useUserId } from "@/hooks/useUserId";
import { useCurrentFiscalYear } from "@/hooks/useCurrentFiscalYear";
import { Pencil } from "lucide-react";
import Link from "next/link";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function PartnerLedgerPage() {
  const userId = useUserId();
  const { startDate: fyStart, endDate: fyEnd } = useCurrentFiscalYear();
  const [partnerId, setPartnerId] = useState<Id<"partners"> | null>(null);
  const [startDate, setStartDate] = useState(fyStart);
  const [endDate, setEndDate] = useState(fyEnd);

  useEffect(() => {
    setStartDate(fyStart);
    setEndDate(fyEnd);
  }, [fyStart, fyEnd]);

  const data = useQuery(
    api.ledger.getPartnerLedger,
    userId && partnerId ? { userId, partnerId, startDate, endDate } : "skip"
  );

  const totalDebit = data?.entries.reduce((s, e) => s + e.debitAmount, 0) ?? 0;
  const totalCredit = data?.entries.reduce((s, e) => s + e.creditAmount, 0) ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">거래처별원장</h1>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="w-[240px]">
          <PartnerCombobox value={partnerId} onChange={setPartnerId} />
        </div>
        <DateRangePicker
          startDate={startDate} endDate={endDate}
          onStartChange={setStartDate} onEndChange={setEndDate}
        />
      </div>

      {data?.partner && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{data.partner.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            사업자번호: {data.partner.businessNumber}
            {data.partner.representative && ` | 대표: ${data.partner.representative}`}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일자</TableHead>
                  <TableHead>전표번호</TableHead>
                  <TableHead>계정과목</TableHead>
                  <TableHead>적요</TableHead>
                  <TableHead className="text-right text-blue-600">차변</TableHead>
                  <TableHead className="text-right text-red-600">대변</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.entryId}>
                    <TableCell>{formatDate(e.journalDate)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link href={`/journals/${e.journalId}`} className="hover:underline text-primary">
                        {e.journalNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{e.accountCode} {e.accountName}</TableCell>
                    <TableCell>{e.journalDescription}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">
                      {e.debitAmount > 0 ? formatAmount(e.debitAmount) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {e.creditAmount > 0 ? formatAmount(e.creditAmount) : ""}
                    </TableCell>
                    <TableCell>
                      <Link href={`/journals/${e.journalId}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {data.entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      해당 기간 거래내역이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data.entries.length > 0 && (
            <div className="flex gap-6 text-sm p-3 bg-muted/50 rounded-lg">
              <span>차변 합계: <span className="font-mono font-bold text-blue-600">{formatAmount(totalDebit)}</span></span>
              <span>대변 합계: <span className="font-mono font-bold text-red-600">{formatAmount(totalCredit)}</span></span>
            </div>
          )}
        </>
      )}

      {!partnerId && (
        <p className="text-muted-foreground text-center py-8">거래처를 선택해주세요.</p>
      )}
    </div>
  );
}
