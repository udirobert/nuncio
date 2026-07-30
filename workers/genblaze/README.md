# Genblaze Media Orchestration Worker

Owns generative media orchestration for nuncio. Wraps the [Genblaze](https://github.com/backblaze-labs/genblaze)
Python SDK to produce audio (TTS, soundscape) and image (thumbnail) assets with
automatic Backblaze B2 storage and SHA-256 provenance manifests.

## Why this exists

Generation orchestration is core product logic, so it lives in the nuncio repo,
not in an external agent runtime. This worker is the single Genblaze integration
point. HeyGen video rendering remains outside Genblaze (no adapter exists) and is
handled by the TypeScript pipeline, which persists finished videos to B2 directly.

## Multi-step orchestration

The `/generate/composite` endpoint runs a single Genblaze `Pipeline` with three
chained steps across two providers and two modalities:

1. **Thumbnail** (GMI Cloud, `seedream-5.0-lite`, IMAGE) from the script hook line
2. **Soundscape** (ElevenLabs, `sound-fx`, AUDIO) ambient background
3. **TTS narration** (ElevenLabs, `eleven_v3`, AUDIO) of the script

All three assets land in the same B2 bucket under one manifest with one canonical
hash. This is real orchestration, not three independent calls: one pipeline, one
sink, one provenance record covering the whole generation.

Every pipeline also tags its run with `.metadata(app="nuncio", role=..., provider=...)`,
which flows into `Run.metadata` and the manifest, so B2 assets are self-describing
and auditable by role without external lookups.

## Architecture role

```
B2      → media asset store (videos, audio, thumbnails, traces, asset manifests)
Grove   → immutable provenance anchor (proof records referencing B2 URLs + hashes)
Genblaze→ orchestration SDK (this worker)
Hermes  → demoted to an optional cron trigger that calls /api/agent/* only
```

Hermes no longer owns generation. Its skills are scheduling/trigger wrappers over
nuncio's REST API; all provider orchestration happens here and in the TS pipeline.

## Running

```bash
pip install -r requirements.txt
export B2_KEY_ID=... B2_APP_KEY=... B2_BUCKET=nuncio-media
export ELEVENLABS_API_KEY=... GMI_API_KEY=...
uvicorn main:app --host 0.0.0.0 --port 8100
```

Set `GENBLAZE_WORKER_URL=http://<host>:8100` in the nuncio environment to activate.
If unset or unreachable, nuncio falls back to direct provider calls.

## Endpoints

- `GET /health` — liveness
- `POST /generate` — `{ type, prompt, share_id, voice_id?, model?, duration? }`
- `POST /generate/composite` — multi-step thumbnail + soundscape + TTS in one pipeline
- `POST /batch` — `{ share_id, items: [...] }`
