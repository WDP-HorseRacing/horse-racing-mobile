import type { FeedingPlanLineInput, FeedingMealName } from "@/services/stable-care.service";

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isDateRangeWithin(from: string, to: string, maximumInclusiveDays: number): boolean {
  if (
    !isDateOnly(from) ||
    !isDateOnly(to) ||
    from > to ||
    !Number.isInteger(maximumInclusiveDays) ||
    maximumInclusiveDays < 1
  )
    return false;
  const difference = Math.round(
    (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000,
  );
  return difference + 1 <= maximumInclusiveDays;
}

export function isValidCareTaskRange(from: string, to: string, today: string): boolean {
  return isDateOnly(today) && isDateRangeWithin(from, to, 366) && from >= today;
}

export function isValidChecklistRange(from: string, to: string): boolean {
  return isDateRangeWithin(from, to, 31);
}

export function hasFeedingMealDuplicate(
  lines: FeedingPlanLineInput[],
  meal: FeedingMealName,
  supplyItemId: string,
): boolean {
  return lines.some((line) => line.meal === meal && line.supplyItemId === supplyItemId);
}
