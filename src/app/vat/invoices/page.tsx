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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AmountInput } from "@/components/common/AmountInput";
import { PartnerCombobox } from "@/components/common/PartnerCombobox";
import { formatAmount, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function TaxInvoicesPage() {
  const userId = useUserId();
  const salesInvoices = useQuery(api.taxInvoices.list, userId ? { userId, invoiceType: "sales" } : "skip");
  const purchaseInvoices = useQuery(api.taxInvoices.list, userId ? { userId, invoiceType: "purchase" } : "skip");
  const createInvoice = useMutation(api.taxInvoices.create);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    invoiceType: "sales" as string,
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    partnerId: null as Id<"partners"> | null,
    supplyAmount: 0,
    taxAmount: 0,
    taxType: "taxable" as string,
    description: "",
    isElectronic: true,
  });

  const handleSupplyChange = (amount: number) => {
    setForm({
      ...form,
      supplyAmount: amount,
      taxAmount: form.taxType === "taxable" ? Math.round(amount * 0.1) : 0,
    });
  };

  const handleCreate = async () => {
    if (!userId) return;
    if (!form.partnerId) { alert("거래처를 선택해주세요."); return; }
    await createInvoice({
      userId,
      ...form,
      partnerId: form.partnerId,
      totalAmount: form.supplyAmount + form.taxAmount,
      invoiceNumber: form.invoiceNumber || undefined,
      description: form.description || undefined,
    });
    setOpen(false);
  };

  const InvoiceTable = ({ invoices }: { invoices: typeof salesInvoices }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>일자</TableHead>
          <TableHead>승인번호</TableHead>
          <TableHead>거래처</TableHead>
          <TableHead className="text-right">공급가액</TableHead>
          <TableHead className="text-right">세액</TableHead>
          <TableHead className="text-right">합계</TableHead>
          <TableHead>구분</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(invoices ?? []).map((inv) => (
          <TableRow key={inv._id}>
            <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
            <TableCell className="font-mono text-sm">{inv.invoiceNumber ?? "-"}</TableCell>
            <TableCell>{inv.partnerName ?? inv.partnerId}</TableCell>
            <TableCell className="text-right font-mono">{formatAmount(inv.supplyAmount)}</TableCell>
            <TableCell className="text-right font-mono">{formatAmount(inv.taxAmount)}</TableCell>
            <TableCell className="text-right font-mono font-medium">{formatAmount(inv.totalAmount)}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {inv.taxType === "taxable" ? "과세" : inv.taxType === "zero_rated" ? "영세" : "면세"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
        {(!invoices || invoices.length === 0) && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              등록된 세금계산서가 없습니다.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">세금계산서</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-1" /> 등록
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>세금계산서 등록</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>매출/매입</Label>
                  <Select value={form.invoiceType} onValueChange={(v) => setForm({ ...form, invoiceType: v ?? "sales" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">매출</SelectItem>
                      <SelectItem value="purchase">매입</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>발행일</Label>
                  <Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>거래처</Label>
                <PartnerCombobox value={form.partnerId} onChange={(id) => setForm({ ...form, partnerId: id })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>공급가액</Label>
                  <AmountInput value={form.supplyAmount} onChange={handleSupplyChange} />
                </div>
                <div className="space-y-1">
                  <Label>세액</Label>
                  <AmountInput value={form.taxAmount} onChange={(v) => setForm({ ...form, taxAmount: v })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>과세유형</Label>
                  <Select value={form.taxType} onValueChange={(v) => setForm({ ...form, taxType: v ?? "taxable" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taxable">과세</SelectItem>
                      <SelectItem value="zero_rated">영세율</SelectItem>
                      <SelectItem value="exempt">면세</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>승인번호</Label>
                  <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>적요</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="text-right text-lg font-bold">
                합계: {formatAmount(form.supplyAmount + form.taxAmount)}원
              </div>
              <Button onClick={handleCreate} className="w-full">등록</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">매출 ({salesInvoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="purchase">매입 ({purchaseInvoices?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="sales"><div className="border rounded-lg"><InvoiceTable invoices={salesInvoices} /></div></TabsContent>
        <TabsContent value="purchase"><div className="border rounded-lg"><InvoiceTable invoices={purchaseInvoices} /></div></TabsContent>
      </Tabs>
    </div>
  );
}
