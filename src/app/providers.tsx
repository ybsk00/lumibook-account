"use client";

import { SessionProvider } from "next-auth/react";
import { ConvexClientProvider } from "@/lib/convex";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConvexClientProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ConvexClientProvider>
    </SessionProvider>
  );
}
