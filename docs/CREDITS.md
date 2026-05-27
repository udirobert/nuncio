# Credits & Cost Model

## Per-Action Credit Costs

| Action | Credits | Notes |
|--------|--------:|-------|
| `profile.research` | 1 | TinyFish enrichment (free tier) |
| `script.generate` | 1 | Featherless/Anthropic LLM call |
| `soundscape.generate` | 1 | ElevenLabs sound effects generation |
| `video.render` | 8 | HeyGen Video Agent ($2/min × 30s = $1.00) |
| `video.translate` | 2 | HeyGen translation ($2/min) |
| `captions.generate` | 1 | Speechmatics transcription |
| `preview.generate` | 0 | Free — LLM only, no external rendering |

**Full pipeline:** 1 + 1 + 1 + 8 = **10 credits per 30s video**

## Provider Costs (as of May 2026)

| Provider | Service | Cost | How billed |
|----------|---------|-----:|------------|
| **TinyFish** | Profile enrichment | $0 | Search and Fetch are free; Agent not used |
| **Featherless** | LLM (DeepSeek V4 Flash, 284B) | $0.002/video | Flat $25-200/mo per API key (shared across users) |
| **HeyGen** | Video Agent API | **$1.00/30s** | $2/min pay-as-you-go (dominant cost) |
| **ElevenLabs** | Sound effects generation | **$0.12/gen** | $0.12/generation |
| **Speechmatics** | Caption transcription | $0.002/video | $0.004/min; 480 min free/mo covers most usage |
| **Resend** | Magic link email | $0 | Free tier covers low-volume auth emails |

**Variable cost per video: ~$1.12** (HeyGen $1.00 + ElevenLabs $0.12 + negligible others)
**Fixed shared costs: ~$200/mo** (Featherless $200)

## Unit Economics

### Plan Pricing (updated)

| Plan | Price | Credits | Cost/credit | Videos/plan | Rev/video | Margin/video |
|------|------:|--------:|------------:|------------:|----------:|-------------:|
| Trial | $0 | 10 | — | 0 (1 attempt) | — | — |
| Pro Monthly | **$39** | 200 | **$0.195** | ~18 | **$2.15** | **~48%** |
| Pro Annual | **$390/yr** | 2,400 | **$0.163** | ~218 | **$1.79** | **~37%** |
| Studio | $79 | 1,000 | $0.079 | ~91 | $0.87 | **-22%** |
| 100-pack | $15 | 100 | $0.150 | ~9 | $1.65 | ~32% |
| 500-pack | $59 | 500 | $0.118 | ~45 | $1.30 | ~14% |
| 1,000-pack | $99 | 1,000 | $0.099 | ~91 | $1.09 | **-3%** |

### How margin is calculated

Each action's credit cost was chosen to cover its external API cost at the Pro Monthly credit price ($0.195/credit):

| Action | API cost | Credits | Revenue | Margin |
|--------|--------:|--------:|--------:|------:|
| research | $0.00 | 1 | $0.20 | 100% |
| script | $0.002 | 1 | $0.20 | ~99% |
| soundscape | $0.12 | 1 | $0.20 | ~40% |
| render | $1.00 | 8 | $1.56 | ~36% |
| translate | $1.00 | 2 | $0.39 | **-61%** |
| captions | $0.002 | 1 | $0.20 | ~99% |

## Key Decisions

- **video.render dominates** — HeyGen costs 10× the next provider. Raising it from 5→8 credits was the primary tuning lever.
- **soundscape.generate added** — ElevenLabs sound effects cost $0.12 each; the pipeline now reserves 1 credit for it.
- **Pro raised to $39/mo** — The $29/mo price left essentially zero per-video margin after HeyGen costs. $39/mo at 200 credits gives $0.195/credit, yielding ~48% margin on a full 11-credit video.
- **Studio & credit packs are thin** — These subsidise volume. Users on these plans need to not fully use all credits for the plan to be profitable. This is acceptable for initial launch; re-evaluate at scale.
- **translate loses money** — At $2/min HeyGen cost, 2 credits × $0.195 = $0.39 revenue vs $1.00 cost. Translate is a value-add feature; the loss is absorbed by overall plan margin.

## Adjustment Process

When tuning credit costs:

1. Update the cost in `src/lib/billing/credits.ts` (`COSTS` map)
2. Update `src/lib/billing/credits.test.ts` if tests hardcode the value
3. Update `src/app/pricing/page.tsx` FAQ if the pipeline credit total changes
4. If adding a new credit action, add it to the `CreditAction` type and the `COSTS` map
5. Wire up `reserveCredits` + `commitCreditReservation` in any new route that uses the action
6. Create new Stripe prices if plan prices change, then update env vars in Coolify
7. Redeploy
