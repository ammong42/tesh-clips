# John Tesh Life Tips — Product Requirements & Technical Design

**Status:** Implementation-ready specification for an initial working prototype
**Date:** 2026-10-30
**Category revision:** 2026-11-18 — six topics plus a visually distinct Surprise Me selection; Finance removed.
**Primary source playlist:** https://www.youtube.com/playlist?list=PLPwjiJlz-ZBY
**Playlist ID:** `PLPwjiJlz-ZBY`

## 1. Product overview

Build a responsive, accessible website for discovering and revisiting short, helpful John Tesh videos on science-backed tips, life hacks, and practical advice. The experience should be *listening-oriented*, but playback must use a **visible, standard embedded YouTube video player**, not extracted audio.

A visitor chooses **Sleep**, **Brain Health**, **Longevity**, **Exercise**, **Food**, **Transformation Tuesdays**, or **Surprise Me**; the app randomly selects a clip from the chosen category; the visitor can save it, replay it, choose another without immediate repeats, or go home. Saved clips and selection history stay on the current browser/device, with no sign-in.

**Decisions already approved by the user (do not ask again):**
- Source: the playlist URL above.
- Use the **embedded YouTube player**, not an audio-only player.
- Categorize clips **automatically**; multi-category assignment is allowed.
- Store favorites **locally on the user's device** (browser localStorage).
- Don't repeat a clip within a category until that category has been exhausted.
- **One-time playlist import, manually refreshed**, not continuous syncing.
- Start with a **working prototype**, not deployment or a backend.

## 2. Goals, non-goals, success criteria

### Goals
1. A first-time visitor understands the six topic choices and the separate Surprise Me selection and can start a clip quickly.
2. The playback page clearly displays the actual title, category context, and visible YouTube embed.
3. Save/unsave, replay, next clip, and home all work reliably.
4. The site works without user accounts, an application server, or user-facing API credentials.
5. A developer can refresh the clip catalog using a documented local command.
6. Automated categorization is reproducible, editable, and never falsely claimed to be perfect.

### Out of scope for version 1
- User login, cloud data synchronization, analytics, personalization, subscriptions.
- Offline media playback, audio extraction, video downloading, background playback.
- AI model calls or API keys from the user's browser.
- Scheduled playlist syncing or automatic generation of transcripts.
- Mobile native apps, production hosting infrastructure, administration dashboard.

### Prototype acceptance summary
- Catalog imports from the configured playlist when API access is available, with actionable setup instructions and errors otherwise.
- All seven selections behave as specified with a populated catalog; no eligible clips shows a useful empty state.
- Saved clips survive reload in the same browser; playback history also persists.
- No repeat before exhaustion in each eligible category, including Surprise Me.
- Responsive layout; keyboard-accessible buttons and focus states; zero critical console errors.
- Tests cover the selection algorithm, classification, persistence validation, and important edge cases.

## 3. Information architecture and user flows

### Views

**Home**
- Product name (working title: **A Little Life Wisdom**; branding may be adjusted).
- Concise subtitle: "Discover something useful in just a minute." This is promotional copy, **not** a promise that every video is under one minute.
- Primary category choices: **Sleep**, **Brain Health**, **Longevity**, **Exercise**, **Food**, **Transformation Tuesdays**, **Surprise Me**. Surprise Me must be visually distinct from the six regular topic cards, with clear full-collection context.
- Saved Clips link/button with count when available.
- If the catalog is empty, show a friendly setup/empty state instead of broken controls.
- Categories with no eligible videos are visibly disabled or show an explanatory empty state.

**Playback**
- Back/Home affordance and selected category label.
- Actual video title and channel/creator if present in the catalog (do not invent or alter metadata).
- **Visible YouTube player**, prominently rendered, responsive 16:9 where space permits, obeying YouTube's minimum viewport rules.
- Action buttons: **Save Clip** / **Saved**, **Replay**, **Play Another**, **Home**.
- Save action provides clear feedback and does not interrupt playback.
- Show loading state until player ready; on error, show explanatory text with **Play Another** and **Open on YouTube** link.
- When the video ends, keep it displayed and allow Replay or Play Another; do **not** automatically choose a new random clip.
- Changing clips should avoid multiple simultaneously playing players.

**Saved Clips**
- List of favorites with actual title (and category labels/thumbnail if already in catalog).
- Selecting a saved clip opens playback directly; saved playback must **not** consume a random-pool draw.
- Unsave from the saved list and playback view.
- Saved clips that no longer exist in the imported catalog: preferably retain their stored video ID and title and show an unavailable/catalog-missing state, or remove them only through an explicit user action. Do not silently delete favorites.
- Empty state with a way home.

### Primary journey
1. Home -> choose a category.
2. Generate a valid random selection from that category (or all clips for Surprise Me).
3. Navigate to Playback with that clip and category context.
4. Choose Save, Replay, Play Another, or Home.
5. Saved Clips -> select a stored clip -> playback -> Home or Saved Clips.

### Navigation specifics
- Use client-side routing or simple view state; no requirement for a routing library.
- Back/Home should be predictable, including from a saved clip.
- Support direct/reloaded playback state gracefully; if the selected clip is unavailable or missing, show a recovery action rather than a blank page.

## 4. Categories and automatic classification

### Category keys
- `sleep`: sleep, rest, bedtime, circadian rhythms, insomnia, napping.
- `brain-health`: memory, cognition, focus, mental sharpness, learning, neuroscience.
- `longevity`: lifespan, healthspan, healthy aging, and living longer.
- `exercise`: exercise, workouts, movement, physical activity, fitness, and strength.
- `food`: food, nutrition, eating, meals, ingredients, and beverages.
- `transformation-tuesdays`: the explicitly named Transformation Tuesday/Transformation Tuesdays series in title or description, including joined hashtags; not generic transformation advice or a Tuesday mention. Clips may also receive topic tags.
- Finance is retired from the current taxonomy.
- `surprise-me`: a **selection mode**, not a stored clip category; its pool includes every playable catalog clip.

### MVP categorization implementation
- Use a **deterministic metadata-based classifier** in the local import pipeline; inspect video **title + description** (not video/audio content).
- Normalize text case and punctuation; score documented topic keyword/phrase matches, favoring title matches over description matches. Assign any matching categories above a modest, documented threshold.
- Allow **multiple categories per clip**. De-duplicate labels.
- If no category meets threshold, assign an explicit internal `uncategorized` label. These clips remain eligible for Surprise Me, not one of the six topic selectors.
- Optional editable override file such as `data/category-overrides.json` keyed by video ID. Overrides must be reproducible when refreshing the catalog; document whether entries replace or augment auto tags (recommend replace).
- Category changes preserve favorites and compatible existing queues. Ignore retired Finance queues; display old Finance-only catalog entries as uncategorized until reimport. Reject obsolete Finance overrides with instructions to edit/remove them.
- Retain classifier version and/or categorization method in import metadata so a refresh can be diagnosed.
- Do not assert semantic accuracy. AI-based categorization can be added in a future phase only via an opt-in **local/offline import-time** provider configuration and without putting model keys in the web app.
- Classifier unit tests must cover strong category matches, multi-label clips, unmatched clips, duplicates, and overrides.

## 5. Randomization and listening history — critical behavior

### Selection policy
- Track a persistent **per-pool randomized queue** of video IDs for each of `sleep`, `brain-health`, `longevity`, `exercise`, `food`, `transformation-tuesdays`, and `surprise-me`.
- On first selection for a pool, create a **uniformly shuffled deck** of all currently eligible catalog IDs; draw/pop one ID on each *new random selection*.
- No ID may be drawn again within the same pool until all eligible IDs in that pool have been drawn.
- Once exhausted, create/shuffle a fresh deck. Where pool size > 1, avoid selecting the last randomly drawn clip as the immediate first clip of the next cycle (if possible by swapping deck positions).
- `Replay` is **not a new draw** and never advances the deck.
- Opening a saved clip **does not advance** any deck.
- Each pool has its own history. Therefore a clip may appear once in Sleep and once in Surprise Me; the guarantee is per pool, not global.
- Changing categories doesn't clear the previous category's queue.
- Store queue state and recent-last ID under a versioned localStorage key.
- After a catalog refresh, reconcile queues: discard IDs not eligible in that pool, avoid introducing duplicates, append newly eligible IDs in random order, and preserve previously drawn progress where possible. A catalog refresh must not reset favorites.
- If a pool has exactly one clip, repeating that single clip is permitted on subsequent new selections. If zero, show an empty state.
- All operations should be deterministic and easy to unit-test with an injected RNG or seeded test fixture.

### Privacy/storage
- Use localStorage for favorites, draw queues and any optional view settings. No cloud upload.
- Validate stored values and handle parse errors, schema changes, quota/security exceptions, and disabled storage without crashes. If unavailable, continue with in-memory state and explain that persistence is unavailable.
- Namespace/version keys, e.g. `life-wisdom:favorites:v1`, `life-wisdom:queues:v1`.
- Store **minimal** favorite metadata, at least video ID and saved timestamp; optionally title snapshot for deleted-catalog cases.
- Do not persist YouTube access tokens or API keys in localStorage.

## 6. Playlist import and manual refresh

### Source of truth
`https://www.youtube.com/playlist?list=PLPwjiJlz-ZBY`

**Important current validation status:** The playlist's video count, visibility, titles, durations, and embeddability have **not** been verified. Do not fabricate videos, IDs, or categories. If the playlist cannot be fetched, show and document the blocker and support a clearly labeled sample fixture for UI development without pretending it is actual John Tesh content.

### Proposed architecture
- A **local developer-side Node.js script** (e.g. `npm run import:playlist`) fetches playlist data and writes `data/clips.json`; this is an intentional manual action.
- Read `YOUTUBE_API_KEY` from the **local environment** or `.env` excluded from git. Never embed API keys in shipped web JavaScript or commit `.env`.
- Use YouTube Data API v3 `playlistItems.list` with `part=snippet,contentDetails`, `playlistId=PLPwjiJlz-ZBY`, `maxResults=50`, following `nextPageToken` to retrieve all pages.
- For richer details and embeddability, batch `videos.list` for up to 50 video IDs per call with `part=snippet,contentDetails,status` where supported. Examine `status.embeddable` and `contentDetails.duration`; don't claim every video is playable merely because it exists in the playlist.
- Skip/flag removed, private, missing, invalid video IDs, duplicates, and non-embeddable videos. Record counts/reasons in a local import report, without exposing secrets.
- Keep original title, description, channel title, thumbnail URL (if available), duration seconds (if known), video ID, category tags, and source playlist position. Preserve source attribution.
- Import is **atomic**: validate complete catalog, write temporary file, then replace. If import/API fails, preserve existing good catalog rather than wiping it.
- Make repeat imports idempotent, stable in ordering, with override support.
- Document quota limits, API enablement steps, and permissions needed for access. Don't scrape YouTube pages or use `yt-dlp` as the official import path.
- If the playlist is private or inaccessible via API key, provide a clear error and a developer-documented fallback (e.g., manually provide a small catalog of **real, verified** video IDs) rather than silently bypassing access restrictions.
- A manual "refresh" in MVP means **rerun the local import script and reload/rebuild the website**, not an unauthenticated public UI button that calls YouTube Data API.

### Catalog example shape (schema illustration, not real video data)
```json
{
  "schemaVersion": 1,
  "playlistId": "PLPwjiJlz-ZBY",
  "importedAt": "2026-10-30T00:00:00.000Z",
  "classifierVersion": "keywords-v2",
  "clips": [
    {
      "id": "EXAMPLE_ONLY_NOT_A_VIDEO_ID",
      "title": "Illustrative sleep tip title",
      "description": "Illustrative description",
      "channelTitle": "Illustrative channel",
      "thumbnailUrl": null,
      "durationSeconds": 75,
      "position": 0,
      "categories": ["sleep"],
      "embeddable": true
    }
  ]
}
```
**Never distribute the example clip as production catalog data.** Use separate synthetic fixtures for tests and clearly indicated demos.

### Clip length decision
The current requirements do **not** specify a duration cutoff. **Import all eligible playlist videos regardless of duration** for MVP. Do not assume the earlier unrelated two-minute playlist-filtering request applies to this new playlist. Provide optional duration reporting, with a configurable future limit if desired.

## 7. YouTube player behavior and compliance

- Use the official **YouTube IFrame Player API** (or a straightforward official embed with necessary controls).
- Keep the video visibly presented in the active view, with a responsive player that satisfies YouTube's minimum viewport size (at least **200×200 px**; a larger 16:9 display is preferable).
- Do not obscure, manipulate, or strip player branding, standard controls, advertising, or required links/metadata.
- Do not extract, isolate, download, cache, or stream separate audio; do not implement hidden or background playback.
- Playback may be blocked until the viewer interacts due to browser autoplay policy. Prefer **select clip on click, then allow playback via the player's play control** or a user-initiated action. Show a readable prompt if autoplay is blocked.
- Use `YT.PlayerState.ENDED` to offer replay and another clip; don't assume control of YouTube's own related-video UI is possible.
- `Replay` should use `seekTo(0, true)` and `playVideo()` (or equivalent) for the same clip; handle player-not-ready states.
- `Play Another` should load the next selected video ID via `loadVideoById` or safe player reconstruction, based on current readiness.
- Handle `onError` and `onAutoplayBlocked` where available. Errors may include restricted videos, unavailable embeds, or missing videos; offer Open on YouTube and Play Another.
- Provide a real `https://www.youtube.com/watch?v=...` link for the current video. Treat YouTube as the playback authority.
- Never guarantee that every playlist item will play everywhere; region, device, age, privacy, and embed restrictions can change.

## 8. Visual and accessibility design

### Direction
- Calm, modern, clean, welcoming, and easy to use; content-first, not a flashy dashboard.
- Distinct selectable category cards with simple icons and readable labels.
- A primary accent color, neutral surface colors, generous whitespace and clear typography.
- Render Surprise Me separately from the six topic cards with a different visual treatment and an explicit all-topics label.
- Working title "A Little Life Wisdom" is provisional. Do not imply John Tesh endorses or operates this third-party prototype. Show accurate source attribution.
- Desktop centered content, mobile-first stacking. No horizontal scrolling on ordinary phone widths.

### Accessibility
- Semantic headings, landmarks, buttons, labels, and keyboard navigation.
- Visible focus states; minimum comfortable tap targets (~44×44 CSS px target).
- Sufficient color contrast and screen-reader announcements for saved/unsaved, errors, and exhaustion states.
- Respect reduced-motion preferences; don't rely on animation for meaning.
- Any text included in the UI should be accurate; avoid claiming every tip is scientifically verified without independent review.

### States to design
- Loading catalog, loading player, player-ready, ended, player-error, no clips for category, zero catalog, empty favorites, saved favorite, persistence unavailable.

## 9. Technical architecture (recommendation, not a product requirement)

Preferred lightweight stack: **Vite + TypeScript + React** for maintainability, plus **Node.js import script** and **Vitest** (or comparable). Static hosting compatible. Avoid global state libraries, auth packages, and UI component frameworks unless justified.

Suggested structure:
```text
/
  AGENTS.md
  REQUIREMENTS.md
  IMPLEMENTATION_PLAN.md
  README.md
  package.json
  .env.example
  .gitignore
  data/
    clips.json                  # generated real catalog after import, safe to commit
    category-overrides.json     # editable developer overrides
  scripts/
    import-playlist.*
    categorize.*
  src/
    main.*
    App.*
    components/
    pages/
    lib/
      catalog.*
      categories.*
      randomDeck.*
      storage.*
      youtubePlayer.*
    styles/
  tests/
```

Decoupling: `importer -> catalog JSON -> category selector -> random deck -> player UI`; favorites are independent of queue state. Browser runtime should make **no YouTube Data API calls**; it only loads already-imported JSON and the official player. A local dev server is expected; opening `index.html` directly via `file://` is not a requirement.

## 10. Detailed acceptance criteria and edge cases

**C01 — Import:** With a valid API key and accessible playlist, command produces a valid, nonempty catalog of unique real video IDs (if the playlist has playable clips), classification tags, and an import summary. It paginates beyond 50 items.

**C02 — Import failure:** Missing key, 403 quota/access denial, 404 playlist, empty playlist, network failure, malformed API response each produces helpful diagnostics; existing catalog stays intact.

**C03 — Home:** Six topic choices and a visually distinct Surprise Me control are visible and keyboard accessible (empty pools may be disabled). Surprise Me uses all eligible clips (including uncategorized).

**C04 — Classification:** Title/description rules produce stable multi-label assignments and explicit uncategorized results; overrides survive refreshes.

**C05 — Random deck:** For three clips in a pool, three successive draws are unique. Fourth draw starts a new cycle; if possible, fourth ID differs from third. Tests also cover 0 and 1 clips.

**C06 — Pool independence:** Draws in Sleep do not alter any of the other six selection pools.

**C07 — Replay:** Restarts current video without drawing another ID.

**C08 — Another:** Draws a new item from the currently selected pool and updates title/video ID/player; stops old video.

**C09 — Saved clips:** Save toggles state consistently on playback and Saved Clips; persists across reload in same origin/browser.

**C10 — Saved playback:** Opening a saved clip does not increment/draw from any random queue.

**C11 — Reload:** Malformed or absent localStorage does not crash app. Queues reconcile on catalog change.

**C12 — Error handling:** Player not ready, autoplay blocked, restricted/unavailable video, empty category and missing saved item have understandable recovery options.

**C13 — Responsive/accessibility:** Usable on common phone and desktop viewports; keyboard and screen reader basics work; obvious focus styling.

**C14 — Compliance:** Player visible, unmodified, no extracted audio, no hidden background playback, no embedded developer API key.

**C15 — Documentation:** README covers local setup, YouTube API key setup, import/manual refresh, running tests, data privacy and limitations.

## 11. Open assumptions and choices Codex may make

- **Do not block implementation waiting for aesthetic preferences**: choose a tasteful design, keep brand text easy to change.
- **No duration filtering** unless newly requested.
- If a saved clip is from a different category or opened directly, display its valid tags, and let Play Another default to Surprise Me unless a selected category context is already known.
- If no real playlist data is available during coding, create **clearly labeled synthetic test data only** and report real-import status candidly; do not fabricate that the playlist was successfully imported.
- The original user's phrase "plays audio clips" means a listening-first experience using visible videos; do not change to extracted audio.

## 12. Official references checked 2026-10-30

- YouTube Data API PlaylistItems.list: https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list
- YouTube IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
- YouTube embedded-player parameters: https://developers.google.com/youtube/player_parameters
- YouTube developer policy guide: https://developers.google.com/youtube/terms/developer-policies-guide
- YouTube API Services policies: https://developers.google.com/youtube/terms/developer-policies

**Source access caveat:** Direct external fetch of the supplied playlist was throttled during specification preparation. The playlist's actual contents must be verified during the real import step.
