export const CLUB_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Format milliseconds as mm:ss.t (for example, 74,500 -> 01:14.5). */
export function formatDurationMs(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";

  const tenths = Math.floor(milliseconds / 100);
  const wholeSeconds = Math.floor(tenths / 10);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  const tenth = tenths % 10;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenth}`;
}

export function formatWeight(value: number, locale = "en-US"): string {
  return `${formatNumber(value, locale)} kg`;
}

export function formatDistance(value: number, locale = "en-US"): string {
  return `${formatNumber(value, locale)} m`;
}

export function formatQuantity(
  value: number | null | undefined,
  unit = "",
  locale = "en-US",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const amount = formatNumber(value, locale);
  return unit ? `${amount} ${unit}` : amount;
}

export function formatCurrency(value: number, currency = "VND", locale = "vi-VN"): string {
  if (!Number.isFinite(value)) return "0 ₫";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatVnd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0 VND";
  return `${value.toLocaleString("vi-VN")} VND`;
}

export function formatDate(value: string | number | Date, locale = "vi-VN"): string {
  const date = asDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | number | Date, locale = "vi-VN"): string {
  const date = asDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatTime(value: string | number | Date, locale = "vi-VN"): string {
  const date = asDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: CLUB_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function asDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats an ALL CAPS or SNAKE_CASE string into clean sentence case with only the first letter capitalized.
 * Preserves common acronyms (VI, EN, ID, SLA, RBAC, VND, API).
 * e.g. "HEALTH_QUARANTINED" -> "Health quarantined"
 * e.g. "SPRINTER" -> "Sprinter"
 * e.g. "UNDER_OBSERVATION" -> "Under observation"
 */
export function formatEnum(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.replaceAll("_", " ").trim();
  if (!clean) return "—";
  if (
    clean === "VI" ||
    clean === "EN" ||
    clean === "ID" ||
    clean === "SLA" ||
    clean === "RBAC" ||
    clean === "VND" ||
    clean === "API"
  ) {
    return clean;
  }
  if (/^[A-Z0-9 ]+$/.test(clean) && clean.length > 1) {
    const lower = clean.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return clean;
}
