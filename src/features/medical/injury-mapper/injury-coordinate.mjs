/**
 * Convert a surface intersection to the unchanged GLTF root's local coordinate frame.
 * @param {import("three").Object3D} horseRoot
 * @param {import("three").Vector3} worldPoint
 * @returns {{ x: number, y: number, z: number }}
 */
export function worldPointToHorseRootLocal(horseRoot, worldPoint) {
  horseRoot.updateWorldMatrix(true, false);
  const localPoint = horseRoot.worldToLocal(worldPoint.clone());
  return { x: localPoint.x, y: localPoint.y, z: localPoint.z };
}
