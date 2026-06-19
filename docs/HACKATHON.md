# Band of Agents Hackathon Submission

**Event:** Band of Agents Hackathon (lablab.ai)
**Dates:** June 12–19, 2026
**Track:** Track 1: Internal Enterprise Workflows
**Prize pool:** $10,000+

---

## Project: nuncio

**Short description:**
nuncio is a collaborative video personalization platform where specialized AI agents research prospects, craft personalized scripts, validate compliance, and render videos—all coordinated through Band's multi-agent room.

**Long description:**
nuncio transforms cold sales outreach into personalized video campaigns through a collaborative multi-agent system built on Band. Instead of a linear pipeline, users join a Band Room where four specialized agents work together:

1. **Researcher Agent** — enriches prospect profiles via TinyFish
2. **Copywriter Agent** — generates personalization angles and drafts scripts via Claude/Featherless
3. **QA/Compliance Agent** — validates word counts, brand safety, and pronunciation
4. **Producer Agent** — renders the final video via HeyGen with ElevenLabs audio

Collaboration happens through Band—agents post structured messages, delegate work, and coordinate state in real-time. Users see agent reasoning, approve angles, and track progress in a shared transcript.

---

## Enterprise Value

- **Real problem:** Sales teams need personalized video at scale, but current solutions are templates or black-box pipelines
- **Visibility:** nuncio makes collaboration visible, auditable, and human-in-the-loop
- **Audit trail:** Every agent decision is logged in the Band Room
- **Human approval:** Required before video renders

---

## Technology Stack

| Technology | Role |
|------------|------|
| Band | Multi-agent coordination layer |
| Anthropic Claude / Featherless AI | Intelligence |
| TinyFish | Profile enrichment |
| HeyGen | Video generation |
| ElevenLabs | Voice & audio |
| Next.js 16 | Frontend |
| Turso/SQLite | Storage |

---

## Demo Script (2–3 minutes)

1. **0:00–0:20** — Problem: cold outreach has <5% reply rate
2. **0:20–0:40** — Solution: nuncio. Drop a profile URL, get a video
3. **0:40–1:30** — Live demo: paste URL, show agents working in parallel
4. **1:30–1:50** — Approve script, video renders
5. **1:50–2:10** — Show video output and share page

---

## Implementation Status

- [x] Band SDK client setup
- [x] 4-agent room architecture
- [x] Agent wrappers importing existing library functions
- [x] Studio UI showing agent collaboration
- [x] Production server wiring
- [ ] End-to-end test with real Band room
- [ ] Demo video recording

---

## Pitch One-Liner

> "nuncio shifts sales personalization from a black-box pipeline to a collaborative Band Room where specialized agents research, write, audit, and render your outreach video under direct human oversight."

---

## Links

- **GitHub:** https://github.com/udirobert/nuncio
- **Demo:** https://nuncio.persidian.com?demo=true
- **Architecture:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Band Integration:** [`docs/BAND_INTEGRATION.md`](./BAND_INTEGRATION.md)