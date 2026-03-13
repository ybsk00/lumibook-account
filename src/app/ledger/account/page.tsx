"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { AccountCombobox } from "@/components/common/AccountCombobox";
import { formatAmount, formatDate } from "@/lib/format";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function AccountLedgerPage() {
  const year = new Date().getFullYear();
  const [accountId, setAccountId] = useState<Id<"accounts"> | null>(null);
  const [startDate, setStartDate] = useState(`${year}-01-01`);
  const [endDate, setEndDate] = useState(`${year}-12-31`);

  const data = useQuery(
    api.ledger.getAccountLedger,
    accountId ? { accountId, startDate, endDate, fiscalYear: year } : "skip"
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">계정별원장</h1>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="w-[280px]">
          <AccountCombobox
            value={accountId}
            onChange={(id) => setAccountId(id)}
          />
        </div>
        <DateRangePicker
          startDate={startDate} endDate={endDate}
          onStartChange={setStartDate} onEndChange={setEndDate}
        />
      </div>

      {data?.account && (
        <div className="text-lg font-medium">
          {data.account.code} {data.account.name}
          <span className="text-sm text-muted-foreground ml-2">
            ({data.account.category} / {data.account.subCategory})
          </span>
        </div>
      )}

      {data && (
        <>
          <div className="text-sm text-muted-foreground">
            기초잔액: <span className="font-mono font-medium">{formatAmount(data.opening)}</span>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일자</TableHead>
                  <TableHead>전표번호</TableHead>
                  <TableHead>적요</TableHead>
                  <TableHead className="text-right text-blue-600">차변</TableHead>
                  <TableHead className="text-right text-red-600">대변</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.entryId}>
                    <TableCell>{formatDate(e.journalDate)}</TableCell>
                    <TableCell className="font-mono text-sm">{e.journalNumber}</TableCell>
                    <TableCell>{e.journalDescription}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">
                      {e.debitAmount > 0 ? formatAmount(e.debitAmount) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {e.creditAmount > 0 ? formatAmount(e.creditAmount) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatAmount(e.balance)}
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
        </>
      )}

      {!accountId && (
        <p className="text-muted-foreground text-center py-8">
          계정과목을 선택해주세요.
        </p>
      )}
    </div>
  );
}
