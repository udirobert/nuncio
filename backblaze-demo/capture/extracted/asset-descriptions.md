# Asset Descriptions

Captured fresh 2026-07-31 from production `https://nuncio.persidian.com`
(vision-key unavailable; descriptions from DOM structure + visible text).

## Screenshots (capture/screenshots/)

- **landing-hero.png** — 1920x1080 above-fold landing: headline "Brief an agent. Get personalised creative." on the cream canvas, studio teaser, "AI-powered · personalised video" badge.
- **landing-full.png** — 1920x1982 full landing page including pipeline explanation sections and footer.
- **studio-full.png** — 1920x1412 studio page (public state): "Paste a social URL" modal step, Profile URL input with "Try: Sundar Pichai / Vercel CEO" chips, name + brief fields, "Advanced settings", "Research & write script" CTA, voice brief panel ("Talk to your video agent" / Speech Engine), Account → Reason → Review → Send stepper.
- **share-full.png** — 1920x1152 share page for the real Elad Gil prospect (/v/b46b1f69-3f0): "Hey Elad Gil", "Nuncio Agent recorded this for you", video player region, "Say thanks" / "Send one back" CTAs, "This video was researched, written, and rendered by AI — personalised specifically for you.", footer "Powered by nuncio — your intelligent emissary".
- **share-top.png** — 1920x1080 top portion of the same share page (above-fold framing).

## Video (capture/assets/)

- **elad-gil-video.mp4** — genuine HeyGen-rendered personalized outreach video for prospect Elad Gil ("Nuncio Agent" sender), the real output of nuncio's pipeline. The avatar speaks directly to camera. Used for the pipeline-act payoff where the narrator ducks out and the avatar speaks.

## Fonts (capture-share/assets/fonts/, capture-studio/assets/fonts/)

Self-hosted woff2 subsets captured from production (Next.js font hashing).
Families served: Geist (variable, 100–900), Geist Mono (variable, 100–900),
Instrument Serif (400, normal + italic). Staged into assets/fonts/ for
deterministic render.

## Brand tokens (capture/extracted/tokens.json)

- Colors: cream `#FAF9F6` (canvas), ink `#1A1A1A` (text), ink-muted `#A3A3A3`,
  cream-dark `#F0EDE8`, accent `#4A3AFF`, warm `#C4704B` (from app theme).
- Fonts: Geist (body), Geist Mono (mono), Instrument Serif (display).

## Notes

- The captured share page (share-*.png) points at an EXPIRED HeyGen signed URL —
  a real, verified artifact from before the B2 layer existed. Use it for the
  "generative media has a half-life" beat.
- The post-B2 share page (provenance badge "Generated with Genblaze" + provider
  chips + "View generation proof") is reconstructed from the real component at
  src/app/v/[id]/page.tsx lines 305–343, since no live B2-persisted share exists
  yet. Reconstruction is frame-faithful to the component markup.
