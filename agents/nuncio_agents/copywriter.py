"""Copywriter Agent — generates outreach scripts via the Nuncio /api/script endpoint."""

from __future__ import annotations

import json
import logging

from band.core.protocols import AgentToolsProtocol
from band.core.simple_adapter import SimpleAdapter
from band.core.types import Capability, Emit, AdapterFeatures, PlatformMessage

from nuncio_agents.base import make_client, parse_json_block
from nuncio_agents.activity_bridge import extract_session_id, post_activity

logger = logging.getLogger(__name__)


class CopywriterAdapter(SimpleAdapter[list[dict]]):
    """
    Listens for enrichment data events from the Researcher agent,
    generates a personalized outreach script, and posts it for review.
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

        enrichment_data = self._extract_enrichment(content, msg)
        if enrichment_data is None:
            return

        session_id = (
            extract_session_id(content, msg.metadata)
            or (msg.metadata.get("sessionId") if msg.metadata and isinstance(msg.metadata, dict) else None)
            or room_id
        )

        await tools.send_event(
            content="Drafting personalized outreach script...",
            message_type="thought",
        )
        await post_activity(session_id, "copywriter", "thought", "Drafting personalized outreach script...")

        try:
            async with make_client() as client:
                resp = await client.post(
                    "/api/script",
                    json={
                        "enrichment": enrichment_data,
                        "senderBrief": "",
                        "intent": "",
                    },
                )
                resp.raise_for_status()
                result = resp.json()

            profile = result.get("profile", {})
            script = result.get("script", "")
            vibe_id = result.get("vibeId", "")
            vibe_reasoning = result.get("vibeReasoning", "")

            lines = ["## Script Draft", ""]

            if profile:
                lines.append("### Recipient Profile")
                if isinstance(profile, dict):
                    name = profile.get("name", "Unknown")
                    title = profile.get("title", "")
                    lines.append(f"**{name}** — {title}" if title else f"**{name}**")
                lines.append("")

            if vibe_id:
                lines.append(f"**Tone:** {vibe_id}")
                if vibe_reasoning:
                    lines.append(f"*{vibe_reasoning}*")
                lines.append("")

            lines.append("### Script")
            lines.append(script if script else "*No script generated*")
            lines.append("")
            lines.append("---")
            lines.append("*Ready for review. Approve or request edits.*")

            draft = "\n".join(lines)
            await tools.send_message(draft)
            await post_activity(session_id, "copywriter", "message", draft,
                                metadata={"script": script, "profile": profile, "vibeId": vibe_id})
            await post_activity(session_id, "copywriter", "stage_complete", "Script draft complete")

            await tools.send_event(
                content=json.dumps({
                    "type": "script_draft",
                    "script": script,
                    "profile": profile,
                    "vibeId": vibe_id,
                    "vibeReasoning": vibe_reasoning,
                    "sessionId": session_id,
                }),
                message_type="tool_result",
                metadata={
                    "type": "script_draft",
                    "script": script,
                    "profile": profile,
                    "vibeId": vibe_id,
                    "sessionId": session_id,
                },
            )

        except Exception as e:
            logger.exception("Copywriter script generation failed")
            await tools.send_event(
                content=f"Script generation failed: {e}",
                message_type="error",
            )
            await tools.send_message(
                f"Script generation failed: {e}. The enrichment data may be malformed."
            )
            await post_activity(session_id, "copywriter", "error", f"Script generation failed: {e}")

    def _extract_enrichment(self, content: str, msg: PlatformMessage) -> list | None:
        if msg.metadata and isinstance(msg.metadata, dict):
            if msg.metadata.get("type") == "enrichment_data":
                return msg.metadata.get("results")

        parsed = parse_json_block(content)
        if parsed and parsed.get("type") == "enrichment":
            return parsed.get("data")

        return None
