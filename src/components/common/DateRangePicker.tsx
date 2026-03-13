"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="space-y-1">
        <Label className="text-xs">시작일</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="w-[150px]"
        />
      </div>
      <span className="mt-5 text-muted-foreground">~</span>
      <div className="space-y-1">
        <Label className="text-xs">종료일</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="w-[150px]"
        />
      </div>
    </div>
  );
}
