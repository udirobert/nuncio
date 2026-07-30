# Nuncio — AI-Generated Media Pipeline with Provenance

> Backblaze Generative AI Media Hackathon submission

## Tagline

An autonomous SDR platform that generates personalized outreach videos, audio, and images through a Genblaze-orchestrated pipeline, stores all media durably on Backblaze B2, and anchors every generation in an immutable provenance record.

## What it does

Nuncio turns a prospect's URL into a fully personalized outreach package:

1. **Research** — three-provider orchestrator (TinyFish, Firecrawl, EXA) builds a rich prospect profile
2. **Script** — LLM fallback chain (Featherless → Venice → TokenRouter) writes a tailored outreach script
3. **Generate media** — HeyGen renders the video, Genblaze worker orchestrates ElevenLabs TTS + soundscape audio + GMI Cloud thumbnails
4. **Store on B2** — every asset (video, audio, thumbnail, pipeline trace) is uploaded to Backblaze B2 with SHA-256 content hashing
5. **Anchor provenance** — an immutable Grove proof record references B2 URLs, content hashes, Genblaze manifests, and model versions
6. **Deliver** — outreach email with a shareable link to the B2-hosted media package
7. **Autonomous loop** — a scheduled agent runs the full cycle unattended: research → generate → store → deliver → classify replies → book meetings

## Architecture: three-tier storage

```
┌─────────────────────────────────────────────────────────────────────┐
│                        nuncio pipeline                              │
│  research → synthesize → script → render → persist → prove → send  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
   │ Genblaze    │  │ Backblaze   │  │ Grove           │
   │ Worker      │  │ B2          │  │ (provenance)    │
   │             │  │             │  │                 │
   │ ElevenLabs  │  │ videos/     │  │ Content hashes  │
   │ TTS + SFX   │──▶│ audio/      │  │ Manifest URIs   │
   │             │  │ thumbnails/ │  │ Model versions  │
   │ GMI Cloud   │  │ traces/     │  │ Timestamps      │
   │ thumbnails  │  │             │  │ Source URLs     │
   └─────────────┘  └─────────────┘  └─────────────────┘
   Orchestration     Media store      Immutable audit
   (Python SDK)      (S3-compat)      trail
```

Each tier has a distinct role with zero overlap:

| Tier | Role | Content |
|------|------|---------|
| **Backblaze B2** | Primary media asset store | Rendered videos, TTS audio, soundscape audio, thumbnails, pipeline trace JSON |
| **Genblaze Worker** | Multi-provider orchestration | Wraps ElevenLabs (TTS, sound effects) and GMI Cloud (image generation) in declarative pipelines with automatic B2 storage and SHA-256 provenance manifests |
| **Grove** | Immutable provenance anchor | Content-addressed proof records referencing B2 URLs, content hashes, Genblaze manifest URIs, and model versions |

## B2 Storage and Data Orchestration

B2 is the durable media backbone and the data-orchestration layer. Every
generated asset flows through B2 before reaching the user, and every object
carries structured metadata and is indexed in a per-share manifest.

**Bucket organization** (`nuncio-media`):
```
videos/{shareId}/video.mp4          ← HeyGen render, downloaded from temp URL, re-uploaded
audio/{shareId}/soundscape.mp3      ← ElevenLabs ambient audio via Genblaze
audio/{shareId}/entrance.mp3        ← cinematic entrance audio
images/{shareId}/thumbnail.png      ← GMI Cloud thumbnail via Genblaze
traces/{shareId}/pipeline.json      ← full pipeline trace (steps, timings, providers)
manifests/{shareId}/assets.json     ← per-share asset manifest (index of everything above)
```

**S3 user-defined metadata**: every upload tags the object with
`x-amz-meta-app=nuncio`, `x-amz-meta-role` (video/audio/trace/asset-manifest),
`x-amz-meta-share-id`, `x-amz-meta-pipeline=genblaze`, and
`x-amz-meta-content-sha256`. B2 returns these on GET/HEAD, so assets are
auditable and filterable server-side without downloading them or consulting an
external database.

**Per-share asset manifest**: after all assets for a share are persisted, the
pipeline writes a single `manifests/{shareId}/assets.json` index listing every
object (key, URL, SHA-256) that belongs to that share. B2 becomes the source of
truth for "what assets does share X have," enabling reconstruction, auditing,
and search without a separate metadata store.

**Why B2 matters here**: HeyGen signed URLs expire after ~24 hours. Without
durable storage, every shared video link goes dead. B2 gives every asset a
permanent, publicly accessible URL. The `persistVideo()` function downloads from
the temporary URL, computes a SHA-256 hash, uploads to B2 with metadata, and
returns the permanent URL. The same pattern applies to audio, images, traces,
and manifests.

**S3-compatible integration**: B2's S3-compatible API means we use the standard
`@aws-sdk/client-s3` (TypeScript, including `ListObjectsV2Command` for prefix
enumeration) and `genblaze-s3`'s `S3StorageBackend.for_backblaze()` (Python
worker). No proprietary SDK, no lock-in.

**Graceful degradation**: If B2 is unconfigured, the pipeline falls back to raw
provider URLs. If the Genblaze worker is unreachable, the pipeline falls back to
direct ElevenLabs API calls. Neither failure breaks the product.

## Use of Genblaze

The Genblaze SDK is the single orchestration point for generative media, running
as a product-owned Python worker (`workers/genblaze/`) inside the nuncio
repository.

**Multi-step composite pipeline**: the flagship usage is a single Genblaze
`Pipeline` that chains three steps across two providers and two modalities in one
run:

```python
(
    Pipeline("nuncio-composite")
    .metadata(app="nuncio", role="composite", providers="gmi-cloud+elevenlabs")
    .step(GMICloudImageProvider(), model="seedream-5.0-lite",
          prompt=hook, modality=Modality.IMAGE)                       # thumbnail
    .step(ElevenLabsTTSProvider(), model="sound-fx",
          prompt=ambient, modality=Modality.AUDIO, duration=10)        # soundscape
    .step(ElevenLabsTTSProvider(), model="eleven_v3",
          prompt=script, modality=Modality.AUDIO, voice_id=voice)      # narration
    .run(sink=storage, timeout=180)
)
```

One pipeline, one B2 sink, three assets, one manifest with one canonical hash.
This is real orchestration, not three independent API calls wrapped in a loop.

**What Genblaze orchestrates**:

| Pipeline | Providers | Modalities | Purpose |
|----------|-----------|------------|---------|
| `nuncio-composite` | GMI Cloud + ElevenLabs | IMAGE + AUDIO | Thumbnail + soundscape + narration in one run |
| `nuncio-tts` | ElevenLabs (`eleven_v3`) | Audio | Voice narration |
| `nuncio-soundscape` | ElevenLabs (`sound-fx`) | Audio | Ambient background audio |
| `nuncio-thumbnail` | GMI Cloud (`seedream-5.0-lite`) | Image | Custom thumbnail |

**Provenance and metadata**: Genblaze handles provider orchestration, automatic
B2 upload with hierarchical keys, SHA-256 hashing, and manifest generation
(`manifest_uri` + `canonical_hash`). Every pipeline tags its run with
`.metadata(...)`, which flows into `Run.metadata` and the manifest so assets are
self-describing. The share page surfaces this directly ("Generated with
Genblaze: thumbnail: gmi-cloud, video: heygen, ...") so Genblaze's contribution
is visible at runtime, not buried in JSON.

**HeyGen note**: HeyGen has no Genblaze adapter, so video rendering calls
HeyGen's API directly from TypeScript. The rendered video is then persisted to B2
via the same `MediaStorageProvider` interface and indexed in the same manifest.

## Provenance (Grove)

Every share record gets an immutable Grove proof (`nuncio.proof.v2`):

```json
{
  "schema": "nuncio.proof.v2",
  "shareId": "abc-123",
  "video": { "provider": "heygen", "videoId": "...", "videoUrl": "https://b2.../video.mp4" },
  "generation": {
    "hashes": { "video": "sha256:...", "thumbnail": "sha256:..." },
    "manifests": { "thumbnail": "ipfs://..." },
    "manifestHashes": { "thumbnail": "..." },
    "models": { "video": "heygen", "thumbnail": "gmi-cloud/seedream-5.0-lite" }
  },
  "sources": ["linkedin.com", "crunchbase.com"],
  "trace": [{ "label": "Rendered HeyGen video", "status": "complete" }]
}
```

The share page shows a "View generation proof" badge linking to the Grove gateway. This is auditable, tamper-evident, and decentralized.

## Providers and models used

| Provider | Model | Role |
|----------|-------|------|
| HeyGen | Avatar API | Video rendering (personalized talking-head) |
| ElevenLabs | `eleven_v3` | Text-to-speech narration |
| ElevenLabs | `sound-fx` | Ambient soundscape generation |
| GMI Cloud | `seedream-5.0-lite` | Thumbnail image generation |
| Featherless / Venice / TokenRouter | Various LLMs | Script generation, profile synthesis, reply classification |
| TinyFish | Search API | Prospect research (Twitter/X, LinkedIn) |
| Firecrawl | Extraction API | Structured web scraping + site mapping |
| EXA | Semantic Search | Deep prospect research |

## Production readiness

- **Live at https://nuncio.persidian.com** — not a demo, a deployed product
- **Stripe billing** — live checkout, subscriptions, webhooks, credit system
- **Sentry monitoring** — opt-in error tracking
- **Turso persistence** — SQLite at the edge for share records, accounts, credits
- **Rate limiting** — Redis-backed with in-memory fallback
- **Autonomous agent** — runs the full pipeline on a cron schedule inside an NVIDIA NemoClaw sandbox
- **Graceful degradation** — every external dependency (B2, Genblaze, Grove, ElevenLabs, HeyGen) has a fallback path
- **CI on every push** — GitHub Actions runs typecheck, lint, tests, and a worker syntax check
- **44 tests passing** — credits, rate limiting, B2 provider, Genblaze client

## Setup

```bash
# nuncio (Next.js)
pnpm install
cp .env.example .env.local
# Set: B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT, B2_BUCKET_NAME
# Set: ELEVENLABS_API_KEY, HEYGEN_API_KEY
# Optional: GENBLAZE_WORKER_URL, GROVE_ENABLED=true
pnpm dev

# Genblaze worker (Python)
cd workers/genblaze
pip install -r requirements.txt
# Set: B2_KEY_ID, B2_APP_KEY, B2_BUCKET, ELEVENLABS_API_KEY, GMI_API_KEY
uvicorn main:app --host 0.0.0.0 --port 8100
```

## Links

- **App**: https://nuncio.persidian.com
- **GitHub**: https://github.com/udirobert/nuncio (grant `b2genblaze` contributor access)
