"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { useCurrentFiscalYear } from "@/hooks/useCurrentFiscalYear";
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
import { Copy, Printer, Download } from "lucide-react";

export default function ExportPage() {
  const userId = useUserId();
  const { fiscalYear: year, endDate: fyEnd, period: fyPeriod } = useCurrentFiscalYear();
  const balances = useQuery(api.hometax.getHometaxData, userId ? {
    userId,
    fiscalYear: year,
    endDate: fyEnd,
  } : "skip");
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  if (!balances) return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;

  const companyName = user?.companyName ?? "주식회사 루미브리즈";

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

  // SmartA CSV 다운로드
  const handleSmartACsv = () => {
    const b = balances;
    const lines: string[] = ["구분,항목,금액"];

    // 재무상태표 — 자산
    const bsItems: [string, string, number][] = [];
    if (b["101"]) bsItems.push(["재무상태표", "현금", b["101"]]);
    if (b["102"]) bsItems.push(["재무상태표", "보통예금", b["102"]]);
    if (b["103"]) bsItems.push(["재무상태표", "정기예금", b["103"]]);
    if (b["108"]) bsItems.push(["재무상태표", "외상매출금", b["108"]]);
    if (b["109"]) bsItems.push(["재무상태표", "받을어음", b["109"]]);
    if (b["110"]) bsItems.push(["재무상태표", "미수금", b["110"]]);
    if (b["111"]) bsItems.push(["재무상태표", "선급금", b["111"]]);
    if (b["112"]) bsItems.push(["재무상태표", "선급비용", b["112"]]);
    if (b["113"]) bsItems.push(["재무상태표", "부가세대급금", b["113"]]);
    if (b["114"] || b["115"]) bsItems.push(["재무상태표", "가지급금·단기대여금", (b["114"] ?? 0) + (b["115"] ?? 0)]);
    if (b["120"]) bsItems.push(["재무상태표", "재고자산", b["120"]]);
    if (b["151"]) bsItems.push(["재무상태표", "토지", b["151"]]);
    if (b["152"]) bsItems.push(["재무상태표", "건물", b["152"]]);
    if (b["153"]) bsItems.push(["재무상태표", "구축물", b["153"]]);
    if (b["154"]) bsItems.push(["재무상태표", "기계장치", b["154"]]);
    if (b["155"]) bsItems.push(["재무상태표", "차량운반구", b["155"]]);
    if (b["156"]) bsItems.push(["재무상태표", "비품", b["156"]]);
    if (b["157"]) bsItems.push(["재무상태표", "감가상각누계액", b["157"]]);
    if (b["160"] || b["161"]) bsItems.push(["재무상태표", "무형자산", (b["160"] ?? 0) + (b["161"] ?? 0)]);
    if (b["170"]) bsItems.push(["재무상태표", "투자자산", b["170"]]);
    if (b["172"]) bsItems.push(["재무상태표", "임차보증금", b["172"]]);
    bsItems.push(["재무상태표", "자산 합계", totalAssets]);

    // 재무상태표 — 부채
    if (b["201"]) bsItems.push(["재무상태표", "외상매입금", b["201"]]);
    if (b["202"]) bsItems.push(["재무상태표", "지급어음", b["202"]]);
    if (b["203"]) bsItems.push(["재무상태표", "미지급금", b["203"]]);
    if (b["204"]) bsItems.push(["재무상태표", "미지급비용", b["204"]]);
    if (b["205"]) bsItems.push(["재무상태표", "선수금", b["205"]]);
    if (b["206"]) bsItems.push(["재무상태표", "예수금", b["206"]]);
    if (b["207"]) bsItems.push(["재무상태표", "부가세예수금", b["207"]]);
    if (b["208"]) bsItems.push(["재무상태표", "단기차입금", b["208"]]);
    if (b["210"]) bsItems.push(["재무상태표", "미지급법인세", b["210"]]);
    if (b["251"]) bsItems.push(["재무상태표", "장기차입금", b["251"]]);
    if (b["253"]) bsItems.push(["재무상태표", "퇴직급여충당부채", b["253"]]);
    bsItems.push(["재무상태표", "부채 합계", totalLiab]);

    // 재무상태표 — 자본
    if (b["301"]) bsItems.push(["재무상태표", "자본금", b["301"]]);
    if (b["311"]) bsItems.push(["재무상태표", "자본잉여금", b["311"]]);
    if (b["321"] || b["322"]) bsItems.push(["재무상태표", "이익잉여금", (b["321"] ?? 0) + (b["322"] ?? 0)]);
    if (b["331"]) bsItems.push(["재무상태표", "자본조정", b["331"]]);
    bsItems.push(["재무상태표", "당기순이익(손실)", netIncome]);
    bsItems.push(["재무상태표", "자본 합계", equityTotal + netIncome]);

    for (const [section, label, amount] of bsItems) {
      if (amount !== 0 || label.includes("합계") || label.includes("당기순이익")) {
        lines.push(`${section},${label},${amount}`);
      }
    }

    lines.push("");

    // 손익계산서
    lines.push(`손익계산서,매출액,${revenue}`);
    const rev401 = b["401"] ?? 0;
    const rev402 = b["402"] ?? 0;
    const rev403 = b["403"] ?? 0;
    const rev404 = b["404"] ?? 0;
    if (rev401) lines.push(`손익계산서,  상품매출,${rev401}`);
    if (rev402) lines.push(`손익계산서,  제품매출,${rev402}`);
    if (rev403) lines.push(`손익계산서,  용역매출,${rev403}`);
    if (rev404) lines.push(`손익계산서,  기타매출,${rev404}`);
    lines.push(`손익계산서,매출원가,${cogs}`);
    lines.push(`손익계산서,매출총이익,${grossProfit}`);
    lines.push(`손익계산서,판관비,${sgaTotal}`);

    // 판관비 개별 항목
    const sgaMap: [string, string][] = [
      ["511", "급여"], ["512", "퇴직급여"], ["513", "복리후생비"],
      ["514", "여비교통비"], ["515", "통신비"], ["516", "수도광열비"],
      ["517", "세금과공과"], ["518", "임차료"], ["519", "감가상각비"],
      ["520", "보험료"], ["521", "수선비"], ["522", "접대비"],
      ["523", "광고선전비"], ["524", "소모품비"], ["525", "지급수수료"],
      ["526", "차량유지비"], ["527", "교육훈련비"], ["528", "도서인쇄비"],
      ["529", "회의비"], ["530", "사무용품비"], ["531", "외주용역비"],
    ];
    for (const [code, name] of sgaMap) {
      const val = b[code] ?? 0;
      if (val !== 0) lines.push(`손익계산서,  ${name},${val}`);
    }

    lines.push(`손익계산서,영업이익,${opIncome}`);
    lines.push(`손익계산서,영업외수익,${otherRev}`);
    lines.push(`손익계산서,영업외비용,${otherExp}`);
    if (tax) lines.push(`손익계산서,법인세비용,${tax}`);
    lines.push(`손익계산서,당기순이익,${netIncome}`);

    // BOM + CSV 다운로드
    const bom = "\uFEFF";
    const csvContent = bom + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SmartA_입력용_${companyName}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="text-muted-foreground">제 {fyPeriod}기 {year}년 (단위: 원)</div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSmartACsv} size="sm">
          <Download className="h-4 w-4 mr-1" /> SmartA 입력용 CSV 다운로드
        </Button>
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
