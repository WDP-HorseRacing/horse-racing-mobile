import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleCache = new Map();

function loadTypeScript(modulePath) {
  const resolvedPath = resolve(modulePath);
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports;

  const source = readFileSync(resolvedPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText;
  const loadedModule = { exports: {} };
  moduleCache.set(resolvedPath, loadedModule);

  const localRequire = (specifier) => {
    if (specifier.startsWith("@/")) {
      return loadTypeScript(resolveSourceModule(specifier.slice(2)));
    }
    return createRequire(resolvedPath)(specifier);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

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

process.env.EXPO_PUBLIC_API_URL = "http://127.0.0.1:9876/api/v1/";
const { ApiError, apiRequest, setUnauthorizedTokenRefreshHandler } = loadTypeScript(
  join(root, "src/services/api-client.ts"),
);
const { LatestRequestGuard } = loadTypeScript(join(root, "src/hooks/useApiResource.ts"));
const { mapTrainingSessions } = loadTypeScript(join(root, "src/adapters/training.adapter.ts"));
const { mapHealthStatus, mapHorseSummary } = loadTypeScript(
  join(root, "src/adapters/horse.adapter.ts"),
);
const { getLoginFeedback } = loadTypeScript(join(root, "src/features/auth/login-feedback.ts"));
const { medicalService } = loadTypeScript(join(root, "src/services/medical.service.ts"));
const { stableCareService } = loadTypeScript(join(root, "src/services/stable-care.service.ts"));
const { reportsService } = loadTypeScript(join(root, "src/services/reports.service.ts"));
const { clubDate, filterHorsesBySearch, isValidIsoDate, validateHorseIdentity } = loadTypeScript(
  join(root, "src/utils/horse-validation.ts"),
);
const {
  clubDateTimeParts,
  isAllowedVisitDateTime,
  isNotPastDateTime,
  isValidDateOnly,
  isValidMedicalMeasurement,
  parseNonNegativeInteger,
  toClubDateTime,
} = loadTypeScript(join(root, "src/features/medical/medical-validation.ts"));
const { clubDateTimeToIso, classWeekNumber, isParticipantWindowOpen, parseTrialDurationMs } =
  loadTypeScript(join(root, "src/features/training/training-utils.ts"));
const { hasFeedingMealDuplicate, isDateOnly, isValidCareTaskRange, isValidChecklistRange } =
  loadTypeScript(join(root, "src/features/stable-care/stable-care-validation.ts"));

test("login feedback exposes authentication failures even without a session token", () => {
  const authError = new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
  const feedback = getLoginFeedback(authError, "", false);

  assert.equal(feedback.error, authError);
  assert.equal(feedback.showSessionRetry, false);
  assert.equal(getLoginFeedback(null, "", false), null);
});

test("apiRequest serializes JSON and attaches the bearer token", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return new Response(JSON.stringify({ saved: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await apiRequest("/horses", {
    method: "POST",
    token: "test-access-token",
    body: { name: "Comet", gender: "MALE" },
  });

  assert.deepEqual(response, { saved: true });
  assert.equal(observed.url, "http://127.0.0.1:9876/api/v1/horses");
  assert.equal(observed.options.method, "POST");
  assert.equal(observed.options.headers.get("Accept"), "application/json");
  assert.equal(observed.options.headers.get("Content-Type"), "application/json");
  assert.equal(observed.options.headers.get("Authorization"), "Bearer test-access-token");
  assert.equal(observed.options.body, JSON.stringify({ name: "Comet", gender: "MALE" }));
});

test("apiRequest handles empty success responses and structured HTTP errors", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiRequest("/notifications/read-all", { method: "PATCH" }), undefined);

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        message: ["reason is required", "reason is too short"],
        error: "Bad Request",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  await assert.rejects(apiRequest("/horses", { method: "POST" }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.payload.code, 400);
    assert.equal(error.message, "reason is required\nreason is too short");
    return true;
  });
});

test("apiRequest refreshes an expired bearer token and retries the request once", async (context) => {
  const originalFetch = globalThis.fetch;
  const observedAuthorizationHeaders = [];
  let refreshCalls = 0;
  context.after(() => {
    globalThis.fetch = originalFetch;
    setUnauthorizedTokenRefreshHandler(null);
  });

  setUnauthorizedTokenRefreshHandler(async (failedToken) => {
    refreshCalls += 1;
    assert.equal(failedToken, "expired-access-token");
    return "refreshed-access-token";
  });
  globalThis.fetch = async (_url, options) => {
    observedAuthorizationHeaders.push(options.headers.get("Authorization"));
    if (observedAuthorizationHeaders.length === 1) {
      return new Response(JSON.stringify({ message: "jwt expired" }), { status: 401 });
    }
    return new Response(JSON.stringify({ data: "ok" }), { status: 200 });
  };

  const response = await apiRequest("/medical/dashboard", { token: "expired-access-token" });

  assert.deepEqual(response, { data: "ok" });
  assert.equal(refreshCalls, 1);
  assert.deepEqual(observedAuthorizationHeaders, [
    "Bearer expired-access-token",
    "Bearer refreshed-access-token",
  ]);
});

test("apiRequest turns transport failures into a user-readable connection error", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    throw new TypeError("network unavailable");
  };

  await assert.rejects(apiRequest("/horses"), (error) => {
    assert.match(error.message, /Không thể kết nối máy chủ/);
    assert.equal(error.cause.message, "network unavailable");
    return true;
  });
});

test("apiRequest aborts a stalled request and reports a timeout", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  let aborted = false;
  globalThis.fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new DOMException("Request aborted", "AbortError"));
        },
        { once: true },
      );
    });

  await assert.rejects(apiRequest("/auth/login", { timeoutMs: 5 }), (error) => {
    assert.match(error.message, /Máy chủ không phản hồi trong thời gian chờ/);
    assert.equal(error.cause.name, "AbortError");
    return true;
  });
  assert.equal(aborted, true);
});

test("latest request guard discards stale responses after a newer request or invalidation", () => {
  const guard = new LatestRequestGuard();
  const first = guard.begin();
  assert.equal(guard.isCurrent(first), true);

  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
});

test("training mapper preserves backend status, distance, and elapsed duration", () => {
  const [session] = mapTrainingSessions("horse-1", "Comet", [
    {
      participantId: "participant-1",
      sessionId: "session-1",
      classId: "class-1",
      className: "Morning class",
      planName: "Base fitness",
      subjectName: "Endurance",
      name: "Tempo run",
      sessionType: "TIME_TRIAL",
      scheduledStartAt: "2026-10-14T01:00:00.000Z",
      scheduledEndAt: "2026-10-14T01:45:00.000Z",
      location: "Track A",
      surface: "Dirt",
      sessionStatus: "PUBLISHED",
      participantStatus: "ONGOING",
      groomName: null,
      absenceReason: null,
      cancelReason: null,
      completedAt: null,
      trialResults: [
        {
          attemptNo: 1,
          elapsedMs: 72500,
          targetTimeMs: 70000,
          notes: null,
          videoUrl: null,
          recordedAt: "2026-10-14T01:30:00.000Z",
        },
      ],
      evaluation: null,
      plannedDistanceM: 1200,
      distanceM: null,
      intensity: "MODERATE",
      targetTimeMs: null,
    },
  ]);

  assert.equal(session.horseId, "horse-1");
  assert.equal(session.horseName, "Comet");
  assert.equal(session.status, "in_progress");
  assert.equal(session.distanceM, 1200);
  assert.equal(session.durationMin, 45);
  assert.equal(session.trials[0].elapsedMs, 72500);
  assert.ok(session.trials[0].elapsedLabel);
});

test("training schedule timestamps use the club timezone and reject impossible dates", () => {
  assert.equal(clubDateTimeToIso("2026-10-17", "00:30"), "2026-10-16T17:30:00.000Z");
  assert.equal(clubDateTimeToIso("2026-02-30", "06:00"), null);
  assert.equal(clubDateTimeToIso("2026-10-17", "24:00"), null);
});

test("class schedule weeks and participant windows follow Backend boundaries", () => {
  assert.equal(classWeekNumber("2026-10-17", "2026-10-23"), 1);
  assert.equal(classWeekNumber("2026-10-17", "2026-10-24"), 2);
  const start = "2026-10-17T06:00:00+07:00";
  const end = "2026-10-17T07:00:00+07:00";
  assert.equal(
    isParticipantWindowOpen(start, end, "check-in", Date.parse("2026-10-16T22:29:59Z")),
    false,
  );
  assert.equal(
    isParticipantWindowOpen(start, end, "check-in", Date.parse("2026-10-16T22:30:00Z")),
    true,
  );
  assert.equal(
    isParticipantWindowOpen(start, end, "ready", Date.parse("2026-10-16T22:44:59Z")),
    false,
  );
  assert.equal(
    isParticipantWindowOpen(start, end, "ready", Date.parse("2026-10-16T22:45:00Z")),
    true,
  );
  assert.equal(
    isParticipantWindowOpen(start, end, "ready", Date.parse("2026-10-17T00:00:01Z")),
    false,
  );
});

test("trial time entry converts mm:ss.t into the integer millisecond DTO", () => {
  assert.equal(parseTrialDurationMs("01:24.5"), 84_500);
  assert.equal(parseTrialDurationMs("60:00"), 3_600_000);
  assert.equal(parseTrialDurationMs("60:00.1"), null);
  assert.equal(parseTrialDurationMs("00:00.0"), null);
  assert.equal(parseTrialDurationMs("1:60.0"), null);
});

test("horse health mapper keeps the backend health categories distinct", () => {
  assert.equal(mapHealthStatus("UNDER_OBSERVATION"), "MONITOR");
  assert.equal(mapHealthStatus("INJURED"), "INJURED");
  assert.equal(mapHealthStatus("QUARANTINED"), "LOCKED");

  const summary = mapHorseSummary({
    id: "horse-1",
    name: "Comet",
    gender: "GELDING",
    breed: null,
    color: null,
    raceAptitude: null,
    dateOfBirth: null,
    healthStatus: "ELIGIBLE",
    lifecycleStatus: "ACTIVE",
    location: { barn: null, stall: null, placementStatus: "UNPLACED" },
    photoUrl: null,
    canRegisterRace: false,
    isDeleted: false,
  });
  assert.equal(summary.status, "LOCKED");
  assert.equal(summary.barnName, "Not assigned");
});

test("horse search matches name, Horse ID, and microchip", () => {
  const horses = [
    {
      id: "4c9e9a4a-11d1-4b01-a7d0-4db08bcab123",
      name: "Silver Arrow",
      microchipId: "123456789012345",
    },
    { id: "other-id", name: "Night Quartz", microchipId: null },
  ];

  assert.deepEqual(filterHorsesBySearch(horses, "silver"), [horses[0]]);
  assert.deepEqual(filterHorsesBySearch(horses, "4c9e9a4a"), [horses[0]]);
  assert.deepEqual(filterHorsesBySearch(horses, "123456789"), [horses[0]]);
  assert.deepEqual(filterHorsesBySearch(horses, ""), horses);
});

test("club date follows the Backend Asia/Ho_Chi_Minh date boundary", () => {
  assert.equal(clubDate(new Date("2026-10-15T17:30:00.000Z")), "2026-10-16");
});

test("horse form validation rejects impossible dates and invalid parent relationships", () => {
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2025-02-29"), false);
  assert.equal(isValidIsoDate("2024-13-01"), false);

  const identity = {
    name: "Comet",
    breed: "Thoroughbred",
    color: "Bay",
    microchipId: "123456789012345",
    dateOfBirth: "2024-06-01",
    gender: "MALE",
    sireId: "sire-1",
    damId: "dam-1",
    horses: [
      { id: "sire-1", gender: "MALE", isDeleted: false, dateOfBirth: "2020-01-01" },
      { id: "dam-1", gender: "FEMALE", isDeleted: false, dateOfBirth: "2021-01-01" },
    ],
  };

  assert.equal(validateHorseIdentity(identity, "2026-10-16"), null);
  assert.equal(
    validateHorseIdentity({ ...identity, dateOfBirth: "2024-02-31" }, "2026-10-16"),
    "Date of birth must be a valid date in YYYY-MM-DD format.",
  );
  assert.equal(
    validateHorseIdentity({ ...identity, dateOfBirth: "2019-01-01" }, "2026-10-16"),
    "Sire must be at least 2 years older than this horse.",
  );
  assert.equal(
    validateHorseIdentity({ ...identity, damId: "sire-1" }, "2026-10-16"),
    "Choose a valid dam from the horse list.",
  );
  assert.equal(
    validateHorseIdentity({ ...identity, dateOfBirth: "2025-10-17" }, "2026-10-16"),
    "Horse must be at least 1 year old.",
  );
  assert.equal(
    validateHorseIdentity({ ...identity, dateOfBirth: "1986-10-15" }, "2026-10-16"),
    "Horse cannot be older than 40 years.",
  );
  assert.equal(
    validateHorseIdentity(
      {
        ...identity,
        horses: [{ ...identity.horses[0], gender: "GELDING" }, identity.horses[1]],
      },
      "2026-10-16",
    ),
    null,
  );
  assert.equal(
    validateHorseIdentity(
      {
        ...identity,
        horseId: "horse-current",
        gender: "FEMALE",
        horses: [
          ...identity.horses,
          {
            id: "foal-1",
            gender: "FEMALE",
            isDeleted: false,
            dateOfBirth: "2025-01-01",
            sireId: "horse-current",
          },
        ],
      },
      "2026-10-16",
    ),
    "This horse must remain male or gelding while listed as a sire.",
  );
  assert.equal(
    validateHorseIdentity(
      {
        ...identity,
        horseId: "horse-current",
        dateOfBirth: "2023-01-01",
        horses: [
          ...identity.horses,
          {
            id: "foal-1",
            gender: "FEMALE",
            isDeleted: false,
            dateOfBirth: "2024-06-01",
            sireId: "horse-current",
          },
        ],
      },
      "2026-10-16",
    ),
    "This horse must be at least 2 years older than its oldest foal.",
  );
});

test("medical date-time validation uses the club timezone and rejects impossible input", () => {
  assert.deepEqual(clubDateTimeParts(new Date("2026-10-15T17:00:00.000Z")), {
    date: "2026-10-16",
    time: "00:00",
  });
  assert.equal(toClubDateTime("2026-10-16", "00:30"), "2026-10-15T17:30:00.000Z");
  assert.equal(toClubDateTime("2026-02-30", "09:00"), null);
  assert.equal(toClubDateTime("2026-10-16", "24:00"), null);
  assert.equal(isValidDateOnly("2024-02-29"), true);
  assert.equal(isValidDateOnly("2025-02-29"), false);
});

test("medical visit date range accepts only now through seven days ago", () => {
  const now = Date.parse("2026-10-16T00:00:00.000Z");
  assert.equal(isAllowedVisitDateTime("2026-10-09T00:00:00.000Z", now), true);
  assert.equal(isAllowedVisitDateTime("2026-10-08T23:59:59.999Z", now), false);
  assert.equal(isAllowedVisitDateTime("2026-10-16T00:00:00.000Z", now), true);
  assert.equal(isAllowedVisitDateTime("2026-10-16T00:00:00.001Z", now), false);
  assert.equal(isNotPastDateTime("2026-10-16T00:00:00.000Z", now), true);
});

test("medical measurements and treatment costs stay within Backend limits", () => {
  assert.equal(isValidMedicalMeasurement("WEIGHT", 30), true);
  assert.equal(isValidMedicalMeasurement("WEIGHT", 1500), true);
  assert.equal(isValidMedicalMeasurement("WEIGHT", 29.9), false);
  assert.equal(isValidMedicalMeasurement("HEIGHT", 250.1), false);
  assert.equal(isValidMedicalMeasurement("BODY_CONDITION", 9), true);
  assert.equal(isValidMedicalMeasurement("TEMPERATURE", 45.1), false);
  assert.equal(parseNonNegativeInteger("0"), 0);
  assert.equal(parseNonNegativeInteger("10000000000"), 10_000_000_000);
  assert.equal(parseNonNegativeInteger("10000000001"), null);
  assert.equal(parseNonNegativeInteger("12.5"), null);
});

test("medical issue visits and follow-ups use the Backend examination endpoints", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const observed = [];
  globalThis.fetch = async (url, options) => {
    observed.push({ url, options });
    return new Response(JSON.stringify({ id: "record-1", caseId: "case-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const issueInput = {
    kind: "REQUEST",
    conclusion: "ISSUE",
    requestIds: ["request-1"],
    initialDiagnosis: "Lameness",
    examDate: "2026-10-16T02:00:00.000Z",
  };
  await medicalService.createStandaloneVisit("token", "horse-1", issueInput);
  await medicalService.createFollowUpVisit("token", "case-1", { diagnosis: "Improving" });

  assert.equal(observed[0].url, "http://127.0.0.1:9876/api/v1/horses/horse-1/medical-records");
  assert.equal(observed[0].options.method, "POST");
  assert.deepEqual(JSON.parse(observed[0].options.body), issueInput);
  assert.equal(observed[0].options.headers.get("Authorization"), "Bearer token");
  assert.equal(observed[1].url, "http://127.0.0.1:9876/api/v1/medical-cases/case-1/visits");
  assert.equal(JSON.parse(observed[1].options.body).diagnosis, "Improving");
});

test("care completion sends the next occurrence to the Backend, without client-side recurrence", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return new Response(
      JSON.stringify({ completed: { id: "schedule-1" }, next: { id: "schedule-2" } }),
      {
        status: 201,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const nextDueAt = "2026-11-16T02:00:00.000Z";
  await medicalService.completeCareSchedule("token", "schedule-1", nextDueAt);

  assert.equal(observed.url, "http://127.0.0.1:9876/api/v1/care-schedules/schedule-1/complete");
  assert.equal(observed.options.method, "POST");
  assert.deepEqual(JSON.parse(observed.options.body), { nextDueAt });
});

test("stable care date validation matches the Backend's inclusive day limits", () => {
  assert.equal(isDateOnly("2024-02-29"), true);
  assert.equal(isDateOnly("2025-02-29"), false);
  assert.equal(isDateOnly("2026-02-30"), false);
  assert.equal(isValidCareTaskRange("2026-10-17", "2027-10-17", "2026-10-17"), true);
  assert.equal(isValidCareTaskRange("2026-10-17", "2027-10-18", "2026-10-17"), false);
  assert.equal(isValidCareTaskRange("2026-10-16", "2026-10-17", "2026-10-17"), false);
  assert.equal(isValidChecklistRange("2026-10-01", "2026-10-31"), true);
  assert.equal(isValidChecklistRange("2026-10-01", "2026-11-01"), false);
});

test("stable care prevents duplicate feed items within a meal", () => {
  const existing = [{ meal: "NOON", supplyItemId: "feed-1", quantity: 2 }];
  assert.equal(hasFeedingMealDuplicate(existing, "NOON", "feed-1"), true);
  assert.equal(hasFeedingMealDuplicate(existing, "EVENING", "feed-1"), false);
  assert.equal(hasFeedingMealDuplicate(existing, "NOON", "feed-2"), false);
});

test("stable care and cost reports use the Backend routes and request payloads", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const observed = [];
  globalThis.fetch = async (url, options) => {
    observed.push({ url, options });
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await stableCareService.createFeedingPlans("token", {
    horseIds: ["horse-1"],
    items: [{ meal: "NOON", supplyItemId: "feed-1", quantity: 2 }],
  });
  await stableCareService.listChecklists("token", "horse-1", "2026-10-10", "2026-10-16");
  await stableCareService.tickChecklistItem("token", "item-1", { done: false, note: null });
  await stableCareService.reportIncident("token", {
    horseId: "horse-1",
    description: "Horse is limping",
    urgent: true,
    photoMediaId: "asset-1",
  });
  await stableCareService.applySurcharge("token", "surcharge-1");
  await reportsService.getOwnerCosts("token", "2026-10-01", "2026-10-16");

  assert.deepEqual(
    observed.map(({ url, options }) => [
      url,
      options.method ?? "GET",
      options.body ? JSON.parse(options.body) : null,
    ]),
    [
      [
        "http://127.0.0.1:9876/api/v1/feeding-plans",
        "POST",
        { horseIds: ["horse-1"], items: [{ meal: "NOON", supplyItemId: "feed-1", quantity: 2 }] },
      ],
      [
        "http://127.0.0.1:9876/api/v1/horses/horse-1/checklists?from=2026-10-10&to=2026-10-16",
        "GET",
        null,
      ],
      ["http://127.0.0.1:9876/api/v1/checklist-items/item-1", "PATCH", { done: false, note: null }],
      [
        "http://127.0.0.1:9876/api/v1/incidents",
        "POST",
        {
          horseId: "horse-1",
          description: "Horse is limping",
          urgent: true,
          photoMediaId: "asset-1",
        },
      ],
      ["http://127.0.0.1:9876/api/v1/horse-surcharges/surcharge-1/apply", "POST", null],
      [
        "http://127.0.0.1:9876/api/v1/reports/owner/costs?from=2026-10-01&to=2026-10-16",
        "GET",
        null,
      ],
    ],
  );
});
