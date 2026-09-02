---
name: nuncio-studio-form
description: Use when adding or editing a form, input group, or card in the nuncio studio pipeline.
---

# nuncio studio form

## When to use
- Adding/editing inputs, cards, steppers, review cards, or ready-state CTAs in `/studio`.
- Building a new pipeline step UI.

## Constraints
- One primary CTA per card/step. Secondary actions are `border-cream-dark bg-white text-ink`.
- Form fields must have visible labels, not placeholder-only.
- Inputs use `rounded-xl border border-cream-dark bg-white`.
- Focus rings: use the global `*:focus-visible` style in `globals.css` (no custom transition).
- Type scale: `text-body-sm` for inputs, `text-label-sm` for labels.
- Motion:
  - Prefer `transition-[color,background-color,border-color,opacity,box-shadow,transform]`.
  - Never `transition-all`.
  - Respect `useReducedMotion()`.
- Progress stepper: three states (pending, active/pulse, complete/check). Use `role="status"` and live-region updates.
- Error states: inline, explain what failed and the next action.

## Steps
1. Identify the step or card in the pipeline (input, progress, review, ready, error).
2. Use the existing `url-form`, `voice-overlay`, `script-review`, or `video-player` patterns.
3. Add labels and helper text with the approved type scale.
4. Ensure the primary action is visually dominant; secondary actions are outlined.
5. Run `npm run build`.

## Common mistakes to avoid
- Do not add a second primary CTA inside a card (e.g. “Start voice brief” and “Generate video” at the same hierarchy).
- Do not hide errors in modals.
- Do not animate `width`/`height` directly; use `scale` or `transform`.
