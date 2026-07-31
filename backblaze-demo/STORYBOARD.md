---
format: 1920x1080
duration: 125s
message: "One URL in, a personalized video out — every asset orchestrated by Genblaze and stored durably on Backblaze B2."
arc: Demo loop → mechanism/proof turn (B2) → orchestration turn (Genblaze) → proof + autonomous loop → close
audience: Backblaze Generative AI Media Hackathon judges
mode: collaborative
music: calm classical solo piano/strings, warm and unhurried, ducked under VO, swells at act turns
---

## Frame 1 — Cold open

- scene: A caret types eladgil.com into the studio URL field on cream paper; the cursor blinks; the submit button waits.
- duration: 8s
- poster: 5s
- transition_in: cut
- status: outline
- blueprint: typewriter-reveal
- voiceover: "Meet Nuncio. You give it one URL. You get back a personalized video."
- asset_candidates: capture/screenshots/studio-full.png
- src: compositions/frames/01-cold-open.html

Open cold on the input. The thesis lands by beat 2; this frame is pure setup +
tension. The ✱ coral spike kicker reads "✱ one url in". The URL types character
by character (eladgil.com), the caret blinks twice, then the CTA highlights.
Cream ground, Instrument Serif display. No logo yet — identity comes at close.

## Frame 2 — The thesis

- scene: A single Instrument Serif statement builds across the frame: "Not a video tool." swaps to "A conversational SDR." then a pipeline ribbon resolves beneath it.
- duration: 10s
- poster: 6s
- transition_in: crossfade
- status: outline
- blueprint: kinetic-type-beats
- voiceover: "It's not a video tool. It's a conversational SDR. Research, synthesis, script, render, delivery — autonomous."
- asset_candidates: (typography only)
- src: compositions/frames/02-thesis.html

The promise, stated once and clearly. Hard-cut token swap on the display line,
then the five pipeline stages self-assemble as a hairline ribbon under it — this
ribbon is the visual spine the whole demo travels along.

## Frame 3 — Research & synthesis

- scene: The studio screenshot sits in a browser-chrome frame; the agent-progress theater runs over it — research rows arrive and check off (TinyFish, Firecrawl, EXA), then a sender-brief card populates.
- duration: 12s
- poster: 7s
- transition_in: crossfade
- status: outline
- blueprint: agent-progress-theater
- voiceover: "Drop in a prospect. Three research providers build a profile. Recent posts. Company signals. Personalization hooks. The sender brief writes itself."
- asset_candidates: capture/screenshots/studio-full.png, capture/screenshots/landing-hero.png
- src: compositions/frames/03-research.html

Working-state theater. The camera holds on the real studio surface while a
receipt checklist cascades in and checks off, then the synthesized sender-brief
card resolves. Real provider names (TinyFish, Firecrawl, EXA) — judge-verifiable.

## Frame 4 — Script & render

- scene: A script card streams in (line by line), then the frame travels to the build-wait screen where a render progress meter fills over "HeyGen · ~8 min".
- duration: 12s
- poster: 8s
- transition_in: crossfade
- status: outline
- blueprint: prompt-type-submit-generate
- voiceover: "Then the script writes itself, and the avatar renders. HeyGen. About eight minutes, from prompt to a personalized video."
- asset_candidates: capture/screenshots/landing-full.png
- src: compositions/frames/04-script-render.html

The machine answers. Script lines stream into a hairline card, then a motivated
travel to the build screen where the render meter fills. The "~8 min" is a real
measured run time (number-lockup: Instrument Serif figure + mono unit).

## Frame 5 — The payoff (avatar speaks)

- scene: The real Elad Gil HeyGen render plays in a share-page frame; the narrator ducks out and the avatar speaks directly for a few seconds, then a lower-third resolves.
- duration: 14s
- poster: 8s
- transition_in: crossfade
- status: outline
- blueprint: device-surface-showcase
- voiceover: "This is real output. Watch. [avatar audio] Researched, written, and rendered by AI — personalized for this one recipient."
- asset_candidates: capture/assets/elad-gil-video.mp4, capture/screenshots/share-full.png
- src: compositions/frames/05-payoff.html

The emotional center. Frame the genuine avatar render in a share-page chrome
frame; the VO drops to two words then goes silent while the avatar talks (the
video's own AAC track). A lower-third resolves: "Real output · prospect: Elad
Gil". This is the dialogue moment and the proof that the pipeline produces real
media.

## Frame 6 — The turn (half-life)

- scene: A HeyGen signed URL is shown; a countdown ticks over it; the video player shows a broken/expired state; the link strikes through.
- duration: 10s
- poster: 6s
- transition_in: wipe
- status: outline
- blueprint: dataviz-countup
- voiceover: "But generative media has a half-life. Signed URLs expire. Twenty-four hours, and the video dies. Every share link. Gone."
- asset_candidates: (typography + reconstructed expired-URL artifact)
- src: compositions/frames/06-half-life.html

The problem we solve, and it is REAL — the captured June 30 share record points
at an expired files2.heygen.ai signed URL (verified Expires in the past). Show
the actual expired URL string, count it down, strike it. This is the hinge that
makes the B2 act matter.

## Frame 7 — The B2 act (the vault)

- scene: A Backblaze B2 bucket tree assembles (videos/ audio/ images/ traces/ manifests/); SHA-256 hashes tick in beside each object; S3 metadata chips pop; the dead link transforms into a presigned URL on a live share page.
- duration: 16s
- poster: 10s
- transition_in: crossfade
- status: outline
- blueprint: grid-card-assemble
- voiceover: "So Nuncio stores everything on Backblaze B2. Video. Audio. Thumbnails. Traces. Every object hashed, tagged, and indexed. The dead link becomes a private bucket — and a presigned URL."
- asset_candidates: capture/screenshots/share-top.png
- src: compositions/frames/07-b2-vault.html

The co-protagonist. The bucket tree self-assembles in a staggered cascade; each
object gets a SHA-256 hash (mono) + S3 user-defined metadata chip
(app / role / share-id / content-sha256). Then the transformation: expired link
→ presigned download URL → the live share page (real capture). Private bucket,
no public exposure. This is "B2 storage and data orchestration" made concrete.

## Frame 8 — The Genblaze act (the pipeline)

- scene: A warm-navy code surface shows Pipeline("nuncio-composite"); three .step() lines light up one by one (GMI thumbnail → ElevenLabs soundscape → ElevenLabs TTS), each streaming an asset icon into one manifest with one canonical hash.
- duration: 16s
- poster: 10s
- transition_in: crossfade
- status: outline
- blueprint: prompt-type-submit-generate
- voiceover: "And the media is orchestrated by Genblaze. Not three separate API calls. One declarative pipeline. Thumbnail. Soundscape. Voice. Three assets, two providers, one B2 sink — one canonical hash."
- asset_candidates: (code surface — real Pipeline code from workers/genblaze/)
- src: compositions/frames/08-genblaze.html

The other co-protagonist. Render the REAL composite pipeline code on the
warm-navy code surface (coral/teal/amber syntax). Each .step() line lights up on
its VO cue, streaming an asset node into a single manifest. The payoff line:
"one run · one sink · one hash". This is "meaningful use of Genblaze" — a
multi-step, multi-provider pipeline, not wrapped API calls.

## Frame 9 — Proof + the autonomous loop

- scene: A Grove proof JSON card fans out from a "View generation proof" badge (content hashes, manifest URIs, model versions); then an autonomous loop reel runs with real stats (render → deliver → reply → meeting → $50 earned).
- duration: 14s
- poster: 8s
- transition_in: crossfade
- status: outline
- blueprint: grid-card-assemble
- voiceover: "Every share is anchored in an immutable proof. Content hash. Manifest. Model version. And the whole loop runs autonomously — research to delivery to reply to a booked meeting, earning fifty dollars over Stripe."
- asset_candidates: capture/screenshots/share-top.png
- src: compositions/frames/09-proof-loop.html

Production readiness + real-world utility. The proof card fans out (reconstructed
faithfully from nuncio.proof.v2), then the autonomous SDR loop reels as a cycling
ring with real numbers (~8 min render, $50 Stripe checkout cs_live_a1qnZHAL...).
Two judging criteria answered in one beat.

## Frame 10 — Close

- scene: The nuncio wordmark settles from a scatter of provider marks; a serif sign-off reads "Generate with Genblaze. Store on Backblaze B2." then the emissary line and URL.
- duration: 13s
- poster: 7s
- transition_in: crossfade
- status: outline
- blueprint: logo-assemble-lockup
- voiceover: "Generate with Genblaze. Store on Backblaze B2. Nuncio — your intelligent emissary."
- asset_candidates: capture-share/assets/svgs/logo-c454f1e6.svg
- src: compositions/frames/10-close.html

The scatter-drift end card. Provider marks (GMI, ElevenLabs, HeyGen, Backblaze,
Genblaze, Grove) spring in scattered around the centered serif headline and drift
slowly outward. One coral ✱. The sign-off lands the hackathon thesis verbatim,
then the wordmark + "your intelligent emissary" + nuncio.persidian.com.
