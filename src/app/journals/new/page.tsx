"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleEntryForm } from "@/components/journal/SimpleEntryForm";
import { ManualEntryForm } from "@/components/journal/ManualEntryForm";
import { Sparkles, PenLine } from "lucide-react";

export default function NewJournalPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">전표 입력</h1>

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4 mr-1" />
            AI 간편 입력
          </TabsTrigger>
          <TabsTrigger value="manual">
            <PenLine className="h-4 w-4 mr-1" />
            수동 입력
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <SimpleEntryForm />
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <ManualEntryForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
