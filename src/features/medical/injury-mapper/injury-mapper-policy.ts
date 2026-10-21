import {
  INJURY_BODY_REGIONS,
  INJURY_COORDINATE_FRAME,
  INJURY_MODEL_VERSION,
  INJURY_RECOVERY_STATES,
  INJURY_TYPES,
  type HorseLocalPosition,
  type InjuryBodyRegion,
  type InjuryDraftMarker,
  type InjuryRecoveryStatus,
  type InjuryType,
  type InjuryUpdateInput,
} from "@/features/medical/injury-mapper/injury-mapper.types";

export type InjuryPlacementMetadata = {
  modelVersion: typeof INJURY_MODEL_VERSION;
  coordinateFrame: typeof INJURY_COORDINATE_FRAME;
  position: HorseLocalPosition;
  bodyRegion: InjuryBodyRegion;
  injuryType: string;
};

export type ApiInjuryMappingRecord = {
  id: string;
  bodyRegion: string;
  injuryType: string;
  position: HorseLocalPosition;
};

export type NewInjuryApiInput = {
  bodyRegion: InjuryBodyRegion;
  position: HorseLocalPosition;
  injuryType: InjuryType;
  recoveryStatus: InjuryRecoveryStatus;
  notes?: string;
};

export type InjuryUpdateApiInput = {
  injuryId: string;
  recoveryStatus: InjuryRecoveryStatus;
  notes?: string;
};

export function isHorseModelPosition(value: unknown): value is HorseLocalPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const position = value as Partial<HorseLocalPosition>;
  return (
    [position.x, position.y, position.z].every(
      (coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate),
    ) &&
    Math.abs(position.x!) <= 0.8 &&
    position.y! >= -0.1 &&
    position.y! <= 2.4 &&
    position.z! >= -1.5 &&
    position.z! <= 1.6
  );
}

export function isValidInjuryDraft(marker: InjuryDraftMarker): boolean {
  return (
    INJURY_BODY_REGIONS.includes(marker.bodyRegion) &&
    INJURY_TYPES.includes(marker.injuryType as InjuryType) &&
    INJURY_RECOVERY_STATES.includes(marker.recoveryStatus) &&
    isHorseModelPosition(marker.position) &&
    marker.notes.length <= 1000 &&
    marker.confirmed
  );
}

export function toNewInjuryApiInputs(markers: InjuryDraftMarker[]): NewInjuryApiInput[] {
  return markers.map((marker) => {
    const notes = marker.notes.trim();
    return {
      bodyRegion: marker.bodyRegion,
      position: { x: marker.position.x, y: marker.position.y, z: marker.position.z },
      injuryType: marker.injuryType as InjuryType,
      recoveryStatus: marker.recoveryStatus,
      ...(notes ? { notes } : {}),
    };
  });
}

export function toInjuryUpdateApiInputs(updates: InjuryUpdateInput[]): InjuryUpdateApiInput[] {
  return updates.map((update) => {
    const notes = update.notes?.trim();
    return {
      injuryId: update.injuryId,
      recoveryStatus: update.recoveryStatus,
      ...(notes ? { notes } : {}),
    };
  });
}

export function hasSameInjuryPosition(a: HorseLocalPosition, b: HorseLocalPosition): boolean {
  return (
    Math.abs(a.x - b.x) < 0.00001 && Math.abs(a.y - b.y) < 0.00001 && Math.abs(a.z - b.z) < 0.00001
  );
}

export function isVerifiedInjuryPlacement(
  injury: ApiInjuryMappingRecord,
  placement: InjuryPlacementMetadata | undefined,
): placement is InjuryPlacementMetadata {
  return Boolean(
    placement &&
    placement.modelVersion === INJURY_MODEL_VERSION &&
    placement.coordinateFrame === INJURY_COORDINATE_FRAME &&
    isHorseModelPosition(placement.position) &&
    hasSameInjuryPosition(injury.position, placement.position) &&
    placement.bodyRegion === injury.bodyRegion &&
    placement.injuryType === injury.injuryType,
  );
}
