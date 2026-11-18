# Codex Agent Instructions — John Tesh Life Tips

## Mission and precedence
Implement a working, maintainable prototype for the John Tesh clip-discovery website. **`REQUIREMENTS.md` is the product source of truth.** `IMPLEMENTATION_PLAN.md` supplies milestone sequence. If they conflict, prioritize approved user requirements in `REQUIREMENTS.md`; make implementation choices that are minimal and reversible. Follow any newer explicit user instructions.

## Non-negotiable product rules
- The source is `https://www.youtube.com/playlist?list=PLPwjiJlz-ZBY` (`PLPwjiJlz-ZBY`).
- Use a **visible official YouTube embedded player**; never extract audio, hide the player, download media, bypass YouTube controls, or implement background playback.
- Home offers **Sleep**, **Brain Health**, **Longevity**, **Exercise**, **Food**, **Transformation Tuesdays**, **Surprise Me**. Surprise Me draws from the entire catalog and is visually separate from the six topic cards.
- Transformation Tuesdays matches the explicitly named series in title/description (including hashtags); do not assign it to generic transformation advice or every Tuesday mention.
- Preserve existing favorites and valid pool history when categories change. Finance is retired; legacy Finance catalog tags become uncategorized if no active tags remain, and Finance overrides must be updated before import.
- Classify based on metadata automatically, supporting multiple labels. Unmatched clips may remain `uncategorized` and still appear in Surprise Me.
- Favorites and per-category no-repeat queues are persisted locally in the browser, no user accounts or backend.
- Avoid duplicate random selections within each category until that pool is exhausted. Replay or opening favorites must not consume a draw.
- Playlist import is an intentional **local manual refresh**, never a public browser sync.
- Start with a working prototype; do not build infrastructure or features beyond scope.

## Secrets and external APIs
- Use **YouTube Data API v3 from a developer-run Node script only**. Never expose `YOUTUBE_API_KEY` in frontend code, built assets, logs, commits, or sample output.
- Add `.env` to `.gitignore`, and a safe `.env.example` containing only placeholders.
- If no key or network access is available, fail the importer clearly, retain existing catalog, and continue UI development with synthetic fixtures explicitly labeled as such.
- Never invent actual video IDs, metadata, import success or embeddability.
- Don't scrape/download YouTube videos as a fallback.

## Engineering expectations
- Favor a small Vite + TypeScript + React app, Node importer, minimal dependencies and no server-side runtime for end users.
- Write testable pure modules for category classification, random decks, queue reconciliation, and persistence parsing.
- Handle malformed localStorage, exhausted/empty pools, unavailable videos, missing catalog data, and player errors without crashes.
- Update the actual player and title together when switching clips. Clean up listeners/player instances.
- Preserve actual YouTube metadata and attribution; do not claim the advice is medically/scientifically verified by the app.
- Accessible semantic controls, obvious focus, mobile-friendly layout, visible player.
- Use a local development server; file:// double-click support is not necessary.

## Definition of done
- `npm run build` and tests pass (or blockers are explicitly identified).
- All primary actions work: category draw, Save, Unsave, Replay, Play Another, Home, Saved Clips.
- History/favorites persist across reload in the same origin/browser (or display storage limitation).
- Playlist import supports pagination, safe failures and manual rerun.
- README contains real setup/test/import instructions and honest status of actual playlist access.
- No secrets or downloaded YouTube audio/videos in repository.

## Communication rules
- Do not ask the user to re-decide settled requirements.
- Make reasonable visual/implementation choices and record any important assumptions.
- After coding, provide concise results, tests executed, real integration status, and exact manual actions needed from the user (e.g., adding their own API key).
- Never say a feature has been tested if it has not.
