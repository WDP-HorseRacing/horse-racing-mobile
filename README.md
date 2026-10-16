# HorseRacing Mobile

Native iOS and Android client built with React Native, Expo SDK 57, Expo Router, TypeScript, and pnpm.

## Run

```bash
pnpm install
pnpm start
```

Use `pnpm ios` or `pnpm android` to open a simulator/emulator. The Expo web target remains available as a development convenience with `pnpm web`; application code uses React Native primitives throughout.

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the backend origin with `/api/v1`. Use `http://10.0.2.2:3000/api/v1` from the Android emulator; a physical device needs the computer's LAN address. The app stores the access and refresh tokens locally, validates the session with `/auth/me` on launch, and routes users by the effective backend role.

## Checks

```bash
pnpm check
pnpm test
pnpm export:web
```

Development helpers:

- `pnpm typecheck` — TypeScript validation only; it never emits JavaScript.
- `pnpm lint` / `pnpm lint:fix` — ESLint validation and safe automatic fixes.
- `pnpm format` / `pnpm format:check` — apply or verify Prettier formatting.
- `pnpm check` — run typecheck, lint, and formatting validation together.
- `pnpm test` — run Mobile API client unit tests and compare Mobile service requests with the sibling Backend OpenAPI contract.

## Structure

- `app/` — Expo Router screens
- `src/native/` — reusable native UI, data visualizations, role configuration, and design tokens
- `src/context/` — prototype state shared across role workflows
- `src/adapters/` — backend response mappers for training, medical, and Groom flows
- `src/services/` — API client and endpoint services
- `src/lib/raceos-data.ts` — typed domain fixtures
