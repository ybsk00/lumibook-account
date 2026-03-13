/** 금액을 천단위 콤마 포맷 (원 단위 정수) */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

/** 금액 표시 (음수는 괄호) */
export function formatAmountWithSign(amount: number): string {
  if (amount < 0) {
    return `(${formatAmount(Math.abs(amount))})`;
  }
  return formatAmount(amount);
}

/** 문자열에서 콤마 제거 후 숫자 반환 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9-]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

/** 사업자등록번호 포맷 (000-00-00000) */
export function formatBusinessNumber(num: string): string {
  const cleaned = num.replace(/[^0-9]/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
}

/** 날짜 포맷 (YYYY-MM-DD → YYYY.MM.DD) */
export function formatDate(date: string): string {
  return date.replace(/-/g, ".");
}
