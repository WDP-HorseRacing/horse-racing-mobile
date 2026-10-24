import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");
const openApiPath = resolve(root, "../horse-racing-ne/docs/openapi.contracts.json");
const openApi = JSON.parse(readFileSync(openApiPath, "utf8"));
const tsConfig = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile);
const parsedTsConfig = ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, root);
const program = ts.createProgram(parsedTsConfig.fileNames, parsedTsConfig.options);
const checker = program.getTypeChecker();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathPattern(path) {
  return new RegExp(`^${path.split("{}").map(escapeRegExp).join("[^/]+")}$`);
}

function mobilePath(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.head.text + node.templateSpans.map((span) => `{}` + span.literal.text).join("");
}

function callOptions(node) {
  const options = node.arguments[1];
  const properties = options && ts.isObjectLiteralExpression(options) ? options.properties : [];
  const nameOf = (property) => property.name?.getText().replaceAll(/["'`]/g, "");
  const method = properties.find(
    (property) => nameOf(property) === "method" && ts.isPropertyAssignment(property),
  );
  const token = properties.some((property) => nameOf(property) === "token");
  const body = properties.find(
    (property) => nameOf(property) === "body" && ts.isPropertyAssignment(property),
  );
  return {
    method:
      method && ts.isStringLiteral(method.initializer)
        ? method.initializer.text.toUpperCase()
        : "GET",
    token,
    body: body?.initializer ?? null,
    hasBody: Boolean(body),
  };
}

function collectMobileCalls() {
  const calls = new Map();
  for (const fileName of readdirSync(join(root, "src/services")).filter((name) =>
    name.endsWith(".ts"),
  )) {
    const filePath = join(root, "src/services", fileName);
    const source = program.getSourceFile(filePath);
    assert.ok(source, `TypeScript project did not load ${filePath}`);
    const add = (
      path,
      method,
      token,
      sourceName,
      bodyFields = [],
      bodyType = null,
      responseTypeNode = null,
      hasBody = false,
    ) => {
      const normalized = path.split("?")[0];
      if (!normalized.startsWith("/")) return;
      const key = `${method} ${normalized}`;
      const previous = calls.get(key);
      calls.set(key, {
        method,
        path: normalized,
        token: Boolean(token || previous?.token),
        hasBody: Boolean(hasBody || previous?.hasBody),
        bodyFields: [
          ...new Map(
            [...(previous?.bodyFields ?? []), ...bodyFields].map((field) => [field.name, field]),
          ).values(),
        ],
        bodyType: bodyType ?? previous?.bodyType ?? null,
        responseTypeNode: responseTypeNode ?? previous?.responseTypeNode ?? null,
        sources: [...new Set([...(previous?.sources ?? []), sourceName])],
      });
    };

    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const firstArg = node.arguments[0];
        if (node.expression.text === "apiRequest" && firstArg) {
          const path = mobilePath(firstArg);
          if (path) {
            const options = callOptions(node);
            const bodyType = options.body ? checker.getTypeAtLocation(options.body) : null;
            const bodyFields = bodyType
              ? checker.getPropertiesOfType(bodyType).map((property) => ({
                  name: property.getName(),
                  optional: Boolean(property.flags & ts.SymbolFlags.Optional),
                }))
              : [];
            add(
              path,
              options.method,
              options.token,
              fileName,
              bodyFields,
              bodyType,
              node.typeArguments?.[0] ?? null,
              options.hasBody,
            );
          }
        }
        // The listPages helper hides the final GET behind a path argument.
        if (node.expression.text === "listPages" && node.arguments.length > 1) {
          const path = mobilePath(node.arguments[1]);
          if (path) add(path, "GET", true, fileName);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...calls.values()].sort((a, b) =>
    `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`),
  );
}

const calls = collectMobileCalls();
const matchedCalls = calls.map((call) => {
  const matcher = pathPattern(call.path);
  let match = Object.entries(openApi.paths).find(
    ([path, operations]) =>
      path.startsWith("/api/v1/") &&
      matcher.test(path.slice("/api/v1".length)) &&
      operations[call.method.toLowerCase()],
  );
  // Some services append a prebuilt query suffix as a variable, which the AST sees as a path segment.
  if (!match && call.path.endsWith("{}")) {
    const withoutQuerySuffix = call.path.slice(0, -2);
    const suffixMatcher = pathPattern(withoutQuerySuffix);
    match = Object.entries(openApi.paths).find(
      ([path, operations]) =>
        path.startsWith("/api/v1/") &&
        suffixMatcher.test(path.slice("/api/v1".length)) &&
        operations[call.method.toLowerCase()],
    );
  }
  return { call, match };
});

test("every Mobile service request has a Backend OpenAPI operation", () => {
  assert.ok(calls.length > 0, "No API requests were discovered in src/services");
  const KNOWN_MISSING_ROUTES = new Set([
    "GET /auth/oidc/google/callback",
    "GET /medical-cases{}",
    "GET /training-sessions/{}/time-trial",
    "PATCH /training-sessions/{}/time-trial",
    "PUT /horses/{}/thresholds",
  ]);
  const missing = matchedCalls
    .filter(({ match }) => !match)
    .map(({ call }) => `${call.method} ${call.path}`)
    .filter((route) => !KNOWN_MISSING_ROUTES.has(route));
  assert.deepEqual(missing, []);
});

test("Mobile bearer-token usage agrees with Backend route protection", () => {
  const mismatches = matchedCalls.flatMap(({ call, match }) => {
    if (!match) return [];
    const operation = match[1][call.method.toLowerCase()];
    const protectedRoute = (operation.security ?? openApi.security ?? []).some(
      (scheme) => "bearer" in scheme,
    );
    if (protectedRoute && !call.token) return [`Missing bearer token: ${call.method} ${call.path}`];
    return [];
  });
  assert.deepEqual(mismatches, []);
});

test("Mobile request body fields satisfy Backend DTO schemas", () => {
  const mismatches = matchedCalls.flatMap(({ call, match }) => {
    if (!match || !call.hasBody) return [];
    const operation = match[1][call.method.toLowerCase()];
    const requestSchemaRef = operation.requestBody?.content?.["application/json"]?.schema?.$ref;
    if (!requestSchemaRef) {
      return [`${call.method} ${call.path} has a Mobile body but no JSON request schema`];
    }

    const schemaName = requestSchemaRef.split("/").at(-1);
    const dto = openApi.components.schemas[schemaName];
    const dtoFields = new Set(Object.keys(dto?.properties ?? {}));
    const mobileFields = new Map(call.bodyFields.map((field) => [field.name, field]));
    const errors = [];
    for (const field of mobileFields.keys()) {
      if (!dtoFields.has(field))
        errors.push(`Backend ${schemaName} does not define Mobile field ${field}`);
    }
    for (const field of dto.required ?? []) {
      if (!mobileFields.has(field) || mobileFields.get(field).optional) {
        errors.push(`Mobile body does not require Backend field ${field} for ${schemaName}`);
      }
    }
    return errors.map((error) => `${call.method} ${call.path}: ${error}`);
  });
  assert.deepEqual(mismatches, []);
});

function objectSchema(schema, seen = new Set()) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.$ref) {
    const name = schema.$ref.split("/").at(-1);
    if (seen.has(name)) return null;
    seen.add(name);
    return objectSchema(openApi.components.schemas[name], seen);
  }
  if (schema.allOf?.length) {
    const parts = schema.allOf.map((part) => objectSchema(part, new Set(seen))).filter(Boolean);
    if (parts.length === 1 && parts[0].type !== "object") return parts[0];
    return {
      type: "object",
      properties: Object.assign({}, ...parts.map((part) => part.properties ?? {})),
      required: [...new Set(parts.flatMap((part) => part.required ?? []))],
    };
  }
  return schema;
}

function successSchema(operation) {
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if (!/^2\d\d$/.test(status) || status === "204") continue;
    const schema = response.content?.["application/json"]?.schema;
    if (schema) return schema;
  }
  return null;
}

function schemaAllowsNull(schema) {
  if (!schema || typeof schema !== "object") return false;
  if (schema.nullable === true) return true;
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  return [schema.anyOf, schema.oneOf].some(
    (variants) => Array.isArray(variants) && variants.some((variant) => variant?.type === "null"),
  );
}

const schemaIssues = [];

function jsonMismatch(path, message) {
  schemaIssues.push(`${path}: ${message}`);
  return false;
}

function jsonShapeMatches(tsType, schema, path = "response", mode = "response") {
  if (
    tsType.flags &
    (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Void | ts.TypeFlags.Never)
  )
    return true;
  if (tsType.isUnion?.()) {
    const includesNull = tsType.types.some((part) => part.flags & ts.TypeFlags.Null);
    const backendAllowsNull = schemaAllowsNull(schema);
    if (includesNull && !backendAllowsNull)
      return jsonMismatch(path, "Mobile type includes null but Backend schema does not allow null");
    if (mode === "response" && backendAllowsNull && !includesNull)
      return jsonMismatch(path, "Backend schema allows null but Mobile type does not");
    const usefulTypes = tsType.types.filter(
      (part) => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)),
    );
    return (
      usefulTypes.length === 0 ||
      usefulTypes.some((part) => jsonShapeMatches(part, schema, path, mode))
    );
  }

  const resolved = objectSchema(schema);
  if (!resolved) return true;
  // Nest Swagger reflects `string | null` and `number | null` as an opaque nullable object unless
  // the DTO explicitly supplies a primitive `type` in @ApiProperty.
  if (
    resolved.type === "object" &&
    resolved.nullable === true &&
    !resolved.properties &&
    !resolved.allOf &&
    tsType.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike)
  )
    return true;
  if (checker.isArrayType(tsType) || checker.isTupleType(tsType)) {
    if (resolved.type !== "array")
      return jsonMismatch(
        path,
        `expected array but Backend schema is ${resolved.type ?? "untyped"}`,
      );
    const itemType = checker.getTypeArguments(tsType)[0];
    return !itemType || jsonShapeMatches(itemType, resolved.items, `${path}[]`, mode);
  }
  if (tsType.flags & ts.TypeFlags.StringLike)
    return (
      resolved.type === "string" ||
      jsonMismatch(path, `expected string but Backend schema is ${resolved.type ?? "untyped"}`)
    );
  if (tsType.flags & ts.TypeFlags.NumberLike)
    return (
      resolved.type === "number" ||
      resolved.type === "integer" ||
      jsonMismatch(path, `expected number but Backend schema is ${resolved.type ?? "untyped"}`)
    );
  if (tsType.flags & ts.TypeFlags.BooleanLike)
    return (
      resolved.type === "boolean" ||
      jsonMismatch(path, `expected boolean but Backend schema is ${resolved.type ?? "untyped"}`)
    );

  const mobileProperties = checker.getPropertiesOfType(tsType);
  if (!mobileProperties.length || !resolved.properties) return true;
  const backendFields = new Set(Object.keys(resolved.properties));
  for (const property of mobileProperties) {
    const name = property.getName();
    if (!backendFields.has(name))
      return jsonMismatch(`${path}.${name}`, "Mobile expects a field absent from Backend schema");
    const propertyType = checker.getTypeOfSymbolAtLocation(
      property,
      property.valueDeclaration ?? property.declarations?.[0],
    );
    if (!jsonShapeMatches(propertyType, resolved.properties[name], `${path}.${name}`, mode))
      return false;
  }
  return true;
}

test("Mobile response DTO fields and JSON shapes agree with Backend success schemas", () => {
  const mismatches = matchedCalls.flatMap(({ call, match }) => {
    if (!match || !call.responseTypeNode) return [];
    const operation = match[1][call.method.toLowerCase()];
    if (operation["x-implementation-status"] === "contract-only") return [];
    const schema = successSchema(operation);
    if (!schema) return [];
    const responseType = checker.getTypeFromTypeNode(call.responseTypeNode);
    const issueStart = schemaIssues.length;
    const matches = jsonShapeMatches(responseType, schema);
    const issues = schemaIssues.splice(issueStart);
    const KNOWN_GAPS = new Set([
      "GET /classes: response[].description: Mobile type includes null but Backend schema does not allow null",
      "GET /classes/{}: response.description: Mobile type includes null but Backend schema does not allow null",
      "GET /classes/{}/enrollments: response[].leftAt: Mobile type includes null but Backend schema does not allow null",
      "GET /horses/{}/alerts: response.meta.totalItems: Mobile expects a field absent from Backend schema",
      "GET /horses/{}/training/sessions: response.items[].trialResults[].targetTimeMs: Mobile expects a field absent from Backend schema",
      "GET /notifications: response.items[].resource.horseId: Mobile type includes null but Backend schema does not allow null",
      "GET /session-participants/{}/evaluation: response.comment: Mobile type includes null but Backend schema does not allow null",
      "GET /session-participants/{}/trial-results: response[].notes: Mobile type includes null but Backend schema does not allow null",
      "GET /training-sessions/{}: response.intensity: Mobile type includes null but Backend schema does not allow null",
      "GET /training-sessions/{}: response.location: Mobile type includes null but Backend schema does not allow null",
      "GET /training-sessions/{}/participants: response[].checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "PATCH /classes/{}: response.description: Mobile type includes null but Backend schema does not allow null",
      "PATCH /classes/{}/status: response.description: Mobile type includes null but Backend schema does not allow null",
      "PATCH /enrollments/{}/leave: response.leftAt: Mobile type includes null but Backend schema does not allow null",
      "PATCH /session-participants/{}/groom: response.checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "PATCH /session-participants/{}/trial-results/{}: response.notes: Mobile type includes null but Backend schema does not allow null",
      "PATCH /training-sessions/{}: response.location: Mobile type includes null but Backend schema does not allow null",
      "POST /classes: response.description: Mobile type includes null but Backend schema does not allow null",
      "POST /classes/{}/enrollments: response.leftAt: Mobile type includes null but Backend schema does not allow null",
      "POST /classes/{}/sessions: response.location: Mobile type includes null but Backend schema does not allow null",
      "POST /classes/{}/sessions/bulk: response[].location: Mobile type includes null but Backend schema does not allow null",
      "POST /session-participants/{}/absent: response.checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "POST /session-participants/{}/check-in: response.checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "POST /session-participants/{}/complete: response.checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "POST /session-participants/{}/evaluation: response.comment: Mobile type includes null but Backend schema does not allow null",
      "POST /session-participants/{}/ready: response.checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "POST /session-participants/{}/start: response.checkedInAt: Mobile type includes null but Backend schema does not allow null",
      "GET /horses/{}/medical-records: response[].healthOutcome: Mobile expects a field absent from Backend schema",
      "GET /medical-cases/{}: response.visits[].healthOutcome: Mobile expects a field absent from Backend schema",
      "GET /medical-records/{}: response.healthOutcome: Mobile expects a field absent from Backend schema",
      "PATCH /medical-records/{}/cost: response.healthOutcome: Mobile expects a field absent from Backend schema",
      "PATCH /session-participants/{}/evaluation: response.comment: Mobile type includes null but Backend schema does not allow null",
      "POST /horses/{}/medical-records: response.healthOutcome: Mobile expects a field absent from Backend schema",
      "POST /medical-cases/{}/visits: response.healthOutcome: Mobile expects a field absent from Backend schema",
      "POST /session-participants/{}/trial-results: response.notes: Mobile type includes null but Backend schema does not allow null",
      "POST /training-sessions/{}/cancel: response.location: Mobile type includes null but Backend schema does not allow null",
    ]);
    const actualIssues = issues.filter(
      (issue) => !KNOWN_GAPS.has(`${call.method} ${call.path}: ${issue}`),
    );
    return matches || !actualIssues.length
      ? []
      : [`${call.method} ${call.path}: ${actualIssues.join("; ")}`];
  });
  assert.deepEqual(mismatches, []);
});

test("Mobile request body JSON field types agree with Backend DTO schemas", () => {
  const mismatches = matchedCalls.flatMap(({ call, match }) => {
    if (!match || !call.hasBody || !call.bodyType) return [];
    const operation = match[1][call.method.toLowerCase()];
    const schema = operation.requestBody?.content?.["application/json"]?.schema;
    if (!schema) return [];
    const issueStart = schemaIssues.length;
    const matches = jsonShapeMatches(call.bodyType, schema, "request", "request");
    const issues = schemaIssues.splice(issueStart);
    return matches ? [] : [`${call.method} ${call.path}: ${issues.join("; ")}`];
  });
  assert.deepEqual(mismatches, []);
});

test("Mobile calls to contract-only routes stay visible as known runtime gaps", () => {
  const actual = matchedCalls
    .flatMap(({ call, match }) => {
      if (!match) return [];
      const operation = match[1][call.method.toLowerCase()];
      return operation["x-implementation-status"] === "contract-only"
        ? [`${call.method} ${match[0].slice("/api/v1".length)}`]
        : [];
    })
    .sort();
  assert.deepEqual(actual, ["GET /races", "POST /races/{id}/registrations"]);
});

test("Mobile and Backend repositories expose matching OpenAPI version prefix", () => {
  assert.ok(openApi.paths["/api/v1/auth/login"]?.post);
  assert.equal(openApi.info.title, "Racehorse API");
});
