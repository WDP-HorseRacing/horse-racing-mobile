# RACEOS Mobile

Native iOS and Android client built with React Native, Expo SDK 57, Expo Router, TypeScript, and pnpm.

## Run

```bash
pnpm install
pnpm start
```

Use `pnpm ios` or `pnpm android` to open a simulator/emulator. The Expo web target remains available as a development convenience with `pnpm web`; application code uses React Native primitives throughout.

## Checks

```bash
pnpm check
pnpm export:web
```

Development helpers:

- `pnpm typecheck` — TypeScript validation only; it never emits JavaScript.
- `pnpm lint` / `pnpm lint:fix` — ESLint validation and safe automatic fixes.
- `pnpm format` / `pnpm format:check` — apply or verify Prettier formatting.
- `pnpm check` — run typecheck, lint, and formatting validation together.

## Structure

- `app/` — Expo Router screens
- `src/native/` — reusable native UI, data visualizations, role configuration, and design tokens
- `src/context/` — prototype state shared across role workflows
- `src/lib/raceos-data.ts` — typed domain fixtures
