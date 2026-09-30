"""nuncio Synthesia live-avatar worker.

Runs the LiveKit agent that renders the AI twin inside a shared LiveKit room.
The Next.js backend owns the system prompt, session state, and credits — this
worker only pipes audio: recipient speech -> STT -> the internal
/api/live/agent/chat/completions gateway -> TTS -> Synthesia avatar.

The job metadata contract is {sessionId, avatarId, voiceId}. Prompts and
credentials never travel in job metadata.

When a real human owner joins the room (identity prefix ``owner-``), the twin
steps aside: the avatar participant is removed from the room and the session
shuts down so no AI voice leaks into the human call. A recipient disconnect
starts a grace timer — the shared handoff room lets them rejoin; only a real
owner participant ends the twin immediately.
"""

import asyncio
import contextlib
import json
import logging
import os
import re
import uuid

from livekit import agents, api, rtc
from livekit.agents import AgentServer, AgentSession
from livekit.plugins import elevenlabs, openai, silero, synthesia
from openai import AsyncOpenAI

logger = logging.getLogger("nuncio-live-avatar")

AGENT_NAME = "nuncio-synthesia"
MAX_SESSION_SECONDS = 5 * 60
IDLE_SECONDS = 3 * 60
RECIPIENT_DISCONNECT_GRACE_SECONDS = 45
AVATAR_PARTICIPANT_IDENTITY = "synthesia-avatar-agent"
MAX_METADATA_FIELD_CHARS = 256
AVATAR_ID_PATTERN = re.compile(r"^av_[A-Za-z0-9_-]+$")
VOICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{4,128}$")

APP_URL = os.environ.get("APP_URL", "").rstrip("/")
WORKER_TOKEN = os.environ.get("NUNCIO_LIVE_WORKER_TOKEN", "")

server = AgentServer()


class JobMetadata:
    def __init__(self, session_id: str, avatar_id: str, voice_id: str):
        self.session_id = session_id
        self.avatar_id = avatar_id
        self.voice_id = voice_id


def _bounded_str(value: object) -> str | None:
    if not isinstance(value, str) or not value or len(value) > MAX_METADATA_FIELD_CHARS:
        return None
    return value


def parse_metadata(ctx: agents.JobContext) -> JobMetadata:
    raw = (ctx.job.metadata or "").strip()
    if not raw:
        raise ValueError("job metadata is required")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("job metadata must be an object")
    session_id = _bounded_str(data.get("sessionId"))
    avatar_id = _bounded_str(data.get("avatarId"))
    voice_id = _bounded_str(data.get("voiceId"))
    if session_id is None:
        raise ValueError("job metadata missing sessionId")
    try:
        uuid.UUID(session_id)
    except ValueError as exc:
        raise ValueError("job metadata sessionId is not a UUID") from exc
    if avatar_id is None or not AVATAR_ID_PATTERN.match(avatar_id):
        raise ValueError("job metadata missing or invalid avatarId")
    if voice_id is None or not VOICE_ID_PATTERN.match(voice_id):
        raise ValueError("job metadata missing or invalid voiceId")
    return JobMetadata(session_id, avatar_id, voice_id)


async def remove_avatar_participant(room_name: str) -> None:
    """Remove only this session's avatar participant via the LiveKit API."""
    try:
        async with api.LiveKitAPI() as lkapi:
            await lkapi.room.remove_participant(
                api.RoomParticipantIdentity(room=room_name, identity=AVATAR_PARTICIPANT_IDENTITY)
            )
    except Exception as exc:  # noqa: BLE001 - best-effort teardown, never crash the worker
        logger.warning("avatar participant removal failed: %s", type(exc).__name__)


async def aclose_maybe(resource: object) -> None:
    closer = getattr(resource, "aclose", None) or getattr(resource, "close", None)
    if closer is None:
        return
    try:
        result = closer()
        if asyncio.iscoroutine(result) or isinstance(result, asyncio.Future):
            await result
    except Exception as exc:  # noqa: BLE001
        logger.warning("resource close failed: %s", type(exc).__name__)


@server.rtc_session(agent_name=AGENT_NAME)
async def nuncio_synthesia(ctx: agents.JobContext) -> None:
    """Explicit-dispatch entry point — only runs when the backend dispatches
    the named agent into a nuncio live room."""
    try:
        metadata = parse_metadata(ctx)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.error("refusing job without valid metadata: %s", exc)
        return

    missing = [
        name
        for name in (
            "NUNCIO_LIVE_WORKER_TOKEN",
            "APP_URL",
            "SYNTHESIA_API_KEY",
            "ELEVEN_API_KEY",
            "LIVEKIT_URL",
            "LIVEKIT_API_KEY",
            "LIVEKIT_API_SECRET",
        )
        if not os.environ.get(name)
    ]
    if missing:
        logger.error("worker configuration is missing: %s", ",".join(missing))
        return

    recipient_identity = f"guest-{metadata.session_id}"
    session = None
    avatar = None
    http_client = None
    tasks: list[asyncio.Task[None]] = []
    connected = False

    try:
        await ctx.connect()
        connected = True

        def has_owner() -> bool:
            return any(
                participant.identity.startswith("owner-")
                for participant in ctx.room.remote_participants.values()
            )

        if has_owner():
            logger.info("human owner already present — refusing twin start")
            return

        http_client = AsyncOpenAI(
            base_url=f"{APP_URL}/api/live/agent",
            api_key=WORKER_TOKEN,
            default_headers={"x-nuncio-live-session": metadata.session_id},
        )
        session = AgentSession(
            vad=silero.VAD.load(),
            stt=elevenlabs.STT(
                model="scribe_v2_realtime",
                api_key=os.environ["ELEVEN_API_KEY"],
            ),
            llm=openai.LLM(model="nuncio", client=http_client),
            tts=elevenlabs.TTS(
                model="eleven_flash_v2_5",
                voice_id=metadata.voice_id,
                api_key=os.environ["ELEVEN_API_KEY"],
            ),
        )

        # The backend builds the authoritative prompt and ignores any supplied
        # system messages, so the agent itself carries no instructions and no
        # generated greeting.
        avatar = synthesia.AvatarSession(
            synthesia.AvatarConfig(avatar_ids=[metadata.avatar_id]),
        )

        shutdown = asyncio.Event()
        last_speech = asyncio.Event()
        last_speech.set()
        recipient_absent = {"since": None}

        def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
            if participant.identity.startswith("owner-"):
                logger.info("human owner joined — stepping aside")
                shutdown.set()
                return
            if participant.identity == recipient_identity:
                recipient_absent["since"] = None

        def on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
            if participant.identity == recipient_identity:
                recipient_absent["since"] = asyncio.get_event_loop().time()

        def mark_speech(event: object) -> None:
            if getattr(event, "is_final", False):
                last_speech.set()

        async def lifetime_watch() -> None:
            try:
                await asyncio.wait_for(shutdown.wait(), timeout=MAX_SESSION_SECONDS)
            except asyncio.TimeoutError:
                logger.info("session reached the five-minute cap")
            finally:
                shutdown.set()

        async def idle_watch() -> None:
            while not shutdown.is_set():
                last_speech.clear()
                try:
                    await asyncio.wait_for(last_speech.wait(), timeout=IDLE_SECONDS)
                except asyncio.TimeoutError:
                    logger.info("session idle timeout")
                    shutdown.set()

        async def grace_watch() -> None:
            while not shutdown.is_set():
                await asyncio.sleep(2)
                since = recipient_absent["since"]
                if since is not None and asyncio.get_event_loop().time() - since >= RECIPIENT_DISCONNECT_GRACE_SECONDS:
                    logger.info("recipient gone beyond reconnect grace")
                    shutdown.set()

        ctx.room.on("participant_connected", on_participant_connected)
        ctx.room.on("participant_disconnected", on_participant_disconnected)
        session.on("user_input_transcribed", mark_speech)

        tasks = [
            asyncio.create_task(lifetime_watch()),
            asyncio.create_task(idle_watch()),
            asyncio.create_task(grace_watch()),
        ]

        if has_owner() or shutdown.is_set():
            logger.info("human owner joined during startup — refusing twin start")
            return
        await avatar.start(session, room=ctx.room)
        if has_owner() or shutdown.is_set():
            logger.info("human owner joined during avatar start — stepping aside")
            return
        # Instructions intentionally empty: the backend gateway is the sole
        # prompt authority and drops any supplied system messages anyway.
        await session.start(agent=agents.Agent(instructions=""), room=ctx.room)
        logger.info("twin session started for live session %s", metadata.session_id)
        await shutdown.wait()
    except Exception as exc:
        logger.error("twin session failed: %s", type(exc).__name__)
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        # A human owner in the room means the twin must be fully gone — remove
        # the avatar participant and close the session before leaving.
        if connected:
            await remove_avatar_participant(ctx.room.name)
        if avatar is not None:
            with contextlib.suppress(Exception):
                await avatar.aclose()
        if session is not None:
            with contextlib.suppress(Exception):
                await session.aclose()
            await aclose_maybe(session.stt)
            await aclose_maybe(session.tts)
        if http_client is not None:
            await aclose_maybe(http_client)
        if connected:
            with contextlib.suppress(Exception):
                await ctx.room.disconnect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    agents.cli.run_app(server)
