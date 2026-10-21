import {
  INJURY_BODY_REGIONS,
  INJURY_MODEL_VERSION,
  type InjuryBodyRegion,
  type InjuryViewerMarker,
  type NativeToWebMessage,
  type WebToNativeMessage,
} from "@/features/medical/injury-mapper/injury-mapper.types";
import { isHorseModelPosition } from "@/features/medical/injury-mapper/injury-mapper-policy";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRegion(value: unknown): value is InjuryBodyRegion {
  return typeof value === "string" && INJURY_BODY_REGIONS.some((region) => region === value);
}

function isMarker(value: unknown): value is InjuryViewerMarker {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 100 &&
    (value.source === "draft" || value.source === "saved") &&
    isRegion(value.bodyRegion) &&
    isHorseModelPosition(value.position)
  );
}

function parseJson(raw: string, maximumLength: number): Record<string, unknown> | null {
  if (raw.length > maximumLength) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && typeof value.type === "string" ? value : null;
  } catch {
    return null;
  }
}

export function parseWebToNativeMessage(raw: string): WebToNativeMessage | null {
  const value = parseJson(raw, 4_096);
  if (!value) return null;
  switch (value.type) {
    case "VIEWER_READY":
      return { type: "VIEWER_READY" };
    case "MODEL_LOADED":
      return value.modelVersion === INJURY_MODEL_VERSION
        ? { type: "MODEL_LOADED", modelVersion: INJURY_MODEL_VERSION }
        : null;
    case "POINT_SELECTED":
      return isHorseModelPosition(value.position) && isRegion(value.bodyRegion)
        ? { type: "POINT_SELECTED", position: value.position, bodyRegion: value.bodyRegion }
        : null;
    case "MARKER_SELECTED":
      return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
        ? { type: "MARKER_SELECTED", id: value.id }
        : null;
    case "VIEWER_ERROR":
      return typeof value.message === "string"
        ? { type: "VIEWER_ERROR", message: value.message.slice(0, 240) }
        : null;
    default:
      return null;
  }
}

export function parseNativeToWebMessage(raw: string): NativeToWebMessage | null {
  const value = parseJson(raw, 160_000);
  if (!value) return null;
  switch (value.type) {
    case "LOAD_MODEL_START":
      return value.modelVersion === INJURY_MODEL_VERSION &&
        Number.isInteger(value.chunkCount) &&
        Number(value.chunkCount) > 0 &&
        Number(value.chunkCount) <= 128
        ? {
            type: "LOAD_MODEL_START",
            modelVersion: INJURY_MODEL_VERSION,
            chunkCount: Number(value.chunkCount),
          }
        : null;
    case "LOAD_MODEL_CHUNK":
      return value.modelVersion === INJURY_MODEL_VERSION &&
        Number.isInteger(value.index) &&
        Number(value.index) >= 0 &&
        Number(value.index) < 128 &&
        typeof value.data === "string" &&
        value.data.length > 0 &&
        value.data.length <= 128_000 &&
        /^[A-Za-z0-9+/=]*$/.test(value.data)
        ? {
            type: "LOAD_MODEL_CHUNK",
            modelVersion: INJURY_MODEL_VERSION,
            index: Number(value.index),
            data: value.data,
          }
        : null;
    case "LOAD_MARKERS":
      return Array.isArray(value.markers) &&
        value.markers.length <= 100 &&
        value.markers.every(isMarker)
        ? { type: "LOAD_MARKERS", markers: value.markers }
        : null;
    case "FOCUS_MARKER":
      return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
        ? { type: "FOCUS_MARKER", id: value.id }
        : null;
    case "REMOVE_DRAFT_MARKER":
      return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
        ? { type: "REMOVE_DRAFT_MARKER", id: value.id }
        : null;
    case "RESET_CAMERA":
      return { type: "RESET_CAMERA" };
    case "SET_MODE":
      return value.mode === "rotate" || value.mode === "mark"
        ? { type: "SET_MODE", mode: value.mode }
        : null;
    default:
      return null;
  }
}
