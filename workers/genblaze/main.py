"""
Nuncio Genblaze media orchestration worker.

FastAPI service that wraps the Genblaze SDK to generate audio (TTS, soundscape)
and images (thumbnails) with automatic B2 storage and provenance manifests.

Deployed alongside nuncio. Called by the TypeScript pipeline when
GENBLAZE_WORKER_URL is set. Falls back gracefully if unreachable.

Endpoints:
  GET  /health          — liveness check
  POST /generate        — generate media via Genblaze pipeline
  POST /generate/batch  — generate multiple assets in one request
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import time
import traceback

from providers import generate_tts, generate_soundscape, generate_thumbnail, generate_composite_assets

app = FastAPI(
    title="nuncio-genblaze-worker",
    description="Genblaze media orchestration for nuncio",
    version="1.0.0",
)


class GenerateRequest(BaseModel):
    type: str = Field(..., description="Asset type: tts, soundscape, thumbnail, composite")
    prompt: str = Field(..., description="Text prompt or script content")
    share_id: str = Field(..., description="Share record ID for asset grouping")
    voice_id: str | None = Field(None, description="ElevenLabs voice ID (tts only)")
    model: str | None = Field(None, description="Override default model")
    duration: int | None = Field(None, description="Duration in seconds (soundscape only)")
    soundscape_prompt: str | None = Field(None, description="Soundscape prompt (composite only)")


class AssetResult(BaseModel):
    url: str
    sha256: str | None = None
    content_type: str = "application/octet-stream"
    manifest_uri: str | None = None
    manifest_hash: str | None = None


class CompositeAsset(AssetResult):
    modality: str | None = None
    provider: str | None = None
    model: str | None = None


class CompositeResponse(BaseModel):
    assets: list[CompositeAsset]
    manifest_uri: str | None = None
    manifest_hash: str | None = None
    steps: int
    pipeline: str
    provider: str = "genblaze"
    elapsed_ms: int


class GenerateResponse(BaseModel):
    asset: AssetResult
    provider: str = "genblaze"
    pipeline: str
    elapsed_ms: int


class BatchRequest(BaseModel):
    share_id: str
    items: list[GenerateRequest]


class BatchResponse(BaseModel):
    share_id: str
    results: list[dict]
    elapsed_ms: int


GENERATORS = {
    "tts": lambda req: generate_tts(
        text=req.prompt,
        voice_id=req.voice_id or "JBFqnCBsd6RMkjVDRZzb",
        model=req.model or "eleven_v3",
    ),
    "soundscape": lambda req: generate_soundscape(
        prompt=req.prompt,
        duration=req.duration or 10,
    ),
    "thumbnail": lambda req: generate_thumbnail(
        prompt=req.prompt,
        model=req.model or "seedream-5.0-lite",
    ),
}


@app.get("/health")
def health():
    return {"status": "ok", "service": "nuncio-genblaze-worker"}


@app.post("/generate/composite", response_model=CompositeResponse)
def generate_composite(req: GenerateRequest):
    """
    Multi-step orchestration endpoint: generates a thumbnail (GMI Cloud),
    soundscape (ElevenLabs SFX), and TTS narration (ElevenLabs) in a single
    Genblaze Pipeline run. One manifest, one B2 sink, three assets across
    two providers and two modalities.
    """
    start = time.monotonic()
    try:
        result = generate_composite_assets(
            script_hook=req.prompt,
            soundscape_prompt=req.soundscape_prompt
            or "Ambient professional office soundscape. Subtle, non-distracting.",
            voice_id=req.voice_id or "JBFqnCBsd6RMkjVDRZzb",
            thumbnail_model=req.model or "seedream-5.0-lite",
            duration=req.duration or 10,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Composite generation failed: {e}")
    elapsed = int((time.monotonic() - start) * 1000)

    assets = [CompositeAsset(**a) for a in result["assets"]]
    return CompositeResponse(
        assets=assets,
        manifest_uri=result["manifest_uri"],
        manifest_hash=result["manifest_hash"],
        steps=result["steps"],
        pipeline=result["pipeline"],
        elapsed_ms=elapsed,
    )


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    generator = GENERATORS.get(req.type)
    if not generator:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown type '{req.type}'. Supported: {list(GENERATORS.keys())}",
        )

    start = time.monotonic()
    try:
        result = generator(req)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    elapsed = int((time.monotonic() - start) * 1000)

    return GenerateResponse(
        asset=AssetResult(**result),
        pipeline=f"nuncio-{req.type}",
        elapsed_ms=elapsed,
    )


@app.post("/batch", response_model=BatchResponse)
def generate_batch(req: BatchRequest):
    start = time.monotonic()
    results = []
    for item in req.items:
        item.share_id = req.share_id
        generator = GENERATORS.get(item.type)
        if not generator:
            results.append({"type": item.type, "error": f"Unknown type '{item.type}'"})
            continue
        try:
            result = generator(item)
            results.append({"type": item.type, **result})
        except Exception as e:
            results.append({"type": item.type, "error": str(e)})
    elapsed = int((time.monotonic() - start) * 1000)
    return BatchResponse(share_id=req.share_id, results=results, elapsed_ms=elapsed)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
