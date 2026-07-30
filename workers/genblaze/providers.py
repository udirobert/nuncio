"""
Genblaze provider registry for nuncio media orchestration.

Wraps the Genblaze Pipeline API to generate audio (TTS, sound effects)
and images (thumbnails) with automatic B2 storage and provenance manifests.

Multi-step composite pipelines chain thumbnail + soundscape generation in a
single Pipeline run, demonstrating real orchestration across providers and
modalities. Manifests are embedded directly into media files where supported.

HeyGen video rendering remains outside Genblaze (no adapter exists).
"""

from genblaze_core import Modality, ObjectStorageSink, KeyStrategy, Pipeline
from genblaze_s3 import S3StorageBackend
from genblaze_elevenlabs import ElevenLabsTTSProvider
from genblaze_gmicloud import GMICloudImageProvider

import os

_BUCKET = os.environ.get("B2_BUCKET", "nuncio-media")


def get_storage_sink() -> ObjectStorageSink:
    """B2-backed storage sink with hierarchical keys. Credentials from B2_KEY_ID / B2_APP_KEY env vars."""
    return ObjectStorageSink(
        S3StorageBackend.for_backblaze(_BUCKET),
        key_strategy=KeyStrategy.HIERARCHICAL,
    )


def generate_tts(
    text: str,
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb",
    model: str = "eleven_v3",
) -> dict:
    """Generate speech audio via ElevenLabs through Genblaze pipeline."""
    storage = get_storage_sink()
    result = (
        Pipeline("nuncio-tts")
        .metadata(app="nuncio", role="narration", provider="elevenlabs")
        .step(
            ElevenLabsTTSProvider(output_dir="/tmp/genblaze-tts"),
            model=model,
            prompt=text,
            modality=Modality.AUDIO,
            voice_id=voice_id,
        )
        .run(sink=storage, timeout=120)
    )
    step = result.run.steps[0]
    asset = step.assets[0]
    return {
        "url": asset.url,
        "sha256": asset.sha256,
        "content_type": asset.mime_type or "audio/mpeg",
        "manifest_uri": result.manifest.manifest_uri,
        "manifest_hash": result.manifest.canonical_hash,
    }


def generate_soundscape(
    prompt: str,
    duration: int = 10,
) -> dict:
    """Generate ambient soundscape audio via ElevenLabs sound effects."""
    storage = get_storage_sink()
    result = (
        Pipeline("nuncio-soundscape")
        .metadata(app="nuncio", role="soundscape", provider="elevenlabs")
        .step(
            ElevenLabsTTSProvider(output_dir="/tmp/genblaze-sfx"),
            model="sound-fx",
            prompt=prompt,
            modality=Modality.AUDIO,
            duration=duration,
        )
        .run(sink=storage, timeout=120)
    )
    step = result.run.steps[0]
    asset = step.assets[0]
    return {
        "url": asset.url,
        "sha256": asset.sha256,
        "content_type": asset.mime_type or "audio/mpeg",
        "manifest_uri": result.manifest.manifest_uri,
        "manifest_hash": result.manifest.canonical_hash,
    }


def generate_thumbnail(
    prompt: str,
    model: str = "seedream-5.0-lite",
) -> dict:
    """Generate a thumbnail image via GMI Cloud through Genblaze pipeline."""
    storage = get_storage_sink()
    result = (
        Pipeline("nuncio-thumbnail")
        .metadata(app="nuncio", role="thumbnail", provider="gmi-cloud")
        .step(
            GMICloudImageProvider(),
            model=model,
            prompt=prompt,
            modality=Modality.IMAGE,
        )
        .run(sink=storage, timeout=120)
    )
    step = result.run.steps[0]
    asset = step.assets[0]
    return {
        "url": asset.url,
        "sha256": asset.sha256,
        "content_type": asset.mime_type or "image/png",
        "manifest_uri": result.manifest.manifest_uri,
        "manifest_hash": result.manifest.canonical_hash,
    }


def generate_composite_assets(
    script_hook: str,
    soundscape_prompt: str,
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb",
    thumbnail_model: str = "seedream-5.0-lite",
    duration: int = 10,
) -> dict:
    """
    Multi-step composite pipeline: generates thumbnail + soundscape + TTS
    narration in a single Pipeline run across two providers and three modalities.

    This demonstrates real Genblaze orchestration: one pipeline, multiple
    providers (GMI Cloud + ElevenLabs), multiple modalities (IMAGE + AUDIO),
    single manifest covering all outputs, single B2 sink with hierarchical keys.
    """
    storage = get_storage_sink()
    result = (
        Pipeline("nuncio-composite")
        .metadata(app="nuncio", role="composite", providers="gmi-cloud+elevenlabs")
        .step(
            GMICloudImageProvider(),
            model=thumbnail_model,
            prompt=f"Professional outreach video thumbnail, clean minimal design: {script_hook}",
            modality=Modality.IMAGE,
        )
        .step(
            ElevenLabsTTSProvider(output_dir="/tmp/genblaze-sfx"),
            model="sound-fx",
            prompt=soundscape_prompt,
            modality=Modality.AUDIO,
            duration=duration,
        )
        .step(
            ElevenLabsTTSProvider(output_dir="/tmp/genblaze-tts"),
            model="eleven_v3",
            prompt=script_hook,
            modality=Modality.AUDIO,
            voice_id=voice_id,
        )
        .run(sink=storage, timeout=180)
    )

    assets = []
    for step_result in result.run.steps:
        for asset in step_result.assets:
            assets.append({
                "url": asset.url,
                "sha256": asset.sha256,
                "content_type": asset.mime_type or "application/octet-stream",
                "modality": step_result.modality,
                "provider": step_result.provider,
                "model": step_result.model,
            })

    return {
        "assets": assets,
        "manifest_uri": result.manifest.manifest_uri,
        "manifest_hash": result.manifest.canonical_hash,
        "steps": len(result.run.steps),
        "pipeline": "nuncio-composite",
    }


def embed_manifest_in_video(video_path: str, manifest_dict: dict) -> bool:
    """
    Embed a Genblaze provenance manifest directly into an MP4 file using
    the Mp4Handler. This makes the video self-describing: anyone with the
    file can extract and verify the generation provenance without external
    lookups.

    Returns True if embedding succeeded, False otherwise.
    """
    try:
        from pathlib import Path
        from genblaze_core.media import Mp4Handler
        from genblaze_core import Manifest

        manifest = Manifest.from_dict(manifest_dict)
        handler = Mp4Handler()
        handler.embed(Path(video_path), manifest)
        return True
    except Exception as e:
        print(f"[genblaze] Manifest embedding failed: {e}")
        return False
