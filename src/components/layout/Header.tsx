"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserId, useCompanyName } from "@/hooks/useUserId";

export function Header() {
  const { data: session } = useSession();
  const companyName = useCompanyName();
  const userId = useUserId();
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  const fiscalYear = user?.currentFiscalYear ?? new Date().getFullYear();
  const fiscalStart = user?.fiscalYearStart ?? 1;
  // 회계연도 시작월에 따른 기간 표시
  const startDate = `${fiscalYear}.${String(fiscalStart).padStart(2, "0")}.01`;
  const endYear = fiscalStart === 1 ? fiscalYear : fiscalYear + 1;
  const endMonth = fiscalStart === 1 ? 12 : fiscalStart - 1;
  const endDay = new Date(endYear, endMonth, 0).getDate();
  const endDate = `${endYear}.${String(endMonth).padStart(2, "0")}.${String(endDay).padStart(2, "0")}`;
  const period = `제 ${fiscalYear - 2022}기 ${startDate} ~ ${endDate}`;

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-6">
      <div className="text-sm text-muted-foreground">{period}</div>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
          {session?.user?.name?.slice(0, 2) ?? "YB"}
        </div>
      </div>
    </header>
  );
}
