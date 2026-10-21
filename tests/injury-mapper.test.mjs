import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleCache = new Map();

function resolveSourceModule(relativePath) {
  const base = join(root, "src", relativePath);
  for (const extension of [".ts", ".tsx", ".js", ".json"]) {
    const candidate = `${base}${extension}`;
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // Try the next source extension.
    }
  }
  return join(base, "index.ts");
}

function loadTypeScript(modulePath) {
  const resolvedPath = resolve(modulePath);
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports;

  const output = ts.transpileModule(readFileSync(resolvedPath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText;
  const loadedModule = { exports: {} };
  moduleCache.set(resolvedPath, loadedModule);
  const localRequire = (specifier) =>
    specifier.startsWith("@/")
      ? loadTypeScript(resolveSourceModule(specifier.slice(2)))
      : createRequire(resolvedPath)(specifier);
  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

const mapperRoot = join(root, "src/features/medical/injury-mapper");
const { INJURY_MODEL_VERSION, INJURY_COORDINATE_FRAME } = loadTypeScript(
  join(mapperRoot, "injury-mapper.types.ts"),
);
const {
  hasSameInjuryPosition,
  isHorseModelPosition,
  isValidInjuryDraft,
  isVerifiedInjuryPlacement,
  toInjuryUpdateApiInputs,
  toNewInjuryApiInputs,
} = loadTypeScript(join(mapperRoot, "injury-mapper-policy.ts"));
const { parseNativeToWebMessage, parseWebToNativeMessage } = loadTypeScript(
  join(mapperRoot, "injury-mapper-protocol.ts"),
);
const { suggestBodyRegion } = await import(
  pathToFileURL(join(mapperRoot, "injury-regions.mjs")).href
);
const { worldPointToHorseRootLocal } = await import(
  pathToFileURL(join(mapperRoot, "injury-coordinate.mjs")).href
);
const THREE = await import("three");

test("surface world points convert to unchanged horse-root-local XYZ", () => {
  const horseRoot = new THREE.Object3D();
  horseRoot.position.set(2, -1, 3);
  horseRoot.rotation.set(0.1, 0.7, -0.2);
  horseRoot.scale.set(1.1, 0.9, 1.2);
  horseRoot.updateWorldMatrix(true, true);

  const expectedLocal = new THREE.Vector3(0.22, 1.2, -0.35);
  const worldPoint = horseRoot.localToWorld(expectedLocal.clone());
  const actual = worldPointToHorseRootLocal(horseRoot, worldPoint);

  assert.ok(Math.abs(actual.x - expectedLocal.x) < 1e-10);
  assert.ok(Math.abs(actual.y - expectedLocal.y) < 1e-10);
  assert.ok(Math.abs(actual.z - expectedLocal.z) < 1e-10);
  assert.deepEqual(horseRoot.scale.toArray(), [1.1, 0.9, 1.2]);
});

test("root-local axes suggest anatomical regions and an unknown-area fallback", () => {
  const cases = [
    [{ x: 0, y: 1.5, z: 1.05 }, "HEAD"],
    [{ x: 0, y: 1.15, z: 0.5 }, "NECK"],
    [{ x: 0, y: 1.4, z: 0 }, "BACK"],
    [{ x: 0, y: 1, z: 0.3 }, "CHEST"],
    [{ x: 0, y: 1, z: -0.2 }, "ABDOMEN"],
    [{ x: 0, y: 1, z: -0.6 }, "PELVIS"],
    [{ x: 0.2, y: 0.5, z: 0.4 }, "LEFT_FRONT_LEG"],
    [{ x: -0.2, y: 0.5, z: 0.4 }, "RIGHT_FRONT_LEG"],
    [{ x: 0.2, y: 0.5, z: -0.4 }, "LEFT_HIND_LEG"],
    [{ x: -0.2, y: 0.5, z: -0.4 }, "RIGHT_HIND_LEG"],
  ];
  for (const [position, expectedRegion] of cases) {
    assert.equal(suggestBodyRegion(position), expectedRegion);
  }
  assert.equal(suggestBodyRegion({ x: Number.NaN, y: 0, z: 0 }), "OTHER");
});

test("injury draft validation requires valid enums, finite model XYZ, and bounded notes", () => {
  const valid = {
    id: "draft-1",
    bodyRegion: "LEFT_FRONT_LEG",
    position: { x: 0.12, y: 0.74, z: 0.31 },
    injuryType: "SPRAIN",
    recoveryStatus: "ACUTE",
    notes: "Swelling",
    confirmed: true,
  };
  assert.equal(isValidInjuryDraft(valid), true);
  assert.equal(isValidInjuryDraft({ ...valid, confirmed: false }), false);
  assert.equal(isHorseModelPosition({ x: 0, y: 0.5, z: 0 }), true);
  assert.equal(isHorseModelPosition({ x: 4, y: 0.5, z: 0 }), false);
  assert.equal(isValidInjuryDraft({ ...valid, injuryType: "UNKNOWN" }), false);
  assert.equal(isValidInjuryDraft({ ...valid, bodyRegion: "UNKNOWN" }), false);
  assert.equal(isValidInjuryDraft({ ...valid, position: { x: Infinity, y: 0.5, z: 0 } }), false);
  assert.equal(isValidInjuryDraft({ ...valid, notes: "x".repeat(1001) }), false);
});

test("API injury serializers send only fields declared by the Backend DTO", () => {
  const draft = {
    id: "draft-1",
    bodyRegion: "BACK",
    position: { x: 0.01, y: 1.4, z: -0.1 },
    injuryType: "CONTUSION",
    recoveryStatus: "ACUTE",
    notes: "  Bruising  ",
    modelVersion: INJURY_MODEL_VERSION,
    coordinateFrame: INJURY_COORDINATE_FRAME,
  };
  const [newInjury] = toNewInjuryApiInputs([draft]);
  assert.deepEqual(newInjury, {
    bodyRegion: "BACK",
    position: { x: 0.01, y: 1.4, z: -0.1 },
    injuryType: "CONTUSION",
    recoveryStatus: "ACUTE",
    notes: "Bruising",
  });
  assert.equal("modelVersion" in newInjury, false);
  assert.equal("coordinateFrame" in newInjury, false);
  assert.equal("examDate" in newInjury, false);

  const [update] = toInjuryUpdateApiInputs([
    { injuryId: "injury-1", recoveryStatus: "RECOVERING", notes: "  " },
  ]);
  assert.deepEqual(update, { injuryId: "injury-1", recoveryStatus: "RECOVERING" });
});

test("a saved marker is restored only when device metadata and API record agree", () => {
  const injury = {
    id: "injury-1",
    bodyRegion: "BACK",
    injuryType: "CONTUSION",
    position: { x: 0.01, y: 1.4, z: -0.1 },
  };
  const placement = {
    modelVersion: INJURY_MODEL_VERSION,
    coordinateFrame: INJURY_COORDINATE_FRAME,
    bodyRegion: "BACK",
    injuryType: "CONTUSION",
    position: { x: 0.010001, y: 1.4, z: -0.1 },
  };
  assert.equal(isVerifiedInjuryPlacement(injury, placement), true);
  assert.equal(isVerifiedInjuryPlacement(injury, undefined), false);
  assert.equal(isVerifiedInjuryPlacement(injury, { ...placement, modelVersion: "v0" }), false);
  assert.equal(
    isVerifiedInjuryPlacement(injury, { ...placement, coordinateFrame: "SCREEN" }),
    false,
  );
  assert.equal(isVerifiedInjuryPlacement(injury, { ...placement, bodyRegion: "HEAD" }), false);
  assert.equal(isVerifiedInjuryPlacement(injury, { ...placement, injuryType: "WOUND" }), false);
  assert.equal(
    isVerifiedInjuryPlacement(injury, { ...placement, position: { x: 0.1, y: 1.4, z: -0.1 } }),
    false,
  );
  assert.equal(hasSameInjuryPosition(injury.position, placement.position), true);
});

test("viewer bridge accepts only bounded, versioned JSON messages", () => {
  assert.deepEqual(parseWebToNativeMessage('{"type":"VIEWER_READY"}'), {
    type: "VIEWER_READY",
  });
  assert.equal(
    parseWebToNativeMessage(
      JSON.stringify({
        type: "POINT_SELECTED",
        position: { x: 10, y: 0, z: 0 },
        bodyRegion: "BACK",
      }),
    ),
    null,
  );
  assert.equal(parseWebToNativeMessage('{"type":"RUN_SCRIPT","code":"alert(1)"}'), null);
  assert.equal(parseWebToNativeMessage("{"), null);

  assert.deepEqual(
    parseNativeToWebMessage(
      JSON.stringify({
        type: "LOAD_MODEL_START",
        modelVersion: INJURY_MODEL_VERSION,
        chunkCount: 12,
      }),
    ),
    { type: "LOAD_MODEL_START", modelVersion: INJURY_MODEL_VERSION, chunkCount: 12 },
  );
  assert.equal(
    parseNativeToWebMessage(
      JSON.stringify({ type: "LOAD_MODEL_START", modelVersion: "untrusted", chunkCount: 12 }),
    ),
    null,
  );
  assert.deepEqual(
    parseNativeToWebMessage(
      JSON.stringify({
        type: "LOAD_MARKERS",
        markers: [
          {
            id: "draft-1",
            source: "draft",
            bodyRegion: "BACK",
            position: { x: 0, y: 1.4, z: 0 },
          },
        ],
      }),
    ),
    {
      type: "LOAD_MARKERS",
      markers: [
        {
          id: "draft-1",
          source: "draft",
          bodyRegion: "BACK",
          position: { x: 0, y: 1.4, z: 0 },
        },
      ],
    },
  );
});
