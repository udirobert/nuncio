"""Entrypoint — starts all four Nuncio Band agents concurrently."""

from __future__ import annotations

import asyncio
import logging
import os
import sys

from band.agent import Agent

from nuncio_agents.researcher import ResearcherAdapter
from nuncio_agents.copywriter import CopywriterAdapter
from nuncio_agents.reviewer import ReviewerAdapter
from nuncio_agents.producer import ProducerAdapter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def _env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        logger.error("Missing required env var: %s", key)
        sys.exit(1)
    return val


def _create_agents() -> list[Agent]:
    api_key = _env("BAND_API_KEY")

    specs = [
        ("researcher", "BAND_RESEARCHER_AGENT_ID", ResearcherAdapter),
        ("copywriter", "BAND_COPYWRITER_AGENT_ID", CopywriterAdapter),
        ("reviewer", "BAND_REVIEWER_AGENT_ID", ReviewerAdapter),
        ("producer", "BAND_PRODUCER_AGENT_ID", ProducerAdapter),
    ]

    agents = []
    for label, env_key, adapter_cls in specs:
        agent_id = _env(env_key)
        agent = Agent.create(
            adapter=adapter_cls(),
            agent_id=agent_id,
            api_key=api_key,
        )
        agents.append(agent)
        logger.info("Created agent: %s (id=%s...)", label, agent_id[:8])

    return agents


async def main() -> None:
    agents = _create_agents()

    for agent in agents:
        await agent.start()
        logger.info("Started agent: %s", agent.agent_name)

    logger.info("All %d agents running. Press Ctrl+C to stop.", len(agents))

    try:
        await asyncio.gather(*(a.run_forever() for a in agents))
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Shutting down agents...")
    finally:
        for agent in agents:
            await agent.stop(timeout=15)
            logger.info("Stopped agent: %s", agent.agent_name)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted — exiting.")
