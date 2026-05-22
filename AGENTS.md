# nuncio — Agent Context

## Goal
Phase 5 intelligence upgrades (recent activity, company enrichment, tone matching, sender brief memory, script A/B variants), Sentry error monitoring, cinematic entrance/Foley, and responsive email templates.

## Constraints & Preferences
- Next.js App Router with Turso (SQLite) or file-based storage providers; provider selected by `TURSO_DATABASE_URL` or `NUNCIO_DATA_DIR`
- Resend for transactional email; `RESEND_API_KEY` controls send vs. console-log fallback
- ElevenLabs `generateSoundEffect()` at `/v1/sound-generation` — accepts `text`, `duration_seconds`, `prompt_influence`
- `fetchRecentActivity()` uses TinyFish Search API for Twitter/X and LinkedIn recent posts
- All queue/auth functions are `async`; use `getBatchStorageProvider()` / `getTokenStorageProvider()`
- Coolify deploy via `ssh nuncio-vultr 'curl …'` to localhost:8000; `gh auth switch --user udirobert` before push
- Sentry DSN set on Coolify via env vars API; `SENTRY_DSN` activates `@sentry/nextjs` v10
- `WorkspaceAccount` extended with `lastSenderBrief` and `lastSenderName`
- Cinematic entrance generated in build pipeline as `data:audio/mpeg;base64` URL alongside soundscape; played on user click in `/v/[id]` before video starts
- Email templates use inline-string base template with full `<html>` wrapper, `<style>` block, and mobile-first media queries

## Key Decisions
- Recent activity + company enrichment fire **after** synthesis (not before), keeping enrichment lightweight
- Script variants use **single LLM call** (not two) to save cost and time
- A/B variants default to **off in quick mode** — only advanced mode shows the picker
- Cinematic entrance generated **non-blocking** (try/catch) like soundscape — build succeeds even if ElevenLabs fails
- `WorkspaceAccount.lastSenderBrief` persisted server-side rather than localStorage for cross-device continuity
- Sentry configured as **opt-in** — no-op until `SENTRY_DSN` env var is set
- Cinematic entrance stored as data URL (same pattern as soundscape) to avoid separate file upload step
- Email templates use full HTML document with `<style>` block for better email client compatibility and responsive layout

## Recent Commits
- `35bd035` — cinematic entrance integration + responsive email templates

## Next Steps
- Multi-language delivery — auto-detect target language, offer translation in studio UI
- Studio simplification — progressive disclosure of Hook Engine complexity (Phase 7)
- Batch route `await` fix (included in last commit)

## Relevant Files
- `src/lib/elevenlabs.ts`: `generateCinematicEntrance()`, `ENTRANCE_PROMPTS` per vibe
- `src/lib/email.ts`: `wrap()` with responsive `<style>` block, `sendMagicLinkEmail()`, `sendBatchCompleteEmail()`
- `src/app/v/[id]/page.tsx`: Cinematic entrance AudioContext playback on play button click
- `src/app/api/studio/build/route.ts`: Cinematic entrance generation in build pipeline
- `src/app/api/studio/email/route.ts`: `cinematicEntranceUrl` in share record
- `src/app/studio/studio-client.tsx`: `cinematicEntranceUrl` passthrough in email capture payload
- `src/lib/creative/melius-provider.ts`: `StudioBuildResult.cinematicEntranceUrl`
- `src/lib/artifacts.ts`: `ShareRecord.cinematicEntranceUrl`
- `next.config.ts`, `sentry.*.config.ts`, `instrumentation.ts`, `global-error.tsx`: Sentry setup
- `src/lib/claude.ts`: `generateScriptVariants()`, `ScriptVariants` type
- `src/lib/tinyfish.ts`: `fetchRecentActivity()`, `enrichCompany()`
- `src/app/api/account/brief/route.ts`: Sender brief memory GET/PATCH
