"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  FileText,
  BookOpen,
  BarChart3,
  Receipt,
  FileOutput,
  Settings,
  LogOut,
  PenLine,
  List,
  BookMarked,
  User2,
  Building2,
  ClipboardList,
  Calculator,
  Upload,
} from "lucide-react";

const menuGroups = [
  {
    label: "전표관리",
    items: [
      { href: "/journals/new", label: "전표 입력", icon: PenLine },
      { href: "/journals/upload", label: "통장 업로드", icon: Upload },
      { href: "/journals", label: "전표 목록", icon: List },
    ],
  },
  {
    label: "장부조회",
    items: [
      { href: "/ledger/general", label: "총계정원장", icon: BookOpen },
      { href: "/ledger/account", label: "계정별원장", icon: BookMarked },
      { href: "/ledger/partner", label: "거래처별원장", icon: User2 },
    ],
  },
  {
    label: "재무제표",
    items: [
      { href: "/statements/balance-sheet", label: "재무상태표", icon: BarChart3 },
      { href: "/statements/income", label: "손익계산서", icon: FileText },
      { href: "/statements/trial-balance", label: "합계잔액시산표", icon: ClipboardList },
    ],
  },
  {
    label: "부가세",
    items: [
      { href: "/vat/invoices", label: "세금계산서", icon: Receipt },
      { href: "/vat/invoices/upload", label: "계산서 업로드", icon: Upload },
      { href: "/vat", label: "부가세 신고", icon: Calculator },
    ],
  },
  {
    label: "홈택스 출력",
    items: [
      { href: "/export", label: "홈택스 출력", icon: FileOutput },
    ],
  },
  {
    label: "설정",
    items: [
      { href: "/settings/company", label: "회사정보", icon: Building2 },
      { href: "/settings/accounts", label: "계정과목", icon: BookOpen },
      { href: "/settings/partners", label: "거래처", icon: User2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[200px] h-screen border-r bg-sidebar flex flex-col fixed left-0 top-0 z-30">
      <div className="p-4 border-b">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          LumiBooks
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {menuGroups.map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/journals" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 text-[13px] transition-colors hover:bg-accent",
                    isActive && "bg-accent text-primary border-r-2 border-primary font-medium"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground w-full px-1"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
