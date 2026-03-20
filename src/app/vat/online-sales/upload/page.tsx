"use client";

import { OnlineSalesUploadForm } from "@/components/vat/OnlineSalesUploadForm";

export default function OnlineSalesUploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">온라인매출 업로드</h1>
      <OnlineSalesUploadForm />
    </div>
  );
}
