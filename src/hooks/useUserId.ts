import { useSession } from "next-auth/react";
import type { Id } from "../../convex/_generated/dataModel";

export function useUserId(): Id<"users"> | null {
  const { data: session } = useSession();
  const userId = (session?.user as Record<string, unknown> | undefined)?.userId;
  return (userId as Id<"users">) ?? null;
}

export function useCompanyName(): string {
  const { data: session } = useSession();
  const companyName = (session?.user as Record<string, unknown> | undefined)?.companyName;
  return (companyName as string) ?? "";
}
