"use client";

import { TaxInvoiceUploadForm } from "@/components/vat/TaxInvoiceUploadForm";

export default function TaxInvoiceUploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">세금계산서 합계표 업로드</h1>
      <TaxInvoiceUploadForm />
    </div>
  );
}
