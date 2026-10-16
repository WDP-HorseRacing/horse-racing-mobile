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

function subtractYears(date: string, years: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetYear = year - years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, month - 1, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
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
  if (input.dateOfBirth.trim() && !isValidIsoDate(input.dateOfBirth.trim()))
    return "Date of birth must be a valid date in YYYY-MM-DD format.";
  if (input.dateOfBirth.trim() && input.dateOfBirth.trim() > subtractYears(today, 1))
    return "Horse must be at least 1 year old.";
  if (input.dateOfBirth.trim() && input.dateOfBirth.trim() < subtractYears(today, 40))
    return "Horse cannot be older than 40 years.";

  const sire = input.horses.find((horse) => horse.id === input.sireId);
  const dam = input.horses.find((horse) => horse.id === input.damId);
  if (input.sireId && (!sire || !["MALE", "GELDING"].includes(sire.gender ?? "") || sire.isDeleted))
    return "Choose a valid sire from the horse list.";
  if (input.damId && (!dam || dam.gender !== "FEMALE" || dam.isDeleted))
    return "Choose a valid dam from the horse list.";
  if (input.sireId && input.sireId === input.damId) return "Sire and dam must be different horses.";
  if (input.dateOfBirth.trim()) {
    const latestParentBirthDate = subtractYears(input.dateOfBirth.trim(), 2);
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
    input.dateOfBirth.trim() &&
    earliestChildBirthDate &&
    input.dateOfBirth.trim() > subtractYears(earliestChildBirthDate, 2)
  ) {
    return "This horse must be at least 2 years older than its oldest foal.";
  }
  return null;
}

export function filterHorsesBySearch<
  T extends { name: string; id: string; microchipId?: string | null },
>(horses: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return horses;
  return horses.filter((horse) =>
    [horse.name, horse.id, horse.microchipId ?? ""].some((value) =>
      value.toLocaleLowerCase().includes(needle),
    ),
  );
}
