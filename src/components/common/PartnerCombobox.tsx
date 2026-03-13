"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

interface PartnerComboboxProps {
  value: Id<"partners"> | null;
  onChange: (id: Id<"partners"> | null) => void;
}

export function PartnerCombobox({ value, onChange }: PartnerComboboxProps) {
  const partners = useQuery(api.partners.list, { activeOnly: true });
  const [open, setOpen] = useState(false);

  const selected = partners?.find((p) => p._id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-sm"
          />
        }
      >
        {selected ? selected.name : "거래처 선택 (선택사항)"}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="거래처 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과 없음</CommandEmpty>
            <CommandItem
              value="none"
              onSelect={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
              (선택 안함)
            </CommandItem>
            {(partners ?? []).map((p) => (
              <CommandItem
                key={p._id}
                value={p.name}
                onSelect={() => {
                  onChange(p._id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", value === p._id ? "opacity-100" : "opacity-0")}
                />
                {p.name}
                <span className="ml-auto text-xs text-muted-foreground">{p.businessNumber}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
