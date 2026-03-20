"use client";

import { CreditCardUploadForm } from "@/components/vat/CreditCardUploadForm";

export default function CreditCardUploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">사업용신용카드 업로드</h1>
      <CreditCardUploadForm />
    </div>
  );
}
