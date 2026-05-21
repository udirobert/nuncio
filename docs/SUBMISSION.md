# ElevenLabs × Stripe Hackathon Submission

## Loom Demo Script

Target: ~3 minutes. Conversational, show don't tell.

---

### INTRO (0:00–0:20)

> "Hey — this is nuncio. It's a tool that turns any social profile into a personalised video outreach in under 5 minutes. I built it because cold outreach has a less than 5% reply rate, and the reason is simple: people can tell when something wasn't made for them. Nuncio fixes that."

**Show:** The studio landing page, clean and empty.

---

### THE FLOW (0:20–1:00)

> "Here's how it works. I paste someone's Twitter or LinkedIn URL, add my name, and optionally a one-line brief about why I'm reaching out."

**Action:** Paste a URL (e.g. `https://x.com/n0w00j`), type your name, hit "Research profile."

> "The agent goes and reads their public profile, figures out who they are, what they care about, and drafts a personalised script. This takes about 8 seconds."

**Show:** The enriching spinner, then the review stage appearing.

---

### ELEVENLABS — SCRIPT PREVIEW (1:00–1:30)

> "Before I commit to rendering a full video, I can hear what this script sounds like. This is ElevenLabs text-to-speech — I hit 'Hear it' and get an instant audio preview of the script."

**Action:** Click "Hear it" button. Let it play for 5-10 seconds.

> "I can edit the script, tweak the tone, remove a personalization hook that doesn't land — and hear it again. This saves me from burning a 4-minute video render on a script that doesn't sound right."

**Show:** Edit a word in the script, show the button resets.

---

### ELEVENLABS — CINEMATIC SOUNDSCAPE (1:30–2:00)

> "The second ElevenLabs integration is what I call Cinematic Soundscapes. When the video renders, nuncio generates a context-aware ambient audio layer using ElevenLabs Sound Effects. If I'm reaching out to a startup founder, it picks 'Startup Hustle' — high-energy office ambience. A designer gets 'Zen Studio.' The recipient doesn't just watch a talking head in silence — they hear an atmosphere that was chosen for them."

**Show:** Point to the vibe selector in customization, or show the soundscape toggle on the video player with the animated bars.

> "The audio ducks automatically when the avatar speaks and swells back up during pauses — like a professional broadcast mix."

---

### ELEVENLABS — AUDIO MEMO HOOK (2:00–2:20)

> "Third — the audio memo. Sending a video link cold in a DM is high friction. So nuncio generates a 10-second voice teaser: 'Hey Joowon, I put together a quick video for you about what you're building at Melius — check the link below.' You send that as a voice note first, then drop the link. Open rates go way up."

**Action:** Click "Audio memo" button, show the player appear, hit play briefly.

---

### STRIPE — MONETIZATION (2:20–2:45)

> "On the Stripe side — nuncio has a full subscription flow. Free users get limited generations with watermarks. Pro unlocks unlimited renders, no watermarks, and priority generation. The checkout, webhooks, and subscription management are all wired through Stripe."

**Show:** Briefly flash the pricing page or the Pro badge in the UI. Don't dwell — judges can see the code.

---

### CLOSE (2:45–3:00)

> "So that's nuncio — personalised video outreach powered by ElevenLabs for the audio intelligence and Stripe for the business model. Three ElevenLabs integrations: TTS script preview, cinematic soundscapes, and audio memo hooks. All solving real friction points in the outreach workflow. Thanks for watching."

**End on:** The completed video playing with the soundscape visualizer active.

---

## Technical Summary (for written submission)

### ElevenLabs Integration

| Feature | API Used | Purpose |
|---------|----------|---------|
| Script Preview | Text-to-Speech (`eleven_flash_v2_5`) | Hear the script before committing to a video render |
| Cinematic Soundscape | Sound Effects API | Context-aware ambient audio layer matched to recipient's industry |
| Audio Memo Hook | Text-to-Speech (`eleven_flash_v2_5`) | Short voice teaser for DM outreach before sharing the full video |

### Stripe Integration

| Feature | API Used |
|---------|----------|
| Pro subscriptions | Checkout Sessions, Customer Portal |
| Webhook handling | `checkout.session.completed`, `customer.subscription.*` |
| Tiered access | Free (limited, watermarked) → Pro (unlimited, clean) |
| Payment page | `/pricing` with monthly/annual toggle |

### Stack

- Next.js 16 (App Router)
- Venice AI (DeepSeek V4 Flash) for LLM inference
- TinyFish for profile enrichment
- ElevenLabs for TTS + Sound Effects
- HeyGen for avatar video rendering
- Melius MCP for creative canvas
- Stripe for payments
- Coolify on Vultr for deployment

### Links

- Live: https://nuncio.app/studio
- Repo: https://github.com/udirobert/nuncio
- Pricing: https://nuncio.app/pricing

---

## Social Post Templates

### X/Twitter

> Just shipped nuncio for #ElevenHacks — personalised video outreach that sounds as good as it looks.
>
> 3 @elevenlabsio integrations:
> 🎙️ TTS script preview (hear before you render)
> 🎬 Cinematic soundscapes (AI-generated ambient audio per recipient)
> 🎤 Audio memo hooks (voice teasers for DMs)
>
> Monetized with @stripe subscriptions.
>
> [link to demo video]

### LinkedIn

> Built something for the ElevenLabs × Stripe hackathon: nuncio — an AI tool that turns any social profile into a personalised video outreach.
>
> The ElevenLabs integration goes beyond basic voiceovers:
> • Script preview via TTS — hear your script before burning a 4-min render
> • Cinematic soundscapes — AI-generated ambient audio matched to the recipient's industry
> • Audio memo hooks — short voice teasers to send as DM openers
>
> Stripe handles Pro subscriptions for unlimited renders.
>
> Cold outreach has a <5% reply rate. Personalised video changes that. #ElevenHacks
