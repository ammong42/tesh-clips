# John Tesh Life Tips — Codex Implementation Plan

Read `REQUIREMENTS.md` for source of truth and `AGENTS.md` for persistent working rules. Build a **usable MVP** first. Do not delay implementation for avoidable questions; document reasonable implementation choices.

## Completion protocol
At the end of each milestone: (1) run relevant validation, (2) fix obvious defects, (3) report files changed, tests run, and remaining blockers. Don't mark an integration as working without testing it. No invented playlist entries. Use small, reviewable commits if using git.

## Milestone 0 — Scaffold and developer experience

**Tasks**
- Initialize a lightweight Vite/React/TypeScript project (or comparable architecture if strongly justified).
- Create npm scripts for `dev`, `build`, `test`, `import:playlist` and `check` (typecheck/lint as appropriate).
- Add README, `.gitignore`, `.env.example` with **placeholder** `YOUTUBE_API_KEY=` (no real key).
- Add `data/clips.json` as an empty schema-valid catalog initially; optional tests use synthetic **clearly-labeled** fixtures in test files.
- Define shared catalog TypeScript types and runtime validation.

**Done when:** npm install, dev server, build and basic tests work; no secrets in git.

## Milestone 1 — Importer + automatic categories

**Tasks**
- Add a Node CLI importer reading `YOUTUBE_API_KEY` from environment. Read `.env` locally if using an appropriate dependency; never echo the key.
- Use `playlistItems.list` with pagination at 50 results per page. Where feasible batch `videos.list` (50 IDs per batch) to get duration/embeddability/current metadata.
- Robustly handle missing/private/deleted/duplicate entries and network/API errors.
- Keyword-based multi-category classifier using title and description (title weighted more heavily). Provide `uncategorized` fallback and clear category override mapping keyed by ID.
- Validate and atomically write `data/clips.json`; print import summary, skip counts and diagnostics. Preserve prior catalog if import fails.
- Document manual refresh command. Never put API key in frontend.

**Done when:** importer tests with mocked HTTP cover pagination, valid records, no-data, errors, bad responses, and overrides. Actual import attempted only if credentials/environment permit it; explicitly report otherwise.

## Milestone 2 — Selection and storage core

**Tasks**
- Implement pure, unit-testable shuffled deck logic for all four selection pools; save per-pool remaining IDs and last drawn ID.
- Avoid immediate repeat across cycle boundaries where pool size > 1.
- Reconcile persisted queues when catalog changes without destroying favorites or drawn progress unnecessarily.
- Implement favorites as persisted IDs with metadata snapshot, with versioned keys and parsing/error fallback.
- Make saved-clip opening and Replay separate from random selection.

**Done when:** tests verify unique draws until exhaustion, pool independence, 0/1 clip handling, reload continuation, malformed storage and catalog refresh. Prefer injected deterministic RNG in tests.

## Milestone 3 — Home, playback and saved views

**Tasks**
- Build responsive Home: category tiles and saved navigation, with usable empty/catalog-unavailable messages.
- Build playback page with title, source attribution, category context, visible 16:9 YouTube player, Save/Replay/Play Another/Home.
- Embed with official IFrame API; initialize once and manage player lifecycle safely. Handle ready, ended, error, autoplay-blocked states. Never cover or hide required YouTube controls.
- Build Saved Clips list with save/remove and ability to reopen a specific clip without a random draw.
- User-facing prompts should communicate when playback requires clicking YouTube's play button.
- Add Open on YouTube link for failures.

**Done when:** no mocked UI controls; each button functions with a valid real video ID, or shows honest error/empty state. Test with fixture data for dev only if live catalog isn't accessible.

## Milestone 4 — Polish, accessibility and responsive behavior

**Tasks**
- Add visually distinct category cards, tasteful typography, spacing, mobile breakpoints and focus treatments.
- Verify 320–390 px small phone, tablet, and desktop layouts; player dimensions respect YouTube minimum.
- Review tab order, ARIA live messages, meaningful button labels, contrast, reduced motion.
- Add optional subtle loading skeletons; avoid distracting animation.

**Done when:** manual keyboard and responsive checks pass, and UI is coherent in all required states.

## Milestone 5 — Validation and handoff

**Tasks**
- Run `npm test`, `npm run build`, any `npm run check`, and report results.
- Manual smoke-test: choose each category, Surprise Me, save/unsave, Saved Clips, replay, another, home, reload, empty category, player error, and exhausted deck.
- Verify network/code has no public YouTube Data API key and does not extract audio.
- Update README with numbered setup: create Google Cloud project, enable YouTube Data API v3, create and appropriately restrict an API key for local CLI use, populate `.env`, import, run dev server, manual refresh.
- Confirm real playlist import status. If blocked, provide exact actionable failure and what user needs to supply; retain functional prototype with honest fixture/empty state.
- Summarize shipped scope and remaining limitations.

**Done when:** reproducible setup, passing automated checks, working UI, transparent import status.

## Codex starting instruction

> Read `REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md`, and `AGENTS.md` in full. Implement the MVP in milestone order, using the defined YouTube playlist as the intended source. Do not fabricate playlist content. Use an official visible YouTube embed, local persisted favorites, independently shuffled category decks, and a secure developer-run import command. Run tests and build, fix failures, and conclude with what works, what remains blocked, and exact setup steps. Do not ask for decisions already settled in the requirements.
