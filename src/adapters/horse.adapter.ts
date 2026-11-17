import type { HorseStatus } from "@/types/raceos";

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
  isDeleted: boolean;
};

export type HorseDetailDto = Omit<HorseListItemDto, "photoUrl"> & {
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
    trainingReasons: string[];
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
  microchipId: string;
  dateOfBirth?: string;
  sireId?: string;
  damId?: string;
  ownerId: string;
  barnId?: string;
  mediaId?: string;
};
export type UpdateHorseInput = {
  version: number;
  name?: string;
  gender?: HorseGenderDto;
  breed?: string | null;
  color?: string | null;
  microchipId?: string;
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
  age: number | null;
  breed: string | null;
  gender: string | null;
  healthStatus: HorseHealthStatusDto;
  status: HorseStatus;
  barnName: string | null;
  stallCode: string | null;
  lifecycleStatus: string;
  color: string | null;
  raceAptitude: string | null;
};

export type HorseSummaryDto = HorseSummary;

export function mapHorseSummary(horse: HorseListItemDto): HorseSummary {
  return {
    id: horse.id,
    name: horse.name,
    age: horse.dateOfBirth ? ageFromDateOfBirth(horse.dateOfBirth) : null,
    breed: horse.breed,
    gender: horse.gender,
    healthStatus: horse.healthStatus,
    status: mapHealthStatus(horse.healthStatus),
    barnName: horse.location?.barn?.name ?? null,
    stallCode: horse.location?.stall?.code ?? null,
    lifecycleStatus: horse.lifecycleStatus,
    color: horse.color,
    raceAptitude: horse.raceAptitude,
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

export function ageFromDateOfBirth(dateOfBirth: string): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
}
