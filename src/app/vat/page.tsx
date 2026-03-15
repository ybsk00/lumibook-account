"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { useCurrentFiscalYear } from "@/hooks/useCurrentFiscalYear";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/format";

const DEFAULT_PERIODS = [
  { periodType: "1기예정", startDate: "-01-01", endDate: "-03-31" },
  { periodType: "1기확정", startDate: "-01-01", endDate: "-06-30" },
  { periodType: "2기예정", startDate: "-07-01", endDate: "-09-30" },
  { periodType: "2기확정", startDate: "-07-01", endDate: "-12-31" },
];

export default function VatPage() {
  const userId = useUserId();
  const { fiscalYear: year } = useCurrentFiscalYear();
  const periods = useQuery(api.vatPeriods.list, userId ? { userId, fiscalYear: year } : "skip");
  const createPeriod = useMutation(api.vatPeriods.create);
  const recalculate = useMutation(api.vatPeriods.recalculate);

  const handleCreatePeriods = async () => {
    if (!userId) return;
    for (const p of DEFAULT_PERIODS) {
      await createPeriod({
        userId,
        periodType: p.periodType,
        startDate: `${year}${p.startDate}`,
        endDate: `${year}${p.endDate}`,
        fiscalYear: year,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">부가세 신고 ({year}년)</h1>
        {(!periods || periods.length === 0) && (
          <Button onClick={handleCreatePeriods}>기간 생성</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(periods ?? []).map((p) => (
          <Card key={p._id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{p.periodType}</CardTitle>
                <Badge variant={p.status === "filed" ? "default" : "secondary"}>
                  {p.status === "open" ? "미신고" : p.status === "closed" ? "마감" : "신고완료"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {p.startDate} ~ {p.endDate}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">과세 매출:</span>
                  <span className="ml-2 font-mono">{formatAmount(p.salesTaxable)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">과세 매입:</span>
                  <span className="ml-2 font-mono">{formatAmount(p.purchaseTaxable)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">매출세액:</span>
                  <span className="ml-2 font-mono">{formatAmount(p.outputTax)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">매입세액:</span>
                  <span className="ml-2 font-mono">{formatAmount(p.inputTax)}</span>
                </div>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium">
                  {p.taxPayable >= 0 ? "납부세액" : "환급세액"}:
                  <span className={`ml-2 font-mono ${p.taxPayable < 0 ? "text-blue-600" : ""}`}>
                    {formatAmount(Math.abs(p.taxPayable))}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => recalculate({ id: p._id })}>
                  재집계
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {periods && periods.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          부가세 기간을 생성해주세요.
        </p>
      )}
    </div>
  );
}
