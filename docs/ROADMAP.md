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

### Strategic Account Videos

nuncio is being sharpened around a narrower wedge: founders and small B2B teams pursuing high-value accounts, partnerships, investors, and other conversations where one thoughtful first message can change the relationship.

The product should not feel like another outbound sequence tool. It should feel like the fastest way to produce the account-specific video the sender would make manually if they had enough time.

- [x] Reposition landing page around high-value accounts, human review, and one-person-at-a-time quality
- [x] Reframe studio input around account, reason, review, and send
- [ ] Add visual proof inputs so videos can include sender-specific assets and recipient-specific context
- [ ] Build one polished account-film composition before adding format or template breadth
- [ ] Instrument the funnel from account added to reply or meeting outcome

### Visual Personalisation

The current vocal personalisation is stronger than the visual personalisation. The next product push should make each output look made for the recipient, not just sound like it was written for them.

Target composition:

1. **0-3s: target-specific hook** - recipient name, company, recent post, site, product, or relevant public signal.
2. **3-12s: why now** - a simple motion graphic that makes the reason for reaching out visible.
3. **12-22s: proof or offer** - sender product screenshot, result, customer proof, or relevant asset.
4. **22-30s: human close** - avatar or voice-led close with one clear next step.

Avatar remains useful, but it should be one ingredient in an account-specific film rather than the whole visual experience.

### Validation

Use London founder/operator access as a practical test bed before broadening the market.

- Pick two real products the team already wants to use nuncio for
- Choose 3-5 actual target accounts per product
- Produce current avatar-led videos and the new proof-first composition for the same accounts
- Show or send them to relevant founders, operators, and sales leads
- Ask which version feels actually made for them, whether they would send it, and what looks generic
- Treat repeat usage as the core signal: would they create another account-specific video without prompting?

---

## Next Steps

### High Priority
1. **Visual proof brief** - collect 1-3 sender assets: product screenshot, logo, proof point, case study, deck slide, or relevant URL
2. **Proof-first render path** - create one reusable composition that combines recipient research, sender asset, motion graphic, and avatar close
3. **Pre-send review** - make the research, hook, script, and visual plan reviewable before credits are spent
4. **Outcome tracking** - capture sent, watched, replied, meeting booked, and second-video-created events

### Medium Priority
1. **LinkedIn-first format** - optimise one aspect ratio and playback context before expanding to Instagram, X, and other channels
2. **Playbooks** - create a small set of opinionated flows: investor intro, strategic customer, partnership, recruiting, founder-to-founder
3. **Credit spend transparency** - show credits spent during the current session on the ready screen

### Lower Priority
1. **Persistent magic links** — move from in-memory to Turso/file storage
2. **One video player** — unify `/v/[id]` and `VideoPlayer` components
3. **Multi-language delivery** - auto-detect target language, offer in studio UI

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
- General-purpose motion graphics editor
- Broad template marketplace
- Browser extension
