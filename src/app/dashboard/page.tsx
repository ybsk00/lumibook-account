"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react";

export default function DashboardPage() {
  const settings = useQuery(api.settings.get);

  const metrics = [
    {
      title: "당기 매출액",
      value: 0,
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "당기 비용",
      value: 0,
      icon: TrendingDown,
      color: "text-foreground",
    },
    {
      title: "당기순이익",
      value: 0,
      icon: DollarSign,
      color: "text-blue-600",
    },
    {
      title: "미처리 전표",
      value: 0,
      icon: FileText,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">대시보드</h1>

      {/* 메트릭 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.title}
              </CardTitle>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${m.color}`}>
                {m.title === "미처리 전표"
                  ? `${m.value}건`
                  : `${formatAmount(m.value)}원`}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 전표 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 전표</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              등록된 전표가 없습니다. 전표 입력을 시작하세요.
            </p>
          </CardContent>
        </Card>

        {/* 결산 체크리스트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              결산 체크리스트 ({settings?.currentFiscalYear ?? 2025})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">○</span> 전표 입력 완료
              </li>
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">○</span> 세금계산서 대사 완료
              </li>
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">○</span> 감가상각비 계상
              </li>
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">○</span> 법인세 추산
              </li>
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">○</span> 재무제표 확정
              </li>
              <li className="flex items-center gap-2">
                <span className="text-muted-foreground">○</span> 홈택스 제출
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
