"""Producer Agent — renders the approved script into a video via the Nuncio API."""

from __future__ import annotations

import asyncio
import json
import logging

from band.core.protocols import AgentToolsProtocol
from band.core.simple_adapter import SimpleAdapter
from band.core.types import Capability, Emit, AdapterFeatures, PlatformMessage

from nuncio_agents.base import make_client
from nuncio_agents.activity_bridge import extract_session_id, post_activity

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 60


class ProducerAdapter(SimpleAdapter[list[dict]]):
    """
    Listens for script approval events from the Reviewer agent,
    triggers a HeyGen video render, polls for completion, and
    posts the final video URL.
    """

    SUPPORTED_EMIT = frozenset({Emit.EXECUTION})
    SUPPORTED_CAPABILITIES = frozenset({Capability.CONTACTS})

    def __init__(self) -> None:
        super().__init__(
            features=AdapterFeatures(
                emit=[Emit.EXECUTION],
                capabilities=[Capability.CONTACTS],
            ),
        )

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: list[dict],
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        content = msg.content.strip()
        if not content:
            return

        approved = self._extract_approved(content, msg)
        if approved is None:
            return

        script = approved.get("script", "")
        profile = approved.get("profile", {})

        session_id = (
            extract_session_id(content, msg.metadata)
            or (msg.metadata.get("sessionId") if msg.metadata and isinstance(msg.metadata, dict) else None)
            or room_id
        )

        recipient_name = ""
        if isinstance(profile, dict):
            recipient_name = profile.get("name", "")

        await tools.send_event(content="Starting video render...", message_type="thought")
        await tools.send_message("Starting video render. This typically takes 2-5 minutes...")
        await post_activity(session_id, "producer", "thought", "Starting video render...")

        try:
            async with make_client() as client:
                resp = await client.post(
                    "/api/video",
                    json={
                        "script": script,
                        "assetUrls": [],
                        "recipientName": recipient_name,
                    },
                )
                resp.raise_for_status()
                render_result = resp.json()

            video_id = render_result.get("videoId") or render_result.get("id")
            if not video_id:
                await tools.send_message("Video render submitted but no video ID returned.")
                await post_activity(session_id, "producer", "error", "No video ID returned from render API")
                return

            await post_activity(session_id, "producer", "thought", f"Render job submitted: {video_id}. Polling for completion...")

            video_url = await self._poll_until_done(
                video_id=video_id,
                tools=tools,
                client_factory=make_client,
                session_id=session_id,
            )

            if video_url:
                complete_msg = f"## Video Ready\n\n**Video URL:** {video_url}\n\nThe personalized video has been rendered successfully."
                await tools.send_message(complete_msg)
                await post_activity(session_id, "producer", "stage_complete", "Video rendered")
                await post_activity(
                    session_id, "producer", "complete",
                    "Video production complete. Script and video ready.",
                    metadata={
                        "videoId": video_id,
                        "videoUrl": video_url,
                        "script": script,
                        "profile": profile,
                    },
                )

                await tools.send_event(
                    content=json.dumps({
                        "type": "video_complete",
                        "videoId": video_id,
                        "videoUrl": video_url,
                        "script": script,
                        "profile": profile,
                        "sessionId": session_id,
                    }),
                    message_type="tool_result",
                    metadata={
                        "type": "video_complete",
                        "videoId": video_id,
                        "videoUrl": video_url,
                        "sessionId": session_id,
                    },
                )
            else:
                await tools.send_message("Video render timed out after 10 minutes.")
                await post_activity(session_id, "producer", "error", "Video render timed out")

        except Exception as e:
            logger.exception("Producer render failed")
            await tools.send_event(content=f"Video render failed: {e}", message_type="error")
            await tools.send_message(f"Video render failed: {e}")
            await post_activity(session_id, "producer", "error", f"Video render failed: {e}")

    async def _poll_until_done(
        self,
        *,
        video_id: str,
        tools: AgentToolsProtocol,
        client_factory,
        session_id: str,
    ) -> str | None:
        for attempt in range(MAX_POLL_ATTEMPTS):
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

            try:
                async with client_factory() as client:
                    resp = await client.get(f"/api/video/{video_id}")
                    resp.raise_for_status()
                    status = resp.json()

                video_status = status.get("status", "unknown")

                if video_status == "completed":
                    return status.get("videoUrl")
                elif video_status == "failed":
                    error_msg = status.get("failureMessage", "Unknown error")
                    await tools.send_event(content=f"Render failed: {error_msg}", message_type="error")
                    return None

                if attempt % 6 == 0:
                    msg = f"Render in progress... (attempt {attempt + 1}/{MAX_POLL_ATTEMPTS})"
                    await tools.send_event(content=msg, message_type="thought")
                    await post_activity(session_id, "producer", "thought", msg)

            except Exception as e:
                logger.warning(f"Poll attempt {attempt + 1} failed: {e}")
                continue

        return None

    def _extract_approved(self, content: str, msg: PlatformMessage) -> dict | None:
        if msg.metadata and isinstance(msg.metadata, dict):
            if msg.metadata.get("type") == "script_approved":
                return {
                    "script": msg.metadata.get("script", ""),
                    "profile": msg.metadata.get("profile", {}),
                    "vibeId": msg.metadata.get("vibeId", ""),
                }

        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            parsed = None

        if parsed is None:
            from nuncio_agents.base import parse_json_block
            parsed = parse_json_block(content)

        if parsed and parsed.get("type") == "script_approved":
            return parsed

        return None
