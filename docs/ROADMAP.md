# Roadmap

## Status

nuncio is in production. The core multi-agent pipeline — research → write → validate → render — is live with:
- Band multi-agent coordination
- TinyFish enrichment
- Claude/Featherless script generation
- ElevenLabs audio (soundscape, cinematic entrance)
- HeyGen video rendering
- Speechmatics captions
- Branded share pages
- Demo mode (`?demo=true`)

---

## Current Focus

### Band Integration (Phase 8)
- [x] Band SDK client setup
- [x] 4-agent room architecture (Researcher, Copywriter, QA, Producer)
- [x] Agent wrappers importing existing library functions
- [x] Studio UI showing agent collaboration
- [ ] Production server wiring

### Voice Agent
- [x] ElevenLabs Speech Engine integration
- [x] Voice overlay UI in studio
- [x] Conversation token endpoint
- [ ] End-to-end testing

---

## Next Steps

### High Priority
1. **Band production wiring** — wire agents to production server
2. **Demo recording** — record a real golden-path video for hackathon submission
3. **Multi-language delivery** — auto-detect target language, offer in studio UI

### Medium Priority
1. **View tracking** — track video views on `/v/[id]`
2. **Mobile responsiveness** — test and fix on actual devices
3. **Email gate UX** — improve email capture context

### Lower Priority
1. **Persistent magic links** — move from in-memory to Turso/file storage
2. **One video player** — unify `/v/[id]` and `VideoPlayer` components

---

## Known Constraints

- **HeyGen generation time:** 60–180 seconds per video
- **TinyFish login walls:** Some profiles require authentication
- **In-memory magic link tokens:** Single-instance limitation

---

## Icebox (Out of Scope)

- Real-time streaming video generation
- On-device voice cloning
- Video personalization with target's face/voice (deepfake — explicitly out)
- Browser extension