"""Base utilities shared across all Nuncio Band agents."""

from __future__ import annotations

import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

# ── Nuncio API base URL ───────────────────────────────────────────────────────
# Agents call the Next.js API locally (or via NUNCIO_API_URL in production).
NUNCIO_API_URL = os.getenv("NUNCIO_API_URL", "http://localhost:3000")

# Internal service header — bypasses anonymous rate-limit; maps to a fixed
# internal workspace so credit accounting stays clean and never bills real users.
INTERNAL_HEADERS = {
    "Content-Type": "application/json",
    "x-nuncio-workspace-id": os.getenv("NUNCIO_BAND_WORKSPACE_ID", "band-internal"),
    "x-band-agent": "true",
}

HTTP_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def make_client() -> httpx.AsyncClient:
    """Return a configured async HTTP client pointing at the Nuncio API."""
    return httpx.AsyncClient(
        base_url=NUNCIO_API_URL,
        headers=INTERNAL_HEADERS,
        timeout=HTTP_TIMEOUT,
    )


def extract_urls(text: str) -> list[str]:
    """Extract all http/https URLs found in a message."""
    pattern = r"https?://[^\s<>\"']+"
    return re.findall(pattern, text)


def parse_json_block(content: str) -> dict | None:
    """Extract and parse the first ```json ... ``` block in a message."""
    import json

    match = re.search(r"```json\s*({.*?})\s*```", content, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
