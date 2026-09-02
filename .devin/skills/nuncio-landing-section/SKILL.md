---
name: nuncio-landing-section
description: Use when adding or editing a marketing section on nuncio (landing, playbook, pricing, share, live).
---

# nuncio landing section

## When to use
- Adding or editing a marketing/landing section on `/`, `/playbook`, `/pricing`, `/v/[id]`, `/live/[id]`.
- Building a new static page that needs the nuncio editorial/credible tone.

## Constraints
- One primary CTA per section; secondary actions use `border-cream-dark bg-white text-ink`.
- Type scale:
  - Microcopy/eyebrows: `text-label-xs`, `text-label-sm`, `text-label-base`
  - Body sentences: `text-body-xs`, `text-body-sm`
  - Never `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`
- Colors: `cream`, `ink`, `ink-light`, `ink-muted`, `ink-faint`, `accent`, `accent-soft`, `warm`, `warm-soft`, `success`, `success-soft` only.
- Motion:
  - Use `data-reveal` / `data-reveal-group` / `data-reveal-item` for ScrollTrigger reveals.
  - Use `data-motion-text="words"` or `data-motion-text="lines"` for staggered headlines.
  - Prefer explicit `transition-[color,background-color,border-color,opacity,box-shadow,transform]`.
  - Never `transition-all`.
  - Respect `useReducedMotion()` and `@media (prefers-reduced-motion: reduce)`.
- Layout: mobile-first, single-column, max-w container, no sidebars/tabs.
- Copy: sentence case, verb-first, no “AI-powered/magic/seamless/revolutionary”. Disclosure is a feature.

## Steps
1. Identify the one primary action and one headline.
2. Mark up the section root with `data-reveal="fade-up"`.
3. Wrap lists/cards in `data-reveal-group` and each item in `data-reveal-item data-reveal="fade-up"`.
4. Use the shared `Header` and `Footer` patterns.
5. Run `npm run build` and capture a screenshot before finishing.

## Common mistakes to avoid
- Do not use `italic` in headings.
- Do not add decorative symbols like `⌁`.
- Do not nest `<button>` elements. Use a `div` with `role="button"` if the row contains real action buttons.
