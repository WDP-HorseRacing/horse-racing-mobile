import type * as THREE from "three";
import type { HorseLocalPosition } from "./injury-mapper.types";

export function worldPointToHorseRootLocal(
  horseRoot: THREE.Object3D,
  worldPoint: THREE.Vector3,
): HorseLocalPosition;
