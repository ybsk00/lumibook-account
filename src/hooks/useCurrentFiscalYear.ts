"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUserId } from "./useUserId";

/**
 * DB에서 사용자의 회계연도 설정을 읽어오는 훅
 * - currentFiscalYear: 현재 회계연도 (예: 2025)
 * - fiscalYearStart: 회계연도 시작월 (예: 1)
 * - startDate / endDate: 회계연도 기간 문자열
 */
export function useCurrentFiscalYear() {
  const userId = useUserId();
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  const fiscalYear = user?.currentFiscalYear ?? new Date().getFullYear();
  const fiscalStart = user?.fiscalYearStart ?? 1;

  // 회계연도 시작/종료일 계산
  const startDate = `${fiscalYear}-${String(fiscalStart).padStart(2, "0")}-01`;
  const endYear = fiscalStart === 1 ? fiscalYear : fiscalYear + 1;
  const endMonth = fiscalStart === 1 ? 12 : fiscalStart - 1;
  const endDay = new Date(endYear, endMonth, 0).getDate();
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  // 기수 계산 (2023년이 1기 기준)
  const period = fiscalYear - 2022;

  return {
    fiscalYear,
    fiscalStart,
    startDate,
    endDate,
    period,
    isLoading: userId !== null && user === undefined,
  };
}
