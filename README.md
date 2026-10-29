# HorseRacing Mobile

Native iOS and Android client built with React Native, Expo SDK 57, Expo Router, TypeScript, and pnpm.

## Run

```bash
pnpm install
pnpm start
```

Use `pnpm ios` or `pnpm android` to open a simulator/emulator. The Expo web target remains available as a development convenience with `pnpm web`; application code uses React Native primitives throughout.

Copy `.env.example` to `.env` to use the production backend at `https://api.horse.io.vn/api/v1`. To develop against a local BE, replace `EXPO_PUBLIC_API_URL` with `http://localhost:3000/api/v1` on the iOS Simulator, `http://10.0.2.2:3000/api/v1` on the Android Emulator, or `http://<computer-LAN-IP>:3000/api/v1` on a physical device. The app uses the selected backend host for Socket.IO realtime events at `/events`. The app stores the access and refresh tokens locally, validates the session with `/auth/me` on launch, and routes users by the effective backend role.

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
