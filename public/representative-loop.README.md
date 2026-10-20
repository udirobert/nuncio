# public/representative-loop.mp4

The loop that plays in the landing hero: the deployment's default AI
representative (the Anam persona the app falls back to when a sender has
not uploaded a photo of themselves).

- **Who it is:** the default persona configured for this deployment
  (`ANAM_AVATAR_ID`). It is a synthetic provider persona — not a real
  customer, not an employee, and not anyone's likeness being used to
  represent them.
- **How it was made:** rendered by the provider, then trimmed to six
  seconds and mirrored so it loops seamlessly, scaled to 720×480, muted,
  and encoded without an audio track (163 KB).
- **What it is for:** showing, above the fold, that the product is a
  *talking face*. The hero labels it as a disclosed AI representative
  standing in for the sender — it is not the sender.

Replacing it: drop a 16:9 (or 3:2) muted, seamless loop at this path.
The component falls back to `public/representative.webp` when the video
cannot play.
