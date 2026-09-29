# Plow base image for OpenClaw — pinned by digest. Bump tag + digest together.
# Latest: https://github.com/plow-pbc/plow-openclaw-agent/commits/main
# Digest: https://public.ecr.aws/e1h7x4a2/plow-cloud-agents (tag base-<commit>)
FROM public.ecr.aws/e1h7x4a2/plow-cloud-agents:base-771198a9609dcef54d44843e7da5329c17fa51b4@sha256:f1e7c421b97a80f1bd17015f96daceb965f350a241f7edc7e4d856a0e3a6f8f5

# Agent Index identity. On boot the image registers this slug on
# https://aiworthusing.com/agent-index and reports token usage every 5 min.
# A cloud install runs the image with no compose file — these must be baked in.
ENV AGENT_ID=nuncio \
    AGENT_NAME="Nuncio" \
    AGENT_BLURB="Your first SDR hire: a disclosed AI twin that researches a prospect, writes the first touch in your voice, follows up, and books the meeting." \
    AGENT_RUNTIME=OpenClaw \
    NUNCIO_API_URL=https://nuncio.persidian.com \
    PLOW_THREAD_TRUST=untrusted

# Persona and skills fully replace / merge over the base image content.
# Named persona.md in this repo so it isn't picked up as a project rules file;
# the image expects it at /opt/plow/prompt/AGENTS.md.
COPY prompt/persona.md /opt/plow/prompt/AGENTS.md
COPY skills/ /opt/plow/skills/

# Per-install overrides (compose env_file only, never baked):
#   NUNCIO_AGENT_TOKEN — unlocks the full pipeline incl. video/live render
#     via /api/agent/prospect-queue. Without it the agent uses the public
#     rate-limited /api/agent/lite endpoint and in-chat research fallback.
