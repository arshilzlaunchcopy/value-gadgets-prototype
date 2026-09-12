/**
 * Bangladesh phone normalisation. Accepts 01712345678, 8801712345678,
 * +8801712345678, with spaces/dashes. Steadfast wants the local 11-digit form;
 * Supabase Auth and customers.phone use E.164.
 */
export function normalizeBD(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local: string;
  if (digits.length === 11 && digits.startsWith("01")) local = digits;
  else if (digits.length === 13 && digits.startsWith("8801")) local = digits.slice(2);
  else if (digits.length === 14 && digits.startsWith("08801")) local = digits.slice(3);
  else return null;
  // Operators: 013-019
  if (!/^01[3-9]\d{8}$/.test(local)) return null;
  return local;
}

export function toE164BD(input: string): string | null {
  const local = normalizeBD(input);
  return local ? `+88${local}` : null;
}

export function isValidBDPhone(input: string): boolean {
  return normalizeBD(input) !== null;
}

/** +8801712345678 -> 017 1234 5678 */
export function formatBDPhone(input: string): string {
  const local = normalizeBD(input);
  if (!local) return input;
  return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
}
