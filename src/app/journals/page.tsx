"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { useCurrentFiscalYear } from "@/hooks/useCurrentFiscalYear";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { formatAmount, formatDate } from "@/lib/format";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "임시", variant: "secondary" },
  confirmed: { label: "승인", variant: "default" },
  cancelled: { label: "취소", variant: "destructive" },
};

export default function JournalsPage() {
  const { startDate: fyStart, endDate: fyEnd } = useCurrentFiscalYear();
  const [startDate, setStartDate] = useState(fyStart);
  const [endDate, setEndDate] = useState(fyEnd);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const userId = useUserId();

  // 회계연도 로드 후 날짜 갱신
  useEffect(() => {
    setStartDate(fyStart);
    setEndDate(fyEnd);
  }, [fyStart, fyEnd]);

  const journals = useQuery(api.journals.list, userId ? {
    userId,
    startDate,
    endDate,
    status: statusFilter || undefined,
  } : "skip");

  const filtered = (journals ?? []).filter(
    (j) =>
      !search ||
      j.journalNumber.includes(search) ||
      j.description.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">전표 목록</h1>
        <Link href="/journals/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> 전표 입력
          </Button>
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex items-end gap-4 flex-wrap">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        <div className="flex gap-1">
          {["", "draft", "confirmed", "cancelled"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "" ? "전체" : STATUS_MAP[s]?.label}
            </Button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="전표번호/적요 검색..."
          className="w-[200px]"
        />
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>전표번호</TableHead>
              <TableHead>일자</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>적요</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((j) => {
              const status = STATUS_MAP[j.status] ?? STATUS_MAP.draft;
              return (
                <TableRow key={j._id}>
                  <TableCell className="font-mono text-sm">{j.journalNumber}</TableCell>
                  <TableCell>{formatDate(j.journalDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{j.journalType}</Badge>
                  </TableCell>
                  <TableCell>{j.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatAmount(j.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/journals/${j._id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {journals === undefined ? "로딩 중..." : "등록된 전표가 없습니다."}
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">총 {filtered.length}건</p>
    </div>
  );
}
