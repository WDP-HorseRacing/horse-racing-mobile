import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  INJURY_COORDINATE_FRAME,
  INJURY_MODEL_VERSION,
  INJURY_BODY_REGIONS,
  type HorseLocalPosition,
  type InjuryBodyRegion,
} from "@/features/medical/injury-mapper/injury-mapper.types";
import type { InjuryPlacementMetadata } from "@/features/medical/injury-mapper/injury-mapper-policy";

type LocalInjuryPlacement = InjuryPlacementMetadata;

type InjuryPlacementRecord = Record<string, LocalInjuryPlacement>;

const keyForHorse = (horseId: string) => `@stable-os/injury-map/v1/${horseId}`;

function isPosition(value: unknown): value is HorseLocalPosition {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<HorseLocalPosition>;
  return [point.x, point.y, point.z].every(
    (coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate),
  );
}

function isPlacement(value: unknown): value is LocalInjuryPlacement {
  if (!value || typeof value !== "object") return false;
  const placement = value as Partial<LocalInjuryPlacement>;
  return (
    placement.modelVersion === INJURY_MODEL_VERSION &&
    placement.coordinateFrame === INJURY_COORDINATE_FRAME &&
    isPosition(placement.position) &&
    INJURY_BODY_REGIONS.includes(placement.bodyRegion as InjuryBodyRegion) &&
    typeof placement.injuryType === "string"
  );
}

export async function readInjuryPlacements(horseId: string): Promise<InjuryPlacementRecord> {
  try {
    const raw = await AsyncStorage.getItem(keyForHorse(horseId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, LocalInjuryPlacement] =>
        isPlacement(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export async function rememberInjuryPlacements(
  horseId: string,
  injuries: {
    injuryId?: string;
    id?: string;
    position: HorseLocalPosition | null;
    bodyRegion: string;
    injuryType: string;
  }[],
): Promise<void> {
  const placements = await readInjuryPlacements(horseId);
  for (const injury of injuries) {
    const injuryId = injury.injuryId || injury.id;
    if (
      !injuryId ||
      !isPosition(injury.position) ||
      !INJURY_BODY_REGIONS.includes(injury.bodyRegion as InjuryBodyRegion)
    ) {
      continue;
    }
    placements[injuryId] = {
      modelVersion: INJURY_MODEL_VERSION,
      coordinateFrame: INJURY_COORDINATE_FRAME,
      position: injury.position,
      bodyRegion: injury.bodyRegion as InjuryBodyRegion,
      injuryType: injury.injuryType,
    };
  }
  await AsyncStorage.setItem(keyForHorse(horseId), JSON.stringify(placements));
}
