# nuncio — Agent Context

## Goal
Phase 8 brand consistency, multi-channel distribution, ElevenLabs Speech Engine voice agent, and production hardening.

## Constraints & Preferences
- Next.js App Router with Turso (SQLite) or file-based storage providers; provider selected by `TURSO_DATABASE_URL` or `NUNCIO_DATA_DIR`
- Resend for transactional email; `RESEND_API_KEY` controls send vs. console-log fallback
- ElevenLabs for TTS (`textToSpeech`), sound effects (`generateSoundEffect` at `/v1/sound-generation`), and Speech Engine voice agent (`engine.attach()` on shared HTTP server)
- Speech Engine: `SPEECH_ENGINE_ID` env var activates the voice agent; `VOICE_PUBLIC_URL` sets the wsUrl; both packages: `@elevenlabs/elevenlabs-js` (server) and `@elevenlabs/client` (browser `Conversation.startSession`)
- `fetchRecentActivity()` uses TinyFish Search API for Twitter/X and LinkedIn recent posts
- Production server at `src/server/production.ts` — runs Next.js + Speech Engine WebSocket on the same HTTP server; started via `tsx src/server/production.ts` (the `start` script)
- Ensure correct `gh` auth profile before push; deploy via SSH to the production server (see `scripts/deploy-nuncio.sh`)
- Sentry DSN set on Coolify via env vars; `SENTRY_DSN` activates `@sentry/nextjs` v10
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
- Speech Engine voice agent uses `engine.attach()` on the same HTTP server as Next.js; conversation token generated via `POST /v1/convai/conversation/token`; browser connects via `@elevenlabs/client` `Conversation.startSession({ conversationToken })`
- Voice overlay ("Brief with voice") is an alternative input channel in the studio; LLM extracts structured profile from natural conversation
- Nomenclature uses "AI-powered · personalised video" for badge, "Build video" for CTA, "Background audio" for soundscape selector
- Email gate captured on explicit render/share/download actions, not session start

## Recent Commits
- `dd25738` — HeyGen captions via v3 API + mode switch UX toast
- `ecd1c43` — captions toggle + circular flow on advanced ready screen
- `4b430b0` — TokenRouter (MiniMax-M3) free LLM fallback provider
- `b45e3bc` — LLM provider fallback chain + dead-end UX improvements
- `564e049` — close dead-ends: dashboard CTA, share page reply, error state, post-login redirect
- `24b066f` — dashboard shows past videos + circular flow on ready screen
- `e8509b7` — overhaul build-wait screen + fix credit tests
- `56d8d84` — fallback to email upsert when workspace not found in Turso
- `22a1390` — credits use Turso as single source of truth
- `517d283` — studio simplification (Phase 7)
- `8ddd233` — multi-language delivery
- `35bd035` — cinematic entrance integration + responsive email templates
- `009f120` — phase 8: nomenclature, batch link from studio, footer, studio polish
- `ccaae6e` — speech engine integration: voice agent, overlay UI, conversation token endpoint, LLM prompt, standalone voice server

## Next Steps
- Voice agent: wire production server, test end-to-end, create submission video for ElevenLabs Hack #10 (closes May 28)
- Multi-language delivery — auto-detect target language, offer translation in studio UI
- Multi-channel distribution — link batch from studio ready page (done)
- **Studio mode unification** — merge Quick and Advanced modes into a single progressive-disclosure component. Currently two separate UIs (`QuickInput` vs inline advanced form) with a `quickMode` toggle. Switching feels abrupt and users fear losing work. Fix: one component with collapsible "More options" section. The Quick mode IS the advanced mode with extra fields hidden. Eliminates mode-switching anxiety entirely. Current toast notification ("your brief is preserved") is a band-aid.
- **Script quality** — profile synthesis and script generation rely on LLM fallback chain (Featherless → Venice → TokenRouter). The `fallbackScript()` heuristic produces raw data dumps when all LLM providers fail. Improve fallback to clean hooks and generate meaningfully different variants.
- **Band agent progress events** — researcher agent posts intermediate progress events to activity bridge during enrichment, but WebSocket instability may cause gaps. Consider adding server-side progress events from the pipeline route as a fallback.
- **Credit spend transparency** — show credits spent during the current session on the ready screen (currently only shows remaining balance).

## Relevant Files
- `src/lib/voice-agent/prompt.ts`: LLM prompt for conversation-to-structed-profile extraction
- `src/lib/voice-agent/types.ts`: `VoiceExtractedProfile`, `ConversationTurn` types
- `src/server/production.ts`: Production server combining Next.js + Speech Engine WebSocket
- `src/voice-server/index.ts`: Standalone voice server (dev/separate deployment)
- `src/components/voice-overlay.tsx`: React voice conversation overlay using `@elevenlabs/client`
- `src/app/api/studio/voice/token/route.ts`: Generates conversation token via ElevenLabs ConvAI API
- `src/app/api/studio/voice/init/route.ts`: Returns WebSocket URL info
- `src/lib/claude.ts`: `generateScriptVariants()`, `ScriptVariants` type
- `src/lib/tinyfish.ts`: `fetchRecentActivity()`, `enrichCompany()`
- `src/lib/elevenlabs.ts`: `generateCinematicEntrance()`, `textToSpeech()`, `generateSoundEffect()`, `VIBE_PRESETS`
- `src/app/studio/studio-client.tsx`: Studio UI with "Brief with voice" button, progressive disclosure, etc.
- `next.config.ts`, `sentry.*.config.ts`, `instrumentation.ts`, `global-error.tsx`: Sentry setup
