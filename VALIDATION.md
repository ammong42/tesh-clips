# Prototype validation

Revalidated November 13, 2026 (America/Denver).

## Recovery

The resumed cloud filesystem contained an empty checkout on unborn branch `work`, no prior commit objects, no reflogs, and no source files. A read-only GitHub check also returned no remote refs. The previous unpublished local `main` commits, including `c609ef7`, could not be recovered as Git objects. This implementation and its specifications were reconstructed from the source recorded in the conversation; it has a new root commit and refreshed lockfile, rather than the old commit history.

The product scope remains unchanged: Vite/React/TypeScript, manual YouTube Data API import, deterministic classification, four independent no-repeat decks, local favorites, visible official player, responsive Home/Playback/Saved views and honest empty states. The browser-test dependency versions were aligned to avoid incompatible duplicate Playwright types.

## Current results

- `npm ci --no-audit --no-fund`: passed, proving installation from the regenerated lockfile.
- `npm test`: **56 passed** across 7 files; none skipped. These cover classifier rules/overrides, importer pagination/batching/errors/atomic writes, deck cycles/reconciliation/pool independence, storage parsing/fallback, player lifecycle/timeouts and UI interactions.
- `npm run check`: passed.
- `npm run build`: passed, with static output in ignored `dist/`.
- `npm run format:check`: passed.
- `npm run test:browser`: **7 passed** in system Chromium. Includes all four pools, save/unsave, replay, saved playback, reload, browser back, end/error/autoplay events, player cleanup, keyboard/focus, no horizontal overflow and minimum 200×200 iframe size. Axe scans found no violations in Home/Playback/Saved test states at 320, 390, 768 and 1440px.
- `npm run import:playlist`: actual CLI returned exit 1 with the expected missing-key diagnostic; `YOUTUBE_API_KEY` is unset. The real catalog remains empty and no live playlist import occurred.
- Built-asset scan: no importer API-key variable, YouTube Data API URL, synthetic test key or synthetic fixture IDs included. `.env`, dependencies, build outputs and test reports are ignored.

## Limits

Importer HTTP and YouTube player behavior are tested with isolated synthetic data and API doubles; they do not establish live playlist access or real media playback. No John Tesh IDs or metadata were invented. Follow README's numbered API setup, provide a restricted key securely and allow `www.googleapis.com`, run the importer and then perform the documented real-video smoke check. Real-device/screen-reader review remains a separate follow-up.

The cloud draft's installation/startup instructions were saved during initial setup; saving a draft does not publish or prove restoration of a prepared snapshot. GitHub is the durable source for future checkouts once the authorized push succeeds. The tool result and chat handoff, rather than this pre-push document, establish whether that push succeeded.
