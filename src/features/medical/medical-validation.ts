export const MEDICAL_HEALTH_STATUSES = [
  "ELIGIBLE",
  "UNDER_OBSERVATION",
  "INJURED",
  "QUARANTINED",
] as const;

export const MEDICAL_MEASUREMENT_TYPES = [
  "WEIGHT",
  "HEIGHT",
  "BODY_CONDITION",
  "TEMPERATURE",
] as const;

export const MEDICAL_MEASUREMENT_RANGES = {
  WEIGHT: { min: 30, max: 1500, normalMin: 400, normalMax: 600, unit: "kg" },
  HEIGHT: { min: 50, max: 250, normalMin: 150, normalMax: 175, unit: "cm" },
  BODY_CONDITION: { min: 1, max: 9, normalMin: 4, normalMax: 6, unit: "score" },
  TEMPERATURE: { min: 30, max: 45, normalMin: 37.2, normalMax: 38.3, unit: "°C" },
} as const;

export type MedicalMeasurementType = keyof typeof MEDICAL_MEASUREMENT_RANGES;

export const MEASUREMENT_LABELS: Record<MedicalMeasurementType, string> = {
  WEIGHT: "Cân nặng",
  HEIGHT: "Chiều cao",
  BODY_CONDITION: "Điểm thể trạng (BCS)",
  TEMPERATURE: "Thân nhiệt",
};

export function isValidMedicalMeasurement(type: MedicalMeasurementType, value: number): boolean {
  const range = MEDICAL_MEASUREMENT_RANGES[type];
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

export function isAbnormalMedicalMeasurement(type: MedicalMeasurementType, value: number): boolean {
  const range = MEDICAL_MEASUREMENT_RANGES[type];
  return Number.isFinite(value) && (value < range.normalMin || value > range.normalMax);
}

export function validateMeasurementField(
  type: MedicalMeasurementType,
  rawText: string,
  t: (text: string) => string = (x) => x,
): {
  isValid: boolean;
  isAbnormal: boolean;
  error?: string;
  warning?: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { isValid: true, isAbnormal: false };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return {
      isValid: false,
      isAbnormal: false,
      error: t("Giá trị phải là một số hợp lệ."),
    };
  }
  const spec = MEDICAL_MEASUREMENT_RANGES[type];
  const label = MEASUREMENT_LABELS[type];
  if (value < spec.min || value > spec.max) {
    return {
      isValid: false,
      isAbnormal: false,
      error: `${t(label)} ${t("phải trong khoảng")} ${spec.min} - ${spec.max} ${spec.unit}.`,
    };
  }
  if (value < spec.normalMin || value > spec.normalMax) {
    return {
      isValid: true,
      isAbnormal: true,
      warning: `⚠️ ${t("Ngoài khoảng bình thường")} (${spec.normalMin} - ${spec.normalMax} ${spec.unit}).`,
    };
  }
  return { isValid: true, isAbnormal: false };
}

export function clubDateTimeParts(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function toClubDateTime(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  if (!isValidDateOnly(date)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  const parsed = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function isAllowedVisitDateTime(value: string, now = Date.now()): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const age = now - date.getTime();
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

export function isNotPastDateTime(value: string, now = Date.now()): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() >= now;
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  const [year, month, day] = value.split("-").map(Number);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  );
}

export function parseNonNegativeInteger(value: string, max = 10_000_000_000): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= max ? number : null;
}

export function isValidRequiredText(value: string, maxLength: number): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
