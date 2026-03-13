"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { formatBusinessNumber } from "@/lib/format";

export default function PartnersPage() {
  const partners = useQuery(api.partners.list, {});
  const createPartner = useMutation(api.partners.create);
  const toggleActive = useMutation(api.partners.toggleActive);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    businessNumber: "",
    representative: "",
    businessType: "",
    businessItem: "",
    address: "",
    phone: "",
    email: "",
    partnerType: "vendor" as string,
  });

  const handleCreate = async () => {
    await createPartner({
      name: form.name,
      businessNumber: form.businessNumber,
      representative: form.representative || undefined,
      businessType: form.businessType || undefined,
      businessItem: form.businessItem || undefined,
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      partnerType: form.partnerType,
    });
    setOpen(false);
    setForm({
      name: "", businessNumber: "", representative: "", businessType: "",
      businessItem: "", address: "", phone: "", email: "", partnerType: "vendor",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">거래처 관리</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" /> 거래처 추가
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>거래처 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>상호명</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="캐스팅엔"
                  />
                </div>
                <div className="space-y-1">
                  <Label>사업자등록번호</Label>
                  <Input
                    value={form.businessNumber}
                    onChange={(e) =>
                      setForm({ ...form, businessNumber: formatBusinessNumber(e.target.value) })
                    }
                    placeholder="000-00-00000"
                    maxLength={12}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>대표자</Label>
                  <Input
                    value={form.representative}
                    onChange={(e) => setForm({ ...form, representative: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>거래유형</Label>
                  <Select
                    value={form.partnerType}
                    onValueChange={(v) => setForm({ ...form, partnerType: v ?? "vendor" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">매출처</SelectItem>
                      <SelectItem value="vendor">매입처</SelectItem>
                      <SelectItem value="both">매출/매입</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>업태</Label>
                  <Input
                    value={form.businessType}
                    onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>종목</Label>
                  <Input
                    value={form.businessItem}
                    onChange={(e) => setForm({ ...form, businessItem: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>주소</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>전화번호</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>이메일</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">등록</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상호명</TableHead>
              <TableHead>사업자등록번호</TableHead>
              <TableHead>대표자</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(partners ?? []).map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono">{p.businessNumber}</TableCell>
                <TableCell>{p.representative}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {p.partnerType === "customer" ? "매출처" : p.partnerType === "vendor" ? "매입처" : "매출/매입"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "default" : "outline"}>
                    {p.isActive ? "활성" : "비활성"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive({ id: p._id })}
                  >
                    {p.isActive ? "비활성" : "활성"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!partners || partners.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  등록된 거래처가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
