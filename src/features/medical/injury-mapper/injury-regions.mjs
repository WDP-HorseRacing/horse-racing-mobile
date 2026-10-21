/** @typedef {{ x: number, y: number, z: number }} HorseLocalPosition */

export const INJURY_BODY_REGIONS = Object.freeze([
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
]);

/**
 * Suggests an anatomical category from the licensed horse model's root-local axes.
 * Vet must confirm or change the suggestion in the native form before saving.
 * Horse forward is +Z, Y is up, and positive X is the horse's left side.
 * @param {HorseLocalPosition} point
 * @returns {string}
 */
export function suggestBodyRegion(point) {
  const { x, y, z } = point;
  if (![x, y, z].every(Number.isFinite)) return "OTHER";

  if (y < 0.82) {
    if (z >= 0.08) return x >= 0 ? "LEFT_FRONT_LEG" : "RIGHT_FRONT_LEG";
    return x >= 0 ? "LEFT_HIND_LEG" : "RIGHT_HIND_LEG";
  }
  if (z >= 0.96 && y >= 1.35) return "HEAD";
  if (z >= 0.4 && y >= 1.05) return "NECK";
  if (z <= -0.42 && y >= 0.92) return "PELVIS";
  if (y >= 1.28 && z >= -0.48 && z < 0.4) return "BACK";
  if (z >= 0.18 && y >= 0.78) return "CHEST";
  if (z < 0.18 && y < 1.12) return "ABDOMEN";
  if (y >= 1.05 && z >= -0.48 && z < 0.4) return "BACK";
  return "OTHER";
}
