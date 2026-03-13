"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-[200px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
