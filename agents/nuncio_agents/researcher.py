"""Researcher Agent — enriches prospect profiles via the Nuncio /api/enrich endpoint."""

from __future__ import annotations

import asyncio
import json
import logging

from band.core.protocols import AgentToolsProtocol
from band.core.simple_adapter import SimpleAdapter
from band.core.types import Capability, Emit, AdapterFeatures, PlatformMessage

from nuncio_agents.base import extract_urls, make_client
from nuncio_agents.activity_bridge import extract_session_id, post_activity

logger = logging.getLogger(__name__)


class ResearcherAdapter(SimpleAdapter[list[dict]]):
    """
    Listens for messages containing URLs, enriches them via the Nuncio API,
    and posts structured profile data back to the room.
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

        # Skip messages from other agents (avoid loops)
        if msg.sender_type == "Agent":
            return

        urls = extract_urls(content)
        if not urls:
            return

        session_id = extract_session_id(content, msg.metadata) or room_id

        await tools.send_event(
            content=f"Researching {len(urls)} profile URL(s)...",
            message_type="thought",
        )
        await post_activity(session_id, "researcher", "thought", f"Researching {len(urls)} profile URL(s)...")

        # Post progress events while enrichment runs
        progress_done = False
        async def _progress_loop():
            steps = [
                (10, "Scraping profile data from public sources..."),
                (20, "Analysing recent posts and activity..."),
                (35, "Cross-referencing company and background info..."),
                (50, "Synthesising profile summary..."),
            ]
            for delay, message in steps:
                await asyncio.sleep(delay)
                if progress_done:
                    return
                await post_activity(session_id, "researcher", "thought", message)

        progress_task = asyncio.create_task(_progress_loop())

        try:
            try:
                async with make_client() as client:
                    resp = await client.post("/api/enrich", json={"urls": urls}, timeout=120.0)
                    resp.raise_for_status()
                    results = resp.json()
            finally:
                progress_done = True
                progress_task.cancel()

            successful = [r for r in results if r.get("success", True) and r.get("markdown")]
            failed = [r for r in results if not r.get("success", True)]

            summary_lines = [
                "## Research Results",
                "",
                f"**Enriched:** {len(successful)} profile(s) | **Failed:** {len(failed)}",
                "",
            ]

            for r in successful:
                url = r.get("url", "unknown")
                md = r.get("markdown", "")
                preview = md[:500] + "..." if len(md) > 500 else md
                summary_lines.append(f"### {url}")
                summary_lines.append(preview)
                summary_lines.append("")

            if failed:
                summary_lines.append("### Failed URLs")
                for r in failed:
                    summary_lines.append(f"- {r.get('url', '?')}: {r.get('reason', 'unknown error')}")

            summary = "\n".join(summary_lines)
            await tools.send_message(summary)
            await post_activity(session_id, "researcher", "message", summary,
                                metadata={"results": results, "successful": len(successful), "failed": len(failed)})
            await post_activity(session_id, "researcher", "stage_complete", "Research complete")

            await tools.send_event(
                content=json.dumps({"type": "enrichment", "data": results, "sessionId": session_id}),
                message_type="tool_result",
                metadata={"type": "enrichment_data", "results": results, "sessionId": session_id},
            )

        except Exception as e:
            progress_done = True
            progress_task.cancel()
            logger.exception("Researcher enrichment failed")
            await tools.send_event(
                content=f"Enrichment failed: {e}",
                message_type="error",
            )
            await tools.send_message(
                f"Enrichment failed: {e}. Please check the URLs and try again."
            )
            await post_activity(session_id, "researcher", "error", f"Enrichment failed: {e}")
