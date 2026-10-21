import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const entryPoint = new URL(
  "../src/features/medical/injury-mapper/viewer-entry.ts",
  import.meta.url,
);
const outfile = new URL(
  "../src/features/medical/injury-mapper/assets/injury-viewer.bundle.txt",
  import.meta.url,
);

await build({
  entryPoints: [fileURLToPath(entryPoint)],
  outfile: fileURLToPath(outfile),
  bundle: true,
  minify: true,
  legalComments: "inline",
  format: "iife",
  platform: "browser",
  target: ["safari15", "chrome107"],
  sourcemap: false,
  logLevel: "info",
});

console.log(`Generated ${fileURLToPath(outfile)} from ${fileURLToPath(root)}`);
