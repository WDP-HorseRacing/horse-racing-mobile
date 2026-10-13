import type { Horse, HorseStatus } from "@/types/raceos";

export type HorseHealthStatusDto = "ELIGIBLE" | "UNDER_OBSERVATION" | "INJURED" | "QUARANTINED";

export type HorseListItemDto = {
  id: string;
  name: string;
  gender: string | null;
  breed: string | null;
  color: string | null;
  raceAptitude: "SPRINTER" | "MILER" | "STAYER" | null;
  dateOfBirth: string | null;
  healthStatus: HorseHealthStatusDto;
  lifecycleStatus: string;
  location: {
    barn: { name: string } | null;
    stall: { code: string } | null;
    placementStatus: string;
  };
  photoUrl: string | null;
  canRegisterRace: boolean;
  isDeleted: boolean;
};

export type HorseDetailDto = Omit<HorseListItemDto, "photoUrl" | "canRegisterRace"> & {
  sireId: string | null;
  damId: string | null;
  owner: { id: string; fullName: string } | null;
  groom: { id: string; fullName: string } | null;
  latestMeasurements: Array<{ type: string; value: number; unit: string; measuredAt: string }>;
  activeTrainingLock: boolean;
  eligibility: { trainingEligible: boolean; racingEligible: boolean };
};

export type HorseSummary = {
  id: string;
  name: string;
  age: number;
  breed: string;
  gender: string;
  healthStatus: HorseHealthStatusDto;
  status: HorseStatus;
  barnName: string;
  stallCode: string;
  lifecycleStatus: string;
  color: string;
  raceAptitude: string;
};

export function mapHorseSummary(horse: HorseListItemDto): HorseSummary {
  const hasActiveTrainingLock =
    horse.healthStatus === "ELIGIBLE" &&
    horse.lifecycleStatus === "ACTIVE" &&
    !horse.canRegisterRace;
  return {
    id: horse.id,
    name: horse.name,
    age: horse.dateOfBirth ? ageFromDateOfBirth(horse.dateOfBirth) : 0,
    breed: horse.breed ?? "—",
    gender: horse.gender ?? "—",
    healthStatus: horse.healthStatus,
    status: hasActiveTrainingLock ? "LOCKED" : mapHealthStatus(horse.healthStatus),
    barnName: horse.location?.barn?.name ?? "Not assigned",
    stallCode: horse.location?.stall?.code ?? "Not assigned",
    lifecycleStatus: horse.lifecycleStatus,
    color: horse.color ?? "—",
    raceAptitude: horse.raceAptitude ?? "—",
  };
}

export function mapHorseSummaryToPrototype(horse: HorseSummary): Horse {
  return {
    id: horse.id,
    name: horse.name,
    age: horse.age,
    breed: horse.breed,
    sex: horse.gender,
    weight: 0,
    stall: horse.stallCode,
    status: horse.status,
    fitness: 0,
    readiness: horse.status === "FIT" ? "High" : "Low",
    raceAptitude: horse.raceAptitude === "SPRINTER" || horse.raceAptitude === "STAYER"
      ? horse.raceAptitude
      : "MILER",
    phase: horse.lifecycleStatus,
    lastSession: `${horse.barnName} · ${horse.raceAptitude}`,
    owner: "—",
    alerts: 0,
    hr: 0,
    color: horse.color,
    sire: "—",
    dam: "—",
  };
}

export function mapHorseDetailToPrototype(horse: HorseDetailDto): Horse {
  const weight = horse.latestMeasurements.find((measurement) => measurement.type === "WEIGHT")?.value ?? 0;
  const age = horse.dateOfBirth ? ageFromDateOfBirth(horse.dateOfBirth) : 0;
  return {
    id: horse.id,
    name: horse.name,
    age,
    breed: horse.breed ?? "—",
    sex: horse.gender ?? "—",
    weight,
    stall: horse.location?.stall?.code ?? "Not assigned",
    status: horse.activeTrainingLock ? "LOCKED" : mapHealthStatus(horse.healthStatus),
    fitness: 0,
    readiness: horse.eligibility.trainingEligible ? "High" : "Low",
    raceAptitude: horse.raceAptitude ?? "MILER",
    phase: "—",
    lastSession: "Training sessions from backend",
    owner: horse.owner?.fullName ?? "Unassigned",
    alerts: 0,
    hr: 0,
    color: horse.color ?? "—",
    sire: horse.sireId ?? "—",
    dam: horse.damId ?? "—",
  };
}

export function mapHealthStatus(status: HorseHealthStatusDto): HorseStatus {
  switch (status) {
    case "UNDER_OBSERVATION":
      return "MONITOR";
    case "INJURED":
      return "INJURED";
    case "QUARANTINED":
      return "LOCKED";
    default:
      return "FIT";
  }
}

function ageFromDateOfBirth(dateOfBirth: string): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
}
