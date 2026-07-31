---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "One URL in, a personalized video out — every generated asset orchestrated by Genblaze and stored durably on Backblaze B2."
destination: youtube
aspect: 1920x1080
language: en
audience: Backblaze Generative AI Media Hackathon judges
length: 125s
angle: end-to-end demo following one real prospect
narration: yes
---

## Intent

A ~2-minute submission demo video for the Backblaze Generative AI Media Hackathon
(deadline 2026-08-04) presenting nuncio, a conversational SDR platform, as a
generative media app: one prospect URL flows through research → script →
personalized video render, with Genblaze orchestrating multi-provider media
(GMI Cloud thumbnails + ElevenLabs TTS and soundscapes) and Backblaze B2 as the
durable media store (private bucket, presigned URLs, SHA-256 hashing, S3
user-defined metadata, per-share asset manifests, Grove provenance proofs).
Follow one real prospect (eladgil.com) end to end. B2 and Genblaze are
co-protagonists, not footnotes. Tone: confident, precise, editorial — the app's
own cream/ink aesthetic with Instrument Serif display type, not generic
dark-mode terminal. Include a real dialogue moment: the rendered avatar (existing
demo-assets/elad-gil-video.mp4) speaks directly while the narrator ducks out.

## Assets

- ../demo-assets/elad-gil-video.mp4 — genuine personalized HeyGen render for the
  Elad Gil prospect; the avatar-speak payoff in the pipeline act.
- capture/ (this step) — fresh captures from https://nuncio.persidian.com:
  landing, studio, build-wait, ready screen, share page with provenance badge.
- ../public/screenshots/* — May screenshots, stale (pre-B2 share-page redesign);
  fallback only if a page cannot be captured fresh.

## Customizations

- Narrator: warm, confident female voice via ElevenLabs TTS (user supplies the
  API key; routed through $ELEVENLABS_API_KEY).
- Classical background music from the ElevenLabs Music API (solo piano/strings
  mood), ducked under the VO, swelling at act turns.
- Optional ElevenLabs sound effects on UI beats (typing, click, whoosh) —
  non-blocking.
- If time permits, live-generate the soundscape/thumbnail shown in the Genblaze
  act with the same key, so the on-screen output is real.

## Notes

- Judging criteria to satisfy: real-world utility, production readiness,
  meaningful B2 storage and data orchestration, meaningful use of Genblaze.
- Real, verifiable claims only: private B2 bucket with 7-day presigned download
  URLs; SHA-256 content hashing on every upload; S3 user-defined metadata
  (app, role, share-id, pipeline, content-sha256); per-share asset manifest
  (manifests/{shareId}/assets.json); single multi-step Genblaze
  Pipeline("nuncio-composite") chaining GMI Cloud seedream-5.0-lite (thumbnail)
  + ElevenLabs sound-fx (soundscape) + eleven_v3 (TTS) in one run with one B2
  sink and one canonical hash; Grove proof v2 anchoring content hashes, manifest
  URIs, and model versions; HeyGen video persisted to B2 via the same
  MediaStorageProvider (no HeyGen Genblaze adapter — stated honestly).
- Graceful degradation is a production-readiness point: unconfigured B2/Genblaze
  falls back without breaking the pipeline.
- Real run stats to cite: HeyGen render ~8 min; live Stripe checkout
  cs_live_a1qnZHAL... for $50 created by the autonomous agent from inside the
  NemoClaw sandbox; share page live at nuncio.persidian.com/v/b46b1f69-3f0.
- The repo's demo-video/ project belongs to a different hackathon
  (NVIDIA/Stripe, dark terminal style, 55s) — do not reuse its styling; only
  elad-gil-video.mp4 crosses over.
- Critical path with 3 days to deadline: captures and VO first, composition last.
