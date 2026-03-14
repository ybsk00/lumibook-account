"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserId } from "@/hooks/useUserId";
import type { Id } from "../../../convex/_generated/dataModel";

interface AccountComboboxProps {
  value: Id<"accounts"> | null;
  onChange: (id: Id<"accounts">, account: { code: string; name: string; category: string }) => void;
}

const CATEGORY_ORDER = ["자산", "부채", "자본", "수익", "비용"];

export function AccountCombobox({ value, onChange }: AccountComboboxProps) {
  const userId = useUserId();
  const accounts = useQuery(api.accounts.list, userId ? { userId, activeOnly: true } : "skip");
  const [open, setOpen] = useState(false);

  const selected = accounts?.find((a) => a._id === value);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: (accounts ?? [])
      .filter((a) => a.category === cat)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.items.length > 0);

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
        {selected ? `${selected.code} ${selected.name}` : "계정과목 선택..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="코드 또는 이름 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과 없음</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.category} heading={group.category}>
                {group.items.map((acc) => (
                  <CommandItem
                    key={acc._id}
                    value={`${acc.code} ${acc.name}`}
                    onSelect={() => {
                      onChange(acc._id, {
                        code: acc.code,
                        name: acc.name,
                        category: acc.category,
                      });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === acc._id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono mr-2 text-muted-foreground">
                      {acc.code}
                    </span>
                    {acc.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
