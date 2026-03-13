import { AppShell } from "@/components/layout/AppShell";

export default function VatLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
