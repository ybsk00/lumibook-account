"use client";

import { Input } from "@/components/ui/input";
import { formatAmount, parseAmount } from "@/lib/format";
import { useCallback } from "react";

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AmountInput({
  value,
  onChange,
  placeholder = "0",
  className,
  disabled,
}: AmountInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const num = parseAmount(raw);
      onChange(num);
    },
    [onChange]
  );

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  return (
    <Input
      value={value ? formatAmount(value) : ""}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={`text-right font-mono ${className ?? ""}`}
      disabled={disabled}
    />
  );
}
