# Data boundary

- `fixtures/raceos.json` contains local development fixtures only.
- `../types/raceos.ts` is the canonical UI contract.
- `fixtures/parse-raceos.ts` validates unknown JSON/API payloads at runtime.
- `fixtures/raceos.ts` is the adapter consumed by the application.

When the API is available, replace the JSON input in `fixtures/raceos.ts` with the API response and pass it through `parseRaceOSFixture`. Keep the exports unchanged so screens do not need to change.
