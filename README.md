# A Little Life Wisdom

A third-party prototype for discovering John Tesh videos through a visible official YouTube player. Not affiliated with or endorsed by John Tesh or YouTube.

## Local development

Requires Node.js 24.5+ and npm (Node 24 LTS recommended). The importer uses Node's built-in environment-proxy support. Use the existing checkout; each cloud task is already isolated, so no worktree is necessary.

```sh
git clone https://github.com/ammong42/tesh-clips.git
cd tesh-clips
npm ci
npm run dev
```

Open the address printed by Vite. If the repository is already cloned, use `git switch main` and `git pull --ff-only origin main`, then install/run as above. `npm run build` produces static output in `dist/`; `npm run preview` serves it for a local production check. Deployment is outside the prototype scope.

The real catalog starts empty. No playlist content has been verified or invented.

## Import the real playlist / manual refresh

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. In **APIs & Services → Library**, enable **YouTube Data API v3**.
3. In **APIs & Services → Credentials**, create an **API key**. Restrict its API access to **YouTube Data API v3**. For this local Node CLI, use an IP-address application restriction matching your machine's outbound public IP if it is stable. Browser HTTP-referrer restrictions will not work for a Node CLI. For a cloud proxy, use the proxy's outbound IP. Never make the key public or use a `VITE_` prefix.
4. Copy `.env.example` to `.env` and enter your key there (the file is git-ignored), or set `YOUTUBE_API_KEY` in the local process environment. Never paste a key into source code, commits, or chat.
5. If running inside a network-restricted **cloud environment**, allow HTTPS to `www.googleapis.com` in that environment's network settings. When running on your own computer, you normally do not need to change Codex's cloud settings. Keep TLS verification and inherited proxy/CA settings enabled. `npm run import:playlist` uses the supported Node environment-proxy option.
6. Run `npm run import:playlist` from the repository. It paginates the configured playlist `PLPwjiJlz-ZBY`, fetches details in batches of 50, skips invalid/missing/private/non-embeddable videos, classifies metadata, and atomically replaces `data/clips.json` only after full validation. It does not filter by duration. The skipped-count/duration report is saved to ignored `data/import-report.json`.
7. Run `npm run dev`. After a later manual refresh, reload the dev app or rerun `npm run build` for static output. No browser API key or public refresh endpoint is used.

`playlistItems.list` and `videos.list` typically cost 1 quota unit per call. A project commonly starts with 10,000 units/day; verify current quota in Google Cloud. Quota resets at midnight Pacific time. One page and one detail batch cost approximately 2 units per 50 videos. A private playlist cannot be read by this API-key-only importer; ask its owner to make it accessible or supply a small catalog of **real, independently verified** IDs and metadata in the documented schema. OAuth is outside this prototype. Do not scrape or bypass restrictions.

Missing key, inaccessible/missing playlist, quota/403 denial, timeout/network errors, malformed responses, and zero eligible clips all fail with diagnostics and preserve the prior catalog. Metadata embeddability is only a point-in-time signal: region, age, device and later privacy changes can still prevent playback.

### Troubleshooting API access (HTTP 403)

The importer prints a recognized Google/YouTube `reason` with instructions. For an IP restriction error, it also reports **Google's observed caller IP** when the response supplies a valid IP literal. Raw API messages, project identifiers, request URLs and key values are never printed. Check **the Google Cloud project that owns your key**, selected in the Console's project picker; enabling the API in a different project does not help this key.

The importer sends the key as the **`key` query parameter** documented in [Google's official YouTube discovery specification](https://github.com/googleapis/google-api-nodejs-client/blob/main/discovery/youtube-v3.json). Earlier revisions used only an `X-Goog-Api-Key` header. If IP-block errors have changed to an unspecified/generic 403 or an unregistered-caller error, pull the latest `main` and retry before changing more key restrictions. URLs and low-level exceptions containing the key are never logged; do not share request URLs or enable HTTP tracing with a real key.

| Reason                                               | Action in Google Cloud Console                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SERVICE_DISABLED` / `accessNotConfigured`           | APIs & Services → Library → YouTube Data API v3 → Enable. Wait a few minutes, then retry.                                                                                           |
| `API_KEY_SERVICE_BLOCKED`                            | APIs & Services → Credentials → your key → API restrictions → allow YouTube Data API v3. Save.                                                                                      |
| `API_KEY_HTTP_REFERRER_BLOCKED`                      | The CLI is not a website. Use a separate CLI key restricted to YouTube Data API v3 and, when stable, your outbound public IP.                                                       |
| `API_KEY_IP_ADDRESS_BLOCKED` / `ipRefererBlocked`    | Check application restrictions. The allowed IP must match the computer's outbound public IP; VPN/proxy use can change it. Website/referrer rules do not work for this Node CLI.     |
| `API_KEY_INVALID` / `keyInvalid` / `API_KEY_EXPIRED` | Update the key in your ignored `.env` or existing exported `YOUTUBE_API_KEY`. An exported value takes precedence over `.env`.                                                       |
| `playlistItemsNotAccessible`                         | Verify playlist ID/visibility. Private playlists require owner-authorized OAuth, which this importer does not support.                                                              |
| Quota exhausted                                      | Review YouTube Data API v3 quota in that project; wait for reset or request appropriate quota.                                                                                      |
| `unspecified`                                        | Google supplied no recognized specific reason. Check the API metrics/errors in that project and the key restrictions. Share only the sanitized diagnostic, never the key or `.env`. |

Retry with `npm run import:playlist`. A 403 alone does not establish that the playlist is private or that the network allowlist is blocking access.

`CREDENTIALS_MISSING` means the service did not recognize a credential; verify the latest importer and its printed credential source. `forbidden` is a generic denial, not proof of a private playlist or any particular restriction.

If an IP update does not fix `API_KEY_IP_ADDRESS_BLOCKED`, use the **Google-observed caller IP** from the latest importer output. An external IP-check site can take a different route than requests to Google. Add the exact observed address to the key's application restrictions; keep the API restriction set to YouTube Data API v3. Do not add guessed networks or broad IP ranges. If Google provides no valid IP or reports an empty caller IP, the importer says so rather than inventing an address.

The command also prints **Credential source** without showing the key. If it says **existing YOUTUBE_API_KEY environment variable**, that binding takes precedence over `.env`; make sure you edited the key actually being used. To intentionally use `.env` instead, remove that variable in the current shell before rerunning (`unset YOUTUBE_API_KEY` in Bash/zsh, `Remove-Item Env:YOUTUBE_API_KEY` in PowerShell, or `set YOUTUBE_API_KEY=` in Windows Command Prompt). Keep your desired key in ignored `.env`; do not paste it into commands or logs.

### Classification and corrections

`scripts/categorize.ts` documents `keywords-v1`. Normalize case/punctuation; match whole words/phrases once per field. Each title match scores 2, description match 1, multi-word phrase weights are doubled; assign every topic reaching 2. Unmatched clips are `uncategorized` and eligible for Surprise Me. This is a heuristic, not a semantic or scientific verification.

`data/category-overrides.json` maps an actual 11-character video ID to an array of `sleep`, `brain-health`, `finance`, or `uncategorized` alone. Overrides **replace** automatic tags and are reapplied on every import. Duplicate tags are removed; invalid overrides stop the import. `surprise-me` is never stored as a clip category.

## What the prototype does

- **Home:** Sleep, Brain Health, Finance and Surprise Me cards, with disabled choices for empty pools. Surprise Me includes uncategorized clips.
- **Playback:** Original imported title and channel attribution; a visible, standard YouTube player; Save/Unsave, Replay, Play Another, Home and Open on YouTube. Loading, ended, blocked-autoplay, slow/unavailable player and restricted-video states have recovery controls. Ending a clip never draws the next one automatically. Leaving or changing clips destroys the old player.
- **Saved Clips:** Local favorites with a count, direct playback and explicit removal. Catalog-missing favorites keep their stored title and video ID. Opening a favorite and Replay never consume a random draw. Play Another from a saved clip uses Surprise Me.
- **No repeats:** A Fisher–Yates shuffled deck per pool. Every eligible ID is drawn before reshuffling; avoid the last ID at the next cycle boundary when possible. Pools are independent, so the same video can appear in a topic and Surprise Me. A single-video pool necessarily repeats. Catalog changes remove ineligible IDs and append newly eligible IDs without unnecessarily restoring already-drawn clips.
- **Navigation:** Hash-based playback URLs survive reload without drawing again; browser back/forward and invalid/missing routes have recovery behavior. No server rewrite rules are required for hash routes.
- **Design:** Responsive cream/sage surfaces, distinct category cards, local fonts and SVG icons, visible focus, semantic landmarks, live feedback and reduced-motion support. The player has a 200px minimum height even on a small phone.

### Storage and privacy

Favorites use `life-wisdom:favorites:v1` (`schemaVersion: 1`, `favorites` array of `{id,title,savedAt}`). Decks use `life-wisdom:queues:v1` (`schemaVersion: 1`, `pools` object containing `known`, `remaining`, `last` per pool). Only browser/device-local metadata is saved; no accounts, analytics, backend or cloud sync. Storage is origin-specific (a different host or port has a different collection). Corrupt/unsupported data or quota/security errors show a warning and fall back to in-memory behavior. Clearing browser data clears local saves/history. Missing catalog entries do not clear favorites.

YouTube's external API/player loads only after opening a clip. The browser makes no YouTube **Data API** requests and never receives the developer key. YouTube may collect data under its own policies when its player loads. No video or audio is extracted, downloaded, cached, or played in the background by the app. This site does not independently verify medical/financial/scientific advice or guarantee clip length or playback availability.

### Catalog contract and verified manual fallback

`data/clips.json` is validated at runtime and before importer writes. It has `schemaVersion: 1`, the fixed `playlistId`, `importedAt` (ISO timestamp or `null` before import), `classifierVersion`, and `clips`. Each clip has a unique real 11-character `id`, original `title`, `description`, `channelTitle`, HTTPS `thumbnailUrl` or `null`, nonnegative `durationSeconds` or `null`, nonnegative integer playlist `position`, deduplicated `categories`, and boolean `embeddable`.

If the playlist is inaccessible, a developer may manually supply a **small, independently verified** catalog using that contract, preserving accurate metadata/source attribution and checking official embed availability. Use `classifierVersion: "manual-verified-v1"` and an accurate verification timestamp. Never replace production data with synthetic test fixtures or claim manual entries came from a successful playlist import. The app displays imported metadata as text, never HTML.

## Tests and build verification

```sh
npm test                 # Vitest: classifier, importer, decks, storage and React/player interactions
npm run check            # TypeScript, including importer and tests
npm run build            # TypeScript + Vite; static output in dist/
npm run test:browser     # Chromium flows, keyboard/focus, layouts, axe accessibility scans
npm run format:check
```

Browser tests use `/usr/bin/chromium` when available; set `CHROMIUM_PATH` for another installed Chromium binary. Otherwise install Playwright's Chromium with `npx playwright install chromium` (and its required system libraries). The browser runner starts its own local Vite server on port 4173. It requires permission to bind local sockets and launch Chromium. Tests intercept the catalog module and provide a test-only player double. They verify the app's controls and lifecycle, **not live YouTube playback**. All fixture IDs and titles are explicitly synthetic and remain under `tests/`; no fixtures ship in production. The empty-state test remains valid after real imports. `playwright-core` is pinned to match the test runner so axe and Playwright share compatible types.

Responsive checks cover widths **320, 390, 768 and 1440px**, horizontal overflow, the player's minimum dimensions, Home/Playback/Saved states, and automated accessibility scans. Screenshots go to ignored `test-results/`. Automated checks supplement, rather than replace, a real-device and screen-reader review.

For a real playback smoke check after importing: choose each category; press play in YouTube; Save, Replay, Play Another, Home, Saved Clips; reopen and reload a favorite; confirm playback and local persistence. An unavailable or restricted clip must retain Open on YouTube and Play Another recovery. Do not assume an API's embeddable flag guarantees regional playback.

## Current integration status

The import command exits with an actionable **Missing YOUTUBE_API_KEY** diagnostic when no key is provided. No source metadata was verified, and the production catalog remains empty. Importer behavior is tested with mocked HTTP, and the player controls/lifecycle with a mocked official-API interface. **Live playlist import and live media playback remain unverified.** Complete the numbered API setup to populate the collection, then perform the real-playback smoke check.

The earlier cloud filesystem and local-only commits were absent on November 13, 2026. This prototype was reconstructed from the implementation recorded in the conversation and revalidated before pushing. The new commit does not preserve the original `c609ef7` history. See `VALIDATION.md` for current evidence.
