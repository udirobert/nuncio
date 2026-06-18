"""Activity bridge — posts agent events to the Next.js /api/band/activity endpoint.

This bridges the Band room (Python agents) to the studio UI (browser) via the
shared activity store on the Next.js server.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

NUNCIO_API_URL = os.getenv("NUNCIO_API_URL", "http://localhost:3000")


async def post_activity(
    session_id: str,
    agent: str,
    event_type: str,
    content: str,
    metadata: dict | None = None,
) -> None:
    """Post a structured activity event to the Next.js activity store.

    These events are streamed to the studio UI via SSE so users can watch
    agents working in real time.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{NUNCIO_API_URL}/api/band/activity",
                json={
                    "sessionId": session_id,
                    "agent": agent,
                    "eventType": event_type,
                    "content": content,
                    "metadata": metadata,
                },
            )
    except Exception as e:
        logger.warning("Failed to post activity to %s: %s", NUNCIO_API_URL, e)


def extract_session_id(msg_content: str, msg_metadata: dict | None) -> str | None:
    """Extract session ID from message content or metadata.

    The studio UI posts a kickoff event with the session ID. The Python agents
    read it from the initial message to correlate their activity.
    """
    if msg_metadata and isinstance(msg_metadata, dict):
        sid = msg_metadata.get("sessionId") or msg_metadata.get("session_id")
        if sid:
            return sid

    # Try parsing from content (JSON block or key=value format)
    import json
    import re

    try:
        data = json.loads(msg_content)
        if isinstance(data, dict):
            return data.get("sessionId") or data.get("session_id")
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(r"sessionId[=:]\s*([a-f0-9-]+)", msg_content)
    if match:
        return match.group(1)

    return None
