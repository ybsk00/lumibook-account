"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/format";
import {
  BS_ASSET_MAPPING,
  BS_LIABILITY_MAPPING,
  BS_EQUITY_MAPPING,
  IS_MAPPING,
  sumByField,
  type HometaxField,
} from "@/lib/hometaxMapping";
import { Copy, Printer } from "lucide-react";

export default function ExportPage() {
  const year = new Date().getFullYear();
  const balances = useQuery(api.hometax.getHometaxData, {
    fiscalYear: year,
    endDate: `${year}-12-31`,
  });
  const settings = useQuery(api.settings.get);

  if (!balances) return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;

  const companyName = settings?.companyName ?? "주식회사 루미브리즈";

  // 대차대조표 계산
  const bsAssets = BS_ASSET_MAPPING.map((f) => ({
    ...f,
    amount: sumByField(f, balances),
  }));
  // 유동자산 소계 (field 11)
  const currentAssetsTotal = bsAssets.filter((f) => f.field >= 1 && f.field <= 10).reduce((s, f) => s + f.amount, 0);
  const nonCurrentAssetsTotal = bsAssets.filter((f) => f.field >= 20 && f.field <= 27).reduce((s, f) => s + f.amount, 0);
  const totalAssets = currentAssetsTotal + nonCurrentAssetsTotal;

  const bsLiab = BS_LIABILITY_MAPPING.map((f) => ({ ...f, amount: sumByField(f, balances) }));
  const currentLiabTotal = bsLiab.filter((f) => f.field >= 31 && f.field <= 39).reduce((s, f) => s + f.amount, 0);
  const nonCurrentLiabTotal = bsLiab.filter((f) => f.field >= 45 && f.field <= 46).reduce((s, f) => s + f.amount, 0);
  const totalLiab = currentLiabTotal + nonCurrentLiabTotal;

  const bsEquity = BS_EQUITY_MAPPING.map((f) => ({ ...f, amount: sumByField(f, balances) }));
  const equityTotal = bsEquity.filter((f) => f.field >= 51 && f.field <= 54).reduce((s, f) => s + f.amount, 0);

  // 손익계산서 계산
  const isRows = IS_MAPPING.map((f) => ({ ...f, amount: sumByField(f, balances) }));
  const revenue = isRows.find((f) => f.field === 1)?.amount ?? 0;
  const cogs = isRows.find((f) => f.field === 2)?.amount ?? 0;
  const grossProfit = revenue - cogs;
  const sgaItems = isRows.filter((f) => f.field >= 4 && f.field <= 14);
  const sgaTotal = sgaItems.reduce((s, f) => s + f.amount, 0);
  const opIncome = grossProfit - sgaTotal;
  const otherRev = isRows.find((f) => f.field === 17)?.amount ?? 0;
  const otherExp = isRows.find((f) => f.field === 18)?.amount ?? 0;
  const preTax = opIncome + otherRev - otherExp;
  const tax = isRows.find((f) => f.field === 20)?.amount ?? 0;
  const netIncome = preTax - tax;

  const handleCopy = (rows: { field: number; label: string; amount: number }[]) => {
    const text = rows.map((r) => `${r.field}\t${r.label}\t${r.amount}`).join("\n");
    navigator.clipboard.writeText(text);
    alert("클립보드에 복사되었습니다.");
  };

  const HometaxTable = ({
    rows,
    computedRows,
  }: {
    rows: (HometaxField & { amount: number })[];
    computedRows: { field: number; label: string; amount: number }[];
  }) => {
    const allRows = [
      ...rows.filter((r) => !r.computed).map((r) => ({ field: r.field, label: r.label, amount: r.amount, isComputed: false })),
      ...computedRows.map((r) => ({ ...r, isComputed: true })),
    ].sort((a, b) => a.field - b.field);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">(칸)</TableHead>
            <TableHead>과목명</TableHead>
            <TableHead className="text-right">금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allRows.map((r) => (
            <TableRow key={r.field} className={r.isComputed ? "bg-muted/50 font-medium" : ""}>
              <TableCell className="font-mono text-muted-foreground">({r.field})</TableCell>
              <TableCell>{r.label}</TableCell>
              <TableCell className="text-right font-mono">{formatAmount(r.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">홈택스 출력</h1>
      <p className="text-sm text-muted-foreground">
        * (칸) 번호는 홈택스 입력 칸 번호와 동일합니다
      </p>

      <div className="text-center text-sm">
        <div className="font-medium">{companyName}</div>
        <div className="text-muted-foreground">제 {year - 2022}기 {year}년 (단위: 원)</div>
      </div>

      <Tabs defaultValue="bs">
        <TabsList>
          <TabsTrigger value="bs">표준대차대조표</TabsTrigger>
          <TabsTrigger value="is">표준손익계산서</TabsTrigger>
        </TabsList>

        <TabsContent value="bs" className="space-y-3">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> 인쇄
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleCopy([
              ...bsAssets.filter((f) => !f.computed).map((f) => ({ field: f.field, label: f.label, amount: f.amount })),
              { field: 11, label: "유동자산 소계", amount: currentAssetsTotal },
              { field: 28, label: "비유동자산 소계", amount: nonCurrentAssetsTotal },
              { field: 29, label: "자산총계", amount: totalAssets },
            ])}>
              <Copy className="h-4 w-4 mr-1" /> 복사
            </Button>
          </div>

          <div className="border rounded-lg">
            <h3 className="p-3 font-medium border-b">자산의 부</h3>
            <HometaxTable
              rows={bsAssets}
              computedRows={[
                { field: 11, label: "유동자산 소계", amount: currentAssetsTotal },
                { field: 28, label: "비유동자산 소계", amount: nonCurrentAssetsTotal },
                { field: 29, label: "자산총계", amount: totalAssets },
              ]}
            />
          </div>

          <div className="border rounded-lg">
            <h3 className="p-3 font-medium border-b">부채의 부</h3>
            <HometaxTable
              rows={bsLiab}
              computedRows={[
                { field: 40, label: "유동부채 소계", amount: currentLiabTotal },
                { field: 47, label: "비유동부채 소계", amount: nonCurrentLiabTotal },
                { field: 48, label: "부채총계", amount: totalLiab },
              ]}
            />
          </div>

          <div className="border rounded-lg">
            <h3 className="p-3 font-medium border-b">자본의 부</h3>
            <HometaxTable
              rows={bsEquity}
              computedRows={[
                { field: 55, label: "자본총계", amount: equityTotal + netIncome },
                { field: 56, label: "부채와자본총계", amount: totalLiab + equityTotal + netIncome },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="is" className="space-y-3">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> 인쇄
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleCopy([
              ...isRows.filter((f) => !f.computed),
              { field: 3, label: "매출총이익", amount: grossProfit },
              { field: 15, label: "판관비 소계", amount: sgaTotal },
              { field: 16, label: "영업이익", amount: opIncome },
              { field: 19, label: "법인세비용차감전순이익", amount: preTax },
              { field: 21, label: "당기순이익", amount: netIncome },
            ])}>
              <Copy className="h-4 w-4 mr-1" /> 복사
            </Button>
          </div>

          <div className="border rounded-lg">
            <HometaxTable
              rows={isRows}
              computedRows={[
                { field: 3, label: "매출총이익", amount: grossProfit },
                { field: 15, label: "판관비 소계", amount: sgaTotal },
                { field: 16, label: "영업이익", amount: opIncome },
                { field: 19, label: "법인세비용차감전순이익", amount: preTax },
                { field: 21, label: "당기순이익", amount: netIncome },
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
