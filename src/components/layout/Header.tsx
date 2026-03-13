"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function Header() {
  const { data: session } = useSession();
  const settings = useQuery(api.settings.get);

  const fiscalYear = settings?.currentFiscalYear ?? 2025;
  const period = `제 ${fiscalYear - 2022}기 ${fiscalYear}.01.01 ~ ${fiscalYear}.12.31`;

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
