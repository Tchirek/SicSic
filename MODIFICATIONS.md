# SicSic Comment UI

Integration and maintenance details: [INTEGRATION.md](./INTEGRATION.md)

SicSic is an AGPL iframe comment UI. It includes code and ideas derived from
BeiyanYunyi/Sodesu v0.5.2, with original copyright and license notices kept
where required. The product entry point is `embed/`.

## Product changes

- Refactored the `embed/` runtime into small modules for configuration, API
  access, parent-window messaging, mobile panel gestures, Markdown preview,
  operating-system detection, DOM mounting, and comment rendering.
- Moved deployment-specific origins and CSP values into Vite/Wrangler
  configuration instead of embedding them in the application logic.
- Removed attachment upload; kept anonymous commenting as the first-class path.
- Re-introduced accounts as an opt-in backend capability (`features.auth`): email +
  password / Google login, profile (change password, rebind email), per-user avatar
  badge, and owner edit-once / own-delete. The account UI only renders when the active
  backend implements `/api/auth/*`, so anonymous-only hosts surface no login entry.
- Preserved Markdown preview, two-level replies, likes, and administrator
  deletion.
- Replaced visible sorting controls with a fixed ranking that prioritizes
  liked comments by like count, then unliked comments by recency.
- Added deterministic nickname-initial avatars, icon-only heart likes, and a
  hidden administrator verification trigger.
- Added normalized operating-system labels and a privacy-preserving,
  device-bound nickname-change cooldown.
- Added strict `postMessage` origin checks for iframe integration.
- Replaced product attribution with `Powered by SicSic`, while keeping a visible
  `derived from BeiyanYunyi/Sodesu v0.5.2` original-project link.

## Build

```sh
cd embed
npm install
npm run build
```

Production defaults live in `embed/src/config.ts` presets and Worker security
headers live in `embed/wrangler.toml`. Do not commit real `.env*` files; use
`embed/.env.example` for local overrides.
