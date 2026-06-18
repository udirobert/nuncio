"""Reviewer Agent — validates scripts and approves or requests edits."""

from __future__ import annotations

import json
import logging

from band.core.protocols import AgentToolsProtocol
from band.core.simple_adapter import SimpleAdapter
from band.core.types import Capability, Emit, AdapterFeatures, PlatformMessage

from nuncio_agents.activity_bridge import extract_session_id, post_activity

logger = logging.getLogger(__name__)

MIN_WORDS = 50
MAX_WORDS = 350
FORBIDDEN_TERMS = [
    "guaranteed", "guarantee", "100%", "no risk", "risk-free",
    "act now", "limited time", "buy now", "click here",
    "free money", "earn money", "make money fast",
]


class ReviewerAdapter(SimpleAdapter[list[dict]]):
    """
    Listens for script draft events from the Copywriter agent,
    validates the script for compliance and quality, and either
    approves it or sends back edit requests.
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

        script_data = self._extract_script(content, msg)
        if script_data is None:
            return

        script = script_data.get("script", "")
        profile = script_data.get("profile", {})

        session_id = (
            extract_session_id(content, msg.metadata)
            or (msg.metadata.get("sessionId") if msg.metadata and isinstance(msg.metadata, dict) else None)
            or room_id
        )

        await tools.send_event(
            content="Reviewing script for compliance and quality...",
            message_type="thought",
        )
        await post_activity(session_id, "reviewer", "thought", "Reviewing script for compliance and quality...")

        issues = self._validate(script, profile)

        if issues:
            lines = [
                "## Script Review — Edits Required",
                "",
                f"**Issues found:** {len(issues)}",
                "",
            ]
            for i, issue in enumerate(issues, 1):
                lines.append(f"{i}. **{issue['category']}**: {issue['detail']}")
            lines.append("")
            lines.append("*@Copywriter — please address these issues and resubmit.*")

            review = "\n".join(lines)
            await tools.send_message(review)
            await post_activity(session_id, "reviewer", "message", review,
                                metadata={"approved": False, "issues": issues})

            await tools.send_event(
                content=json.dumps({"type": "review_rejected", "issues": issues, "sessionId": session_id}),
                message_type="tool_result",
                metadata={"type": "review_rejected", "sessionId": session_id},
            )
        else:
            word_count = len(script.split())
            lines = [
                "## Script Review — Approved",
                "",
                f"**Word count:** {word_count} | **Compliance:** passed",
                "",
                "Script meets all quality and compliance checks.",
                "Ready for video production.",
                "",
                "*@Producer — proceed with rendering.*",
            ]

            review = "\n".join(lines)
            await tools.send_message(review)
            await post_activity(session_id, "reviewer", "message", review,
                                metadata={"approved": True, "wordCount": word_count})
            await post_activity(session_id, "reviewer", "stage_complete", "Script approved")

            await tools.send_event(
                content=json.dumps({
                    "type": "script_approved",
                    "script": script,
                    "profile": profile,
                    "vibeId": script_data.get("vibeId", ""),
                    "wordCount": word_count,
                    "sessionId": session_id,
                }),
                message_type="tool_result",
                metadata={
                    "type": "script_approved",
                    "script": script,
                    "profile": profile,
                    "vibeId": script_data.get("vibeId", ""),
                    "sessionId": session_id,
                },
            )

    def _validate(self, script: str, profile: dict) -> list[dict]:
        issues: list[dict] = []
        words = script.split()
        word_count = len(words)

        if word_count < MIN_WORDS:
            issues.append({"category": "Length", "detail": f"Script is too short ({word_count} words, minimum {MIN_WORDS})."})
        if word_count > MAX_WORDS:
            issues.append({"category": "Length", "detail": f"Script is too long ({word_count} words, maximum {MAX_WORDS})."})

        lower = script.lower()
        for term in FORBIDDEN_TERMS:
            if term in lower:
                issues.append({"category": "Compliance", "detail": f'Forbidden term found: "{term}".'})

        if not any(c in script for c in ".!?"):
            issues.append({"category": "Quality", "detail": "Script contains no sentence-ending punctuation."})

        name = profile.get("name", "") if isinstance(profile, dict) else ""
        if name and name.split()[0].lower() not in lower:
            issues.append({"category": "Personalization", "detail": f"Recipient's first name ({name.split()[0]}) not mentioned in the script."})

        return issues

    def _extract_script(self, content: str, msg: PlatformMessage) -> dict | None:
        if msg.metadata and isinstance(msg.metadata, dict):
            if msg.metadata.get("type") == "script_draft":
                return {
                    "script": msg.metadata.get("script", ""),
                    "profile": msg.metadata.get("profile", {}),
                    "vibeId": msg.metadata.get("vibeId", ""),
                }

        parsed = None
        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            pass

        if parsed is None:
            from nuncio_agents.base import parse_json_block
            parsed = parse_json_block(content)

        if parsed and parsed.get("type") == "script_draft":
            return parsed

        return None
