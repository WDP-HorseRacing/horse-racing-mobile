import type { Horse, HorseStatus } from "@/types/raceos";

export type HorseHealthStatusDto = "ELIGIBLE" | "UNDER_OBSERVATION" | "INJURED" | "QUARANTINED";

export type HorseListItemDto = {
  id: string;
  name: string;
  gender: string | null;
  breed: string | null;
  color: string | null;
  microchipId?: string | null;
  mediaId?: string | null;
  sireId?: string | null;
  damId?: string | null;
  ownerId?: string | null;
  version?: number;
  raceAptitude: "SPRINTER" | "MILER" | "STAYER" | null;
  dateOfBirth: string | null;
  healthStatus: HorseHealthStatusDto;
  lifecycleStatus: string;
  location: {
    barn: { id?: string; name: string } | null;
    stall: { id?: string; code: string } | null;
    placementStatus: string;
  };
  photoUrl: string | null;
  canRegisterRace: boolean;
  isDeleted: boolean;
};

export type HorseDetailDto = Omit<HorseListItemDto, "photoUrl" | "canRegisterRace"> & {
  microchipId: string | null;
  mediaId: string | null;
  ownerId: string | null;
  version: number;
  sireId: string | null;
  damId: string | null;
  owner: { id: string; fullName: string } | null;
  groom: { id: string; fullName: string } | null;
  latestMeasurements: {
    type: string;
    value: number;
    unit: string;
    measuredAt: string;
    isAbnormal: boolean;
  }[];
  activeTrainingLock: boolean;
  eligibility: {
    trainingEligible: boolean;
    racingEligible: boolean;
    trainingReasons: string[];
    racingReasons: string[];
    reasons: string[];
  };
  dateOfDeath: string | null;
  lifecycleReason: string | null;
  lifecycleChangedAt: string | null;
  ownerSince: string | null;
  isDeleted: boolean;
};

export type HorseProfileResponseDto = {
  id: string;
  name: string;
  gender: string | null;
  breed: string | null;
  color: string | null;
  raceAptitude: string | null;
  dateOfBirth: string | null;
  microchipId: string | null;
  mediaId: string | null;
  sireId: string | null;
  damId: string | null;
  ownerId: string | null;
  healthStatus: string;
  lifecycleStatus: string;
  version: number;
};

export type HorseGenderDto = "MALE" | "FEMALE" | "GELDING";
export type CreateHorseInput = {
  name: string;
  gender: HorseGenderDto;
  breed?: string;
  color?: string;
  microchipId?: string;
  dateOfBirth?: string;
  sireId?: string;
  damId?: string;
  ownerId?: string;
  barnId?: string;
  mediaId?: string;
};
export type UpdateHorseInput = {
  version: number;
  name?: string;
  gender?: HorseGenderDto;
  breed?: string | null;
  color?: string | null;
  microchipId?: string | null;
  dateOfBirth?: string | null;
  sireId?: string | null;
  damId?: string | null;
  mediaId?: string | null;
  ownerId?: string | null;
  raceAptitude?: "SPRINTER" | "MILER" | "STAYER";
};

export type HorsePedigreeDto = {
  horseId: string;
  horseName: string;
  depth: number;
  ancestors: {
    id: string;
    name: string;
    gender?: string | null;
    breed?: string | null;
    color?: string | null;
    dateOfBirth?: string | null;
    raceAptitude?: string | null;
    canOpen: boolean;
    generation: number;
    parentRole: "SIRE" | "DAM" | string;
    childId: string;
  }[];
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
    raceAptitude:
      horse.raceAptitude === "SPRINTER" || horse.raceAptitude === "STAYER"
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
  const weight =
    horse.latestMeasurements.find((measurement) => measurement.type === "WEIGHT")?.value ?? 0;
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
