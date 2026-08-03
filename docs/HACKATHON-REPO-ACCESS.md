# Hackathon Repo Access Setup

**Required by**: Backblaze Generative AI Media Hackathon  
**Reason**: Private repositories must grant `b2genblaze` contributor access for judging

## Steps to Grant Access

1. Go to: https://github.com/udirobert/nuncio/settings/access
2. Click **"Add people"**
3. Search for: `b2genblaze`
4. Select role: **Read** (or **Write** if you want judges to be able to open PRs)
5. Click **"Add"**
6. Confirm the invitation in your email

## What Judges Need to See

✅ Working app URL: https://nuncio.persidian.com  
✅ GitHub repo with setup instructions: `README.md` + `AGENTS.md`  
✅ B2 and Genblaze usage documented: `docs/DEVPOST-BACKBLAZE.md`  
✅ Demo video (to be recorded)

## Credit System & Judge Access

Nuncio uses a credit-based metering system for media generation (research, script, video render, Genblaze composite). Each visitor receives **15 trial credits** on first interaction — enough for ~1-2 full pipeline runs (research: 1, script: 1, render: 8, Genblaze composite: ~2).

**Credits are enforced in production** (`NUNCIO_CREDITS_ENFORCED=true`). After trial credits are exhausted, the app returns a 402 and prompts the user to purchase more via Stripe Checkout. This is intentional — it demonstrates production-grade metering, not a demo with unlimited free usage.

**To top up credits (judges):**
1. Click "Get more credits" or visit the [pricing page](https://nuncio.persidian.com/pricing)
2. Purchase a credit pack (100 credits for $15 or 500 credits for $99) — **this is a live Stripe Checkout in production mode**
3. Use any valid card — the Stripe integration is fully live, not test mode
4. Credits are granted automatically via webhook on successful payment

**Why live Stripe:** Nuncio's autonomous agent earns revenue by booking meetings via Stripe Checkout (`/api/agent/earn-checkout`). The credit system and the earning flow share the same Stripe integration. Using live mode ensures both spend and earn paths are production-validated.

## Credit Costs

| Action | Credits |
|--------|---------|
| Profile research | 1 |
| Script generation | 1 |
| Deep research (optional) | 3 |
| Video render (HeyGen) | 8 |
| **Typical pipeline run** | **~10** |
| **With deep research** | **~13** |

## Repo Already Has

- ✅ `.gitignore` excludes all `.env` files
- ✅ No secrets committed (only `.env.example` tracked)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Clear setup instructions
- ✅ Production deployment script
- ✅ Genblaze worker README with setup steps

## Checklist Before Submission

- [ ] Grant `b2genblaze` contributor access
- [ ] Record 3-min demo video showing:
  - User creates video in studio
  - Video renders via HeyGen
  - Genblaze composite pipeline runs (thumbnail + soundscape + narration in one run)
  - B2 persist endpoint called (check network tab)
  - Share page loads video via presigned URL
  - Genblaze worker logs show composite generation
- [ ] Verify demo video is < 3 minutes
- [ ] Submit via Devpost before **Aug 4, 2026 @ 12:00am GMT+3**

## Key Files for Judges

| File | What to look for |
|------|-----------------|
| `src/lib/pipeline/steps.ts` | Pipeline single source of truth — `generateMediaAssets()` is Step 6, calls Genblaze composite + persists to B2 |
| `src/app/api/pipeline/route.ts` | Studio pipeline route — calls `generateMediaAssets()` after `renderVideo()` |
| `src/app/api/agent/prospect-queue/route.ts` | Autonomous agent endpoint — same shared `generateMediaAssets()` step (DRY) |
| `workers/genblaze/providers.py` | Genblaze SDK usage — `Pipeline("nuncio-composite")` with GMI Cloud + ElevenLabs |
| `src/lib/storage/b2-provider.ts` | B2 S3-compatible storage — presigned URLs, user-defined metadata, `listKeys` |
| `src/lib/storage/media-store.ts` | B2 persistence layer — `persistVideo`, `persistTrace`, `persistAssetManifest` |
| `src/lib/genblaze-client.ts` | TypeScript client for the Genblaze worker |

## Notes

- Repo is currently **private**. If you want it public for portfolio purposes, you can change visibility after granting judge access.
- The `b2genblaze` account is Backblaze's official judging account. Granting read access is safe and required for evaluation.
- All production credentials are in `.env` files which are gitignored. Judges will see the setup instructions but not the actual secrets.
