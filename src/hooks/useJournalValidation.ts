import { useMemo } from "react";

interface EntryLine {
  debitAmount: number;
  creditAmount: number;
}

export function useJournalValidation(entries: EntryLine[]) {
  return useMemo(() => {
    const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);
    const diff = totalDebit - totalCredit;
    const valid = totalDebit === totalCredit && totalDebit > 0;

    return { totalDebit, totalCredit, diff, valid };
  }, [entries]);
}
