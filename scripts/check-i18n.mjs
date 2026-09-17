import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
const walk = (directory) =>
  readdirSync(directory).forEach((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".tsx") && !path.endsWith("LocalizedText.tsx")) files.push(path);
  });
walk("app");
walk("src/native");
const invalid = files.filter((path) =>
  /\bText\b[^;]*from ["']react-native["']/.test(readFileSync(path, "utf8")),
);
if (invalid.length) {
  console.error(`UI text must use LocalizedText:\n${invalid.join("\n")}`);
  process.exit(1);
}
const dictionary = {
  ...JSON.parse(readFileSync("src/data/locales/vi.json", "utf8")),
  ...JSON.parse(readFileSync("src/data/locales/vi-ui.json", "utf8")),
};
const visible = new Set();
for (const path of files) {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g))
    visible.add(match[1].trim());
  for (const match of source.matchAll(
    /(?:title|subtitle|label|hint|placeholder|detail)="([^"]*[A-Za-z][^"]*)"/g,
  ))
    visible.add(match[1]);
}
const properNameOrUnit =
  /^(RACE|OS|Thunder King|Red Storm|Pale Comet|Autumn Sprint|Silver Arrow|Night Quartz|Golden Hour|Iron Verdict|Brave Ledger|Marlow Bloodstock|Meadowline Racing Club|[+\d$°].*|.*(?:bpm|km\/h|Mcal\/day))$/;
const untranslated = [...visible].filter(
  (text) =>
    text &&
    !dictionary[text] &&
    !properNameOrUnit.test(text) &&
    !Object.keys(dictionary).some((key) => text.includes(key)),
);
if (untranslated.length) {
  console.error(`Missing Vietnamese translations:\n${untranslated.sort().join("\n")}`);
  process.exit(1);
}
console.log("All mobile UI text uses the localization boundary and locale catalog.");
