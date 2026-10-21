export const INJURY_MODEL_VERSION = "horse-anatomy-v2" as const;
export const INJURY_COORDINATE_FRAME = "HORSE_ROOT_LOCAL" as const;

export const INJURY_BODY_REGIONS = [
  "HEAD",
  "NECK",
  "BACK",
  "CHEST",
  "ABDOMEN",
  "PELVIS",
  "LEFT_FRONT_LEG",
  "RIGHT_FRONT_LEG",
  "LEFT_HIND_LEG",
  "RIGHT_HIND_LEG",
  "OTHER",
] as const;

export type InjuryBodyRegion = (typeof INJURY_BODY_REGIONS)[number];

export const INJURY_TYPES = [
  "FRACTURE",
  "SPRAIN",
  "STRAIN",
  "WOUND",
  "LACERATION",
  "INFLAMMATION",
  "CONTUSION",
  "INFECTION",
  "OTHER",
] as const;

export type InjuryType = (typeof INJURY_TYPES)[number];

export const INJURY_RECOVERY_STATES = ["ACUTE", "RECOVERING", "HEALED"] as const;

export type InjuryRecoveryStatus = (typeof INJURY_RECOVERY_STATES)[number];

export type HorseLocalPosition = { x: number; y: number; z: number };

export type InjuryDraftMarker = {
  id: string;
  bodyRegion: InjuryBodyRegion;
  position: HorseLocalPosition;
  injuryType: InjuryType | "";
  recoveryStatus: InjuryRecoveryStatus;
  notes: string;
  confirmed: boolean;
};

export type InjuryUpdateInput = {
  injuryId: string;
  recoveryStatus: InjuryRecoveryStatus;
  notes?: string;
};

export type InjuryViewerMarker = {
  id: string;
  source: "draft" | "saved";
  bodyRegion: InjuryBodyRegion;
  position: HorseLocalPosition;
};

export type WebToNativeMessage =
  | { type: "VIEWER_READY" }
  | { type: "MODEL_LOADED"; modelVersion: typeof INJURY_MODEL_VERSION }
  | {
      type: "POINT_SELECTED";
      position: HorseLocalPosition;
      bodyRegion: InjuryBodyRegion;
    }
  | { type: "MARKER_SELECTED"; id: string }
  | { type: "VIEWER_ERROR"; message: string };

export type NativeToWebMessage =
  | {
      type: "LOAD_MODEL_START";
      modelVersion: typeof INJURY_MODEL_VERSION;
      chunkCount: number;
    }
  | {
      type: "LOAD_MODEL_CHUNK";
      modelVersion: typeof INJURY_MODEL_VERSION;
      index: number;
      data: string;
    }
  | { type: "LOAD_MARKERS"; markers: InjuryViewerMarker[] }
  | { type: "FOCUS_MARKER"; id: string }
  | { type: "REMOVE_DRAFT_MARKER"; id: string }
  | { type: "RESET_CAMERA" }
  | { type: "SET_MODE"; mode: "rotate" | "mark" };
