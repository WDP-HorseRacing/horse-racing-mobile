export type ParticipantWindowAction = "check-in" | "ready";
export const MAX_TRIAL_TIME_MS = 3_600_000;

export function clubDateTimeToIso(dateValue: string, timeValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  const dateOnly = new Date(`${dateValue}T00:00:00Z`);
  if (
    dateOnly.getUTCFullYear() !== year ||
    dateOnly.getUTCMonth() + 1 !== month ||
    dateOnly.getUTCDate() !== day
  )
    return null;
  const date = new Date(`${dateValue}T${timeValue}:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function addDaysToClubDate(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isParticipantWindowOpen(
  startsAt: string,
  endsAt: string,
  action: ParticipantWindowAction,
  now = Date.now(),
): boolean {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  const opensAt = start - (action === "check-in" ? 30 : 15) * 60_000;
  return now >= opensAt && now <= end;
}

export function classWeekNumber(classStart: string, dateValue: string): number | null {
  const [sy, sm, sd] = classStart.split("-").map(Number);
  const [dy, dm, dd] = dateValue.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const day = Date.UTC(dy, dm - 1, dd);
  if (![start, day].every(Number.isFinite) || day < start) return null;
  return Math.floor((day - start) / (7 * 86_400_000)) + 1;
}

export function parseTrialDurationMs(value: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)(?:\.(\d))?$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const tenths = Number(match[3] ?? "0");
  const total = (minutes * 60 + seconds) * 1000 + tenths * 100;
  return total > 0 && total <= MAX_TRIAL_TIME_MS ? total : null;
}

export function defaultClubDateTime(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "00";
  let date = `${part("year")}-${part("month")}-${part("day")}`;
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));
  const roundedMinute = Math.ceil((minute + 1) / 60) * 60;
  let totalMinutes = hour * 60 + roundedMinute;
  if (totalMinutes >= 24 * 60) {
    date = addDaysToClubDate(date, 1);
    totalMinutes = 0;
  }
  return {
    date,
    time: `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`,
  };
}

export function clubDateTimeParts(value: string): { date: string; time: string } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "00";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function formatTrainingStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const upper = status.trim().toUpperCase();
  const map: Record<string, string> = {
    SCHEDULED: "Đã lên lịch",
    PLANNED: "Lên kế hoạch",
    PRESENT: "Có mặt",
    READY: "Sẵn sàng",
    ONGOING: "Đang tập",
    IN_PROGRESS: "Đang diễn ra",
    COMPLETED: "Đã hoàn thành",
    STOPPED: "Đã dừng sớm",
    ABSENT: "Vắng mặt",
    SKIPPED: "Bỏ qua",
    CANCELLED: "Đã hủy",
    CANCELLED_BY_LOCK: "Hủy do khóa",
    INELIGIBLE: "Không đủ điều kiện",
    ACTIVE: "Đang hoạt động",
    DRAFT: "Bản nháp",
  };
  return map[upper] ?? status.replaceAll("_", " ");
}
