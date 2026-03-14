"use client";

import { BankUploadForm } from "@/components/journal/BankUploadForm";

export default function BankUploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">통장 거래내역 업로드</h1>
      <BankUploadForm />
    </div>
  );
}
