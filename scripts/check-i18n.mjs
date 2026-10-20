import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const files = [];
const walk = (directory) =>
  readdirSync(directory).forEach((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".tsx") && !path.endsWith("LocalizedText.tsx")) files.push(path);
  });
walk("app");
walk("src");
files.push("src/utils/horse-validation.ts");
const visibleHelperReturnFiles = new Set(["app/groom/tasks.tsx", "src/utils/horse-validation.ts"]);

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
  ...JSON.parse(readFileSync("src/data/locales/vi-ui-extra.json", "utf8")),
};
const translatedValues = new Set(Object.values(dictionary));
const visible = new Set();
const visibleAttributes = new Set([
  "accessibilityLabel",
  "detail",
  "emptyLabel",
  "hint",
  "label",
  "loadingLabel",
  "placeholder",
  "subtitle",
  "title",
]);

function addVisible(value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text && /[A-Za-z]/.test(text)) visible.add(text);
}

function collectExpressionStrings(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addVisible(node.text);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    let template = node.head.text;
    for (const span of node.templateSpans) template += "{value}" + span.literal.text;
    addVisible(template);
    return;
  }
  if (ts.isConditionalExpression(node)) {
    collectExpressionStrings(node.whenTrue);
    collectExpressionStrings(node.whenFalse);
    return;
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const flatten = (part) => {
        if (ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part)) return part.text;
        if (ts.isTemplateExpression(part)) {
          let text = part.head.text;
          for (const span of part.templateSpans) text += "{value}" + span.literal.text;
          return text;
        }
        if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.PlusToken)
          return `${flatten(part.left)}${flatten(part.right)}`;
        return "{value}";
      };
      const text = flatten(node);
      if (/[A-Za-z]{2}/.test(text)) addVisible(text);
      return;
    }
    if (
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ) {
      collectExpressionStrings(node.left);
      collectExpressionStrings(node.right);
    }
    return;
  }
  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.text === "t")
      for (const argument of node.arguments) collectExpressionStrings(argument);
    return;
  }
  ts.forEachChild(node, collectExpressionStrings);
}

function matchesTemplate(text, template) {
  const pattern = template
    .split(/(\{[^{}]+\})/)
    .map((part) =>
      /^\{[^{}]+\}$/.test(part) ? ".+?" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(`^${pattern}$`).test(text);
}

function isCovered(text) {
  const candidate = text.replace(/\{value\}/g, "sample");
  const placeholderRemainder = text
    .replace(/\{value\}/g, "")
    .replace(/\b(?:VND|bpm|km\/h|m\/s|Mcal\/day)\b/g, "")
    .trim();
  if (!/[A-Za-z]{2}/.test(placeholderRemainder)) return true;
  if (dictionary[text] || translatedValues.has(text)) return true;
  return Object.keys(dictionary).some(
    (template) => template.includes("{") && matchesTemplate(candidate, template),
  );
}

for (const path of files) {
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node) {
    if (
      visibleHelperReturnFiles.has(path) &&
      ts.isReturnStatement(node) &&
      node.expression &&
      (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
    )
      addVisible(node.expression.text);
    if (ts.isJsxText(node)) addVisible(node.text);
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(sourceFile))) {
      const initializer = node.initializer;
      if (initializer && ts.isStringLiteral(initializer)) addVisible(initializer.text);
      if (initializer && ts.isJsxExpression(initializer) && initializer.expression)
        collectExpressionStrings(initializer.expression);
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      node.parent &&
      ts.isJsxElement(node.parent)
    ) {
      const name = node.parent.openingElement.tagName.getText(sourceFile);
      if (
        [
          "Text",
          "SectionTitle",
          "Metric",
          "PrimaryButton",
          "SecondaryButton",
          "DangerButton",
        ].includes(name)
      )
        collectExpressionStrings(node.expression);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t"
    )
      for (const argument of node.arguments) collectExpressionStrings(argument);
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "Alert" &&
      node.expression.name.text === "alert"
    ) {
      for (const argument of node.arguments.slice(0, 2)) collectExpressionStrings(argument);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const properNameOrUnit =
  /^(RACE|OS|HorseRacing|HorseRacing Mobile|entry\.value|item\.quantityOnHand|Thunder King|Red Storm|Pale Comet|Autumn Sprint|Silver Arrow|Night Quartz|Golden Hour|Iron Verdict|Brave Ledger|Marlow Bloodstock|Meadowline Racing Club|Asia\/Ho_Chi_Minh|[+\d$°].*|.*(?:bpm|km\/h|Mcal\/day))$/;
const untranslated = [...visible].filter(
  (text) =>
    !isCovered(text) &&
    !properNameOrUnit.test(text) &&
    !text.startsWith("/") &&
    !/^[A-Z0-9_-]+$/.test(text),
);
if (untranslated.length) {
  console.error(`Missing Vietnamese translations:\n${untranslated.sort().join("\n")}`);
  process.exit(1);
}
console.log("All mobile UI text uses the localization boundary and locale catalog.");
