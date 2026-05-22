# nuncio — Agent Context

## Goal
Phase 5 intelligence upgrades (recent activity, company enrichment, tone matching, sender brief memory, script A/B variants), Sentry error monitoring, cinematic entrance/Foley, responsive email templates, multi-language delivery, and studio simplification (Phase 7).

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
- `517d283` — studio simplification (Phase 7)
- `8ddd233` — multi-language delivery
- `35bd035` — cinematic entrance integration + responsive email templates

## Next Steps
- Multi-language delivery — auto-detect target language, offer translation in studio UI
- Studio simplification — progressive disclosure of Hook Engine complexity (Phase 7)
- Batch route `await` fix (included in last commit)

## Relevant Files
- `src/lib/claude.ts`: `generateScriptVariants()`, `ScriptVariants` type
- `src/lib/tinyfish.ts`: `fetchRecentActivity()`, `enrichCompany()`
- `src/app/api/account/brief/route.ts`: Sender brief memory GET/PATCH
- `src/lib/elevenlabs.ts`: `generateCinematicEntrance()`, `ENTRANCE_PROMPTS` per vibe
- `src/lib/email.ts`: `wrap()` with responsive `<style>` block, `sendMagicLinkEmail()`, `sendBatchCompleteEmail()`
- `src/app/v/[id]/page.tsx`: Cinematic entrance + language badge + translate
- `src/app/api/studio/build/route.ts`: Build pipeline with language support
- `src/app/api/studio/email/route.ts`: Profile + language in share record
- `src/app/studio/studio-client.tsx`: Progressive disclosure UI, language selector, profile collapsible
- `src/lib/creative/melius-provider.ts`: `StudioBuildResult` with `language`
- `src/lib/artifacts.ts`: `ShareRecord` with `language`
- `src/lib/languages.ts`: Shared language constants
- `next.config.ts`, `sentry.*.config.ts`, `instrumentation.ts`, `global-error.tsx`: Sentry setup
