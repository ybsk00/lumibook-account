"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserId } from "@/hooks/useUserId";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

const CATEGORIES = ["전체", "자산", "부채", "자본", "수익", "비용"];

export default function AccountsPage() {
  const userId = useUserId();
  const accounts = useQuery(api.accounts.list, userId ? { userId } : "skip");
  const createAccount = useMutation(api.accounts.create);
  const toggleActive = useMutation(api.accounts.toggleActive);
  const seedAccounts = useMutation(api.seed.seedAccounts);

  const [filter, setFilter] = useState("전체");
  const [open, setOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    code: "",
    name: "",
    category: "자산",
    subCategory: "",
    accountType: "debit",
  });

  const filtered =
    accounts?.filter((a) => filter === "전체" || a.category === filter) ?? [];
  const sorted = [...filtered].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreate = async () => {
    if (!userId) return;
    await createAccount({
      userId,
      ...newAccount,
      sortOrder: (accounts?.length ?? 0) + 1,
    });
    setOpen(false);
    setNewAccount({ code: "", name: "", category: "자산", subCategory: "", accountType: "debit" });
  };

  const handleSeed = async () => {
    if (!userId) return;
    const result = await seedAccounts({ userId });
    alert(result.message);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">계정과목 관리</h1>
        <div className="flex gap-2">
          {(!accounts || accounts.length === 0) && (
            <Button variant="outline" onClick={handleSeed}>
              기본 계정과목 생성
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="h-4 w-4 mr-1" /> 추가
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>계정과목 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>계정코드</Label>
                    <Input
                      value={newAccount.code}
                      onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                      placeholder="101"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>계정명</Label>
                    <Input
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      placeholder="현금"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>분류</Label>
                    <Select
                      value={newAccount.category}
                      onValueChange={(v) => setNewAccount({ ...newAccount, category: v ?? "자산" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["자산", "부채", "자본", "수익", "비용"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>세분류</Label>
                    <Input
                      value={newAccount.subCategory}
                      onChange={(e) => setNewAccount({ ...newAccount, subCategory: e.target.value })}
                      placeholder="유동자산"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>성격</Label>
                  <Select
                    value={newAccount.accountType}
                    onValueChange={(v) => setNewAccount({ ...newAccount, accountType: v ?? "debit" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">차변 (debit)</SelectItem>
                      <SelectItem value="credit">대변 (credit)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} className="w-full">추가</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            variant={filter === c ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">코드</TableHead>
              <TableHead>계정명</TableHead>
              <TableHead>분류</TableHead>
              <TableHead>세분류</TableHead>
              <TableHead className="w-16">성격</TableHead>
              <TableHead className="w-16">상태</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((acc) => (
              <TableRow key={acc._id}>
                <TableCell className="font-mono">{acc.code}</TableCell>
                <TableCell>{acc.name}</TableCell>
                <TableCell>{acc.category}</TableCell>
                <TableCell className="text-muted-foreground">{acc.subCategory}</TableCell>
                <TableCell>
                  <Badge variant={acc.accountType === "debit" ? "default" : "secondary"}>
                    {acc.accountType === "debit" ? "차" : "대"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={acc.isActive ? "default" : "outline"}>
                    {acc.isActive ? "활성" : "비활성"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive({ id: acc._id })}
                  >
                    {acc.isActive ? "비활성" : "활성"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">총 {sorted.length}개 계정과목</p>
    </div>
  );
}
