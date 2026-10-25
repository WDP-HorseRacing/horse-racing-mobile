export type HorseIdentityCandidate = {
  id: string;
  gender: string | null;
  isDeleted: boolean;
  dateOfBirth: string | null;
  sireId?: string | null;
  damId?: string | null;
};

export type HorseIdentityInput = {
  name: string;
  breed: string;
  color: string;
  microchipId: string;
  dateOfBirth: string;
  gender: string;
  horseId?: string;
  sireId: string;
  damId: string;
  horses: HorseIdentityCandidate[];
};

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function clubDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function subtractYears(date: string, years: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetYear = year - years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, month - 1, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

export function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

/** Format YYYY-MM-DD to DD-MM-YYYY */
export function formatToDdMmYyyy(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const trimmed = isoDate.trim();
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
    return trimmed.replace(/\//g, "-");
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}-${mm}-${yyyy}`;
  }
  return trimmed;
}

/** Convert DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD to ISO YYYY-MM-DD */
export function parseToIsoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const padDd = dd.padStart(2, "0");
    const padMm = mm.padStart(2, "0");
    return `${yyyy}-${padMm}-${padDd}`;
  }
  return "";
}

export function isValidDdMmYyyyDate(value: string): boolean {
  const iso = parseToIsoDate(value);
  if (!iso) return false;
  return isValidIsoDate(iso);
}

export function validateHorseIdentity(input: HorseIdentityInput, today = clubDate()) {
  if (!input.name.trim()) return "Enter the horse name.";
  if (input.name.trim().length > 160) return "Horse name must be 160 characters or fewer.";
  if (input.microchipId.trim() && !/^\d{15}$/.test(input.microchipId.trim()))
    return "Microchip must contain exactly 15 digits.";
  if (input.breed.trim().length > 80) return "Breed must be 80 characters or fewer.";
  if (input.breed.trim() && !/^[\p{L}]+(?:[ '-][\p{L}]+)*$/u.test(input.breed.trim()))
    return "Breed may contain letters, spaces, apostrophes and hyphens only.";
  if (input.color.trim().length > 40) return "Color must be 40 characters or fewer.";
  if (input.color.trim() && !/^[\p{L}]+(?:[ '-][\p{L}]+)*$/u.test(input.color.trim()))
    return "Color may contain letters, spaces, apostrophes and hyphens only.";

  const rawDob = input.dateOfBirth.trim();
  const isoDob = parseToIsoDate(rawDob) || rawDob;
  if (rawDob && !isValidIsoDate(isoDob))
    return "Date of birth must be a valid date in YYYY-MM-DD format.";
  if (rawDob && isoDob > subtractYears(today, 1))
    return "Horse must be at least 1 year old.";
  if (rawDob && isoDob < subtractYears(today, 40))
    return "Horse cannot be older than 40 years.";

  const sire = input.horses.find((horse) => horse.id === input.sireId);
  const dam = input.horses.find((horse) => horse.id === input.damId);
  if (input.sireId && (!sire || !["MALE", "GELDING"].includes(sire.gender ?? "") || sire.isDeleted))
    return "Choose a valid sire from the horse list.";
  if (input.damId && (!dam || dam.gender !== "FEMALE" || dam.isDeleted))
    return "Choose a valid dam from the horse list.";
  if (input.sireId && input.sireId === input.damId) return "Sire and dam must be different horses.";
  if (rawDob) {
    const latestParentBirthDate = subtractYears(isoDob, 2);
    if (sire?.dateOfBirth && sire.dateOfBirth > latestParentBirthDate)
      return "Sire must be at least 2 years older than this horse.";
    if (dam?.dateOfBirth && dam.dateOfBirth > latestParentBirthDate)
      return "Dam must be at least 2 years older than this horse.";
  }

  const children = input.horseId
    ? input.horses.filter(
        (horse) =>
          horse.id !== input.horseId &&
          (horse.sireId === input.horseId || horse.damId === input.horseId),
      )
    : [];
  if (
    children.some((child) => child.sireId === input.horseId) &&
    !["MALE", "GELDING"].includes(input.gender)
  )
    return "This horse must remain male or gelding while listed as a sire.";
  if (children.some((child) => child.damId === input.horseId) && input.gender !== "FEMALE")
    return "This horse must remain female while listed as a dam.";
  const earliestChildBirthDate = children
    .map((child) => child.dateOfBirth)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  if (
    rawDob &&
    earliestChildBirthDate &&
    isoDob > subtractYears(earliestChildBirthDate, 2)
  ) {
    return "This horse must be at least 2 years older than its oldest foal.";
  }
  return null;
}

export function filterHorsesBySearch<
  T extends { name: string; id: string; microchipId?: string | null },
>(horses: T[], query: string): T[] {
  const trimmed = query.trim();
  if (!trimmed) return horses;
  const rawNeedle = trimmed.toLowerCase();
  const normalizedNeedle = normalizeVietnamese(trimmed);

  return horses.filter((horse) => {
    const fields = [horse.name, horse.id, horse.microchipId ?? ""];
    return fields.some((value) => {
      if (!value) return false;
      const rawVal = value.toLowerCase();
      if (rawVal.includes(rawNeedle)) return true;
      const normalizedVal = normalizeVietnamese(value);
      return normalizedVal.includes(normalizedNeedle);
    });
  });
}
