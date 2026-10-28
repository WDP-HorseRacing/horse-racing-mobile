import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { suggestBodyRegion } from "./injury-regions.mjs";
import { isHorseModelPosition } from "./injury-mapper-policy";
import { worldPointToHorseRootLocal } from "./injury-coordinate.mjs";
import {
  INJURY_MODEL_VERSION,
  type InjuryBodyRegion,
  type InjuryViewerMarker,
  type WebToNativeMessage,
} from "./injury-mapper.types";
import { parseNativeToWebMessage } from "./injury-mapper-protocol";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}

const canvas = document.getElementById("horse-canvas") as HTMLCanvasElement | null;
if (!canvas) throw new Error("3D canvas is missing");

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let horseRoot: THREE.Object3D | null = null;
let markerLayer: THREE.Group | null = null;
let animationFrame = 0;
let mode: "rotate" | "mark" = "rotate";
let markStart: { x: number; y: number; moved: boolean } | null = null;
const activePointers = new Set<number>();
const raycaster = new THREE.Raycaster();
const normalizedPoint = new THREE.Vector2();
const raycastTargets: THREE.Object3D[] = [];
let markers: InjuryViewerMarker[] = [];
let expectedModelChunks = 0;
let receivedModelChunks: string[] = [];

function send(message: WebToNativeMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

function notifyError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Could not load the 3D horse viewer.";
  send({ type: "VIEWER_ERROR", message: message.slice(0, 240) });
}

let horseCenter = new THREE.Vector3(0, 1.07, 0);

function configureRenderer(): void {
  if (!canvas) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4f3ef");
  camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Clinical Lighting: Soft, balanced, contour-enhancing setup
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8a847b, 1.6);
  scene.add(hemiLight);

  // Soft key light from top-front-flank
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(4.5, 5.0, 3.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Soft fill light on opposite side to illuminate contours and underbelly
  const fillLight = new THREE.DirectionalLight(0xebe8e1, 1.1);
  fillLight.position.set(-4.5, 2.5, -2.5);
  scene.add(fillLight);

  // Rim light to accentuate spine, ears, neck, and leg silhouettes
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
  rimLight.position.set(0, 4.0, -4.5);
  scene.add(rimLight);

  markerLayer = new THREE.Group();
  markerLayer.name = "injury-markers";
  scene.add(markerLayer);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.85;

  setMode(mode);
  resizeRenderer();
  animationFrame = window.requestAnimationFrame(renderFrame);
  window.addEventListener("resize", onWindowResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", disposeViewer, { once: true });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("webglcontextlost", onWebGLContextLost);
  window.addEventListener("message", onNativeMessage);
  document.addEventListener("message", onNativeMessage as EventListener);
  send({ type: "VIEWER_READY" });
}

function onWebGLContextLost(event: Event): void {
  event.preventDefault();
  send({
    type: "VIEWER_ERROR",
    message: "The 3D graphics context was lost. Close and reopen the injury map to retry.",
  });
}

function resizeRenderer(): void {
  if (!canvas || !renderer || !camera) return;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function onWindowResize(): void {
  resizeRenderer();
}

function renderFrame(): void {
  animationFrame = 0;
  if (!renderer || !scene || !camera || document.visibilityState === "hidden") return;
  controls?.update();
  renderer.render(scene, camera);
  animationFrame = window.requestAnimationFrame(renderFrame);
}

function onVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    return;
  }
  if (!animationFrame) animationFrame = window.requestAnimationFrame(renderFrame);
}

function setMode(next: "rotate" | "mark"): void {
  mode = next;
  if (controls) controls.enabled = mode === "rotate";
  if (canvas) canvas.dataset.mode = mode;
  markStart = null;
  activePointers.clear();
}

/**
 * Camera auto-fit according to the 3D model bounding box.
 * Guarantees that the entire horse—from head and ears down to hooves—fits
 * comfortably within the viewport in an initial lateral profile (side view).
 */
function frameHorse(): void {
  if (!camera || !controls || !horseRoot || !canvas) return;
  resizeRenderer();
  horseRoot.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(horseRoot);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  horseCenter.copy(center);

  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const aspect = width / height;
  camera.aspect = aspect;

  const fovY = (camera.fov * Math.PI) / 180;
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);

  // Fit vertical height (Y)
  const distY = size.y / 2 / Math.tan(fovY / 2);
  // Fit horizontal length along Z (lateral view)
  const distZ = size.z / 2 / Math.tan(fovX / 2);
  // Fit width along X (frontal / rear view)
  const distX = size.x / 2 / Math.tan(fovX / 2);

  // Closer anatomical fit (1.05) so the horse fills the viewport prominence without clipping
  const fitDistance = Math.max(distY, distZ, distX) * 1.05;

  controls.target.copy(center);

  // Initial Side View: camera along +X facing the horse flank, slightly elevated for anatomical eye-level view
  camera.position.set(center.x + fitDistance, center.y + size.y * 0.06, center.z);

  // Zoom boundaries
  controls.minDistance = fitDistance * 0.35;
  controls.maxDistance = fitDistance * 2.8;

  camera.near = 0.01;
  camera.far = 100;
  camera.updateProjectionMatrix();
  controls.update();
}

function loadModelFromChunks(): void {
  const joined = receivedModelChunks.join("");
  receivedModelChunks = [];
  expectedModelChunks = 0;
  try {
    const binary = window.atob(joined);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    // Clinical PBR Materials
    const clinicalBodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#dcd8cf"), // clean neutral medical porcelain/clay
      roughness: 0.62,
      metalness: 0.04,
    });
    const clinicalHoofMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#827d75"), // natural muted keratin/horn tone
      roughness: 0.5,
      metalness: 0.05,
    });
    const clinicalHairMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#bab5ab"), // subtle mane/tail differentiation
      roughness: 0.65,
      metalness: 0.02,
    });
    const clinicalEyeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#353330"), // subdued anatomical eye tone
      roughness: 0.45,
      metalness: 0.08,
    });

    new GLTFLoader().parse(
      bytes.buffer,
      "",
      (gltf) => {
        if (!scene) return;
        if (horseRoot) {
          scene.remove(horseRoot);
          disposeObject(horseRoot);
          horseRoot = null;
          raycastTargets.length = 0;
        }
        horseRoot = gltf.scene;
        horseRoot.name = "horse-anatomy-v2-root";
        horseRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const meshName = (object.name || "").toLowerCase();
          if (meshName.includes("eye glint")) {
            object.visible = false; // eliminate cartoon eye shine
          } else if (meshName.includes("eye")) {
            object.material = clinicalEyeMaterial;
            raycastTargets.push(object);
          } else if (meshName.includes("hoof")) {
            object.material = clinicalHoofMaterial;
            raycastTargets.push(object);
          } else if (meshName.includes("mane") || meshName.includes("tail")) {
            object.material = clinicalHairMaterial;
            raycastTargets.push(object);
          } else {
            object.material = clinicalBodyMaterial;
            raycastTargets.push(object);
          }
          object.castShadow = true;
          object.receiveShadow = true;
        });
        scene.add(horseRoot);
        frameHorse();
        drawMarkers();
        send({ type: "MODEL_LOADED", modelVersion: INJURY_MODEL_VERSION });
      },
      notifyError,
    );
  } catch (error) {
    notifyError(error);
  }
}

function drawMarkers(): void {
  if (!markerLayer || !horseRoot) return;
  for (const marker of markerLayer.children) {
    if (marker instanceof THREE.Mesh) {
      marker.geometry.dispose();
      const material = marker.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
  }
  markerLayer.clear();
  horseRoot.updateWorldMatrix(true, true);

  for (const marker of markers) {
    if (!isHorseModelPosition(marker.position)) continue;
    const local = new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
    // Slight outward offset (1.2 cm) along vector from model center to avoid sinking into curved mesh polygons
    const outwardOffset = local.clone().sub(horseCenter).normalize().multiplyScalar(0.012);
    const elevatedLocal = local.clone().add(outwardOffset);
    const world = horseRoot.localToWorld(elevatedLocal);

    const material = new THREE.MeshStandardMaterial({
      color:
        marker.id === selectedMarkerId ? 0x0b8f67 : marker.source === "draft" ? 0xd64545 : 0xf2a33a,
      roughness: 0.35,
      metalness: 0.05,
      depthTest: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    if (marker.id === selectedMarkerId) {
      const highlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 20, 16),
        new THREE.MeshBasicMaterial({
          color: 0x0b8f67,
          transparent: true,
          opacity: 0.45,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        }),
      );
      highlight.name = `injury-region-highlight:${marker.id}`;
      highlight.position.copy(world);
      highlight.renderOrder = 6;
      highlight.userData.markerId = marker.id;
      markerLayer.add(highlight);
    }

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(marker.id === selectedMarkerId ? 0.052 : 0.038, 18, 14),
      material,
    );
    dot.name = `injury-marker:${marker.id}`;
    dot.position.copy(world);
    dot.renderOrder = 7;
    dot.userData.markerId = marker.id;
    markerLayer.add(dot);
  }
}

let selectedMarkerId = "";

function pointAtMarker(markerId: string): void {
  const marker = markers.find((item) => item.id === markerId);
  if (!marker || !horseRoot || !controls || !camera) return;
  selectedMarkerId = markerId;
  drawMarkers();
  const target = horseRoot.localToWorld(
    new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z),
  );
  const offset = camera.position.clone().sub(controls.target);
  controls.target.copy(target);
  camera.position.copy(target.clone().add(offset));
  controls.update();
  send({ type: "MARKER_SELECTED", id: markerId });
}

function onNativeMessage(event: MessageEvent | { data?: unknown }): void {
  if (typeof event.data !== "string" || event.data.length > 160_000) return;
  const message = parseNativeToWebMessage(event.data);
  if (!message) return;
  switch (message.type) {
    case "LOAD_MODEL_START":
      expectedModelChunks = message.chunkCount;
      receivedModelChunks = Array.from({ length: expectedModelChunks }, () => "");
      return;
    case "LOAD_MODEL_CHUNK":
      if (message.index < 0 || message.index >= expectedModelChunks) return;
      receivedModelChunks[message.index] = message.data;
      if (receivedModelChunks.every((chunk) => chunk.length > 0)) loadModelFromChunks();
      return;
    case "LOAD_MARKERS":
      markers = message.markers;
      if (!markers.some((marker) => marker.id === selectedMarkerId)) selectedMarkerId = "";
      drawMarkers();
      return;
    case "FOCUS_MARKER":
      pointAtMarker(message.id);
      return;
    case "REMOVE_DRAFT_MARKER":
      markers = markers.filter(
        (marker) => !(marker.id === message.id && marker.source === "draft"),
      );
      if (selectedMarkerId === message.id) selectedMarkerId = "";
      drawMarkers();
      return;
    case "RESET_CAMERA":
      frameHorse();
      return;
    case "SET_MODE":
      setMode(message.mode);
      return;
    default:
      return;
  }
}

function onPointerDown(event: PointerEvent): void {
  activePointers.add(event.pointerId);
  if (mode !== "mark" || activePointers.size !== 1) {
    markStart = null;
    return;
  }
  markStart = { x: event.clientX, y: event.clientY, moved: false };
}

function onPointerMove(event: PointerEvent): void {
  if (!markStart || activePointers.size !== 1) return;
  const dx = event.clientX - markStart.x;
  const dy = event.clientY - markStart.y;
  if (Math.hypot(dx, dy) > 7) markStart.moved = true;
}

function onPointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId);
  const start = markStart;
  markStart = null;
  if (
    !start ||
    start.moved ||
    activePointers.size !== 0 ||
    mode !== "mark" ||
    !horseRoot ||
    !camera ||
    !canvas
  ) {
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  normalizedPoint.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(normalizedPoint, camera);

  if (markerLayer) {
    const markerHit = raycaster.intersectObjects(markerLayer.children, false)[0];
    const markerId = markerHit?.object.userData.markerId;
    if (typeof markerId === "string") {
      pointAtMarker(markerId);
      return;
    }
  }

  horseRoot.updateWorldMatrix(true, true);
  const hit = raycaster.intersectObjects(raycastTargets, false)[0];
  if (!hit) return;
  const position = worldPointToHorseRootLocal(horseRoot, hit.point);
  if (!isHorseModelPosition(position)) return;
  const bodyRegion = suggestBodyRegion(position) as InjuryBodyRegion;
  send({ type: "POINT_SELECTED", position, bodyRegion });
}

function onPointerCancel(event: PointerEvent): void {
  activePointers.delete(event.pointerId);
  markStart = null;
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function disposeViewer(): void {
  window.cancelAnimationFrame(animationFrame);
  window.removeEventListener("resize", resizeRenderer);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("message", onNativeMessage);
  document.removeEventListener("message", onNativeMessage as EventListener);
  canvas?.removeEventListener("pointerdown", onPointerDown);
  canvas?.removeEventListener("pointermove", onPointerMove);
  canvas?.removeEventListener("pointerup", onPointerUp);
  canvas?.removeEventListener("pointercancel", onPointerCancel);
  canvas?.removeEventListener("webglcontextlost", onWebGLContextLost);
  controls?.dispose();
  if (horseRoot) disposeObject(horseRoot);
  renderer?.dispose();
  scene?.clear();
  horseRoot = null;
}

try {
  configureRenderer();
} catch (error) {
  notifyError(error);
}
