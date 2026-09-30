"use client";

const TILES = [
  {
    step: "01",
    title: "Set up",
    body: "Tell Nuncio who your representative speaks for and set the playbook boundaries it answers within.",
  },
  {
    step: "02",
    title: "Send a relevant opening",
    body: "Start with a person worth real effort. You approve the opening before anything leaves your name.",
  },
  {
    step: "03",
    title: "The recipient chooses",
    body: "On the link they can ask your disclosed AI representative, request you when you're taking calls, or choose a time if you configured a scheduling link — no AI step is compulsory.",
  },
  {
    step: "04",
    title: "You join when it matters",
    body: "You accept a request and join a shared browser call. The AI steps aside — it bridges the conversation, it isn't part of it.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-10 md:py-14 border-t border-cream-dark/60">
      <div className="max-w-6xl mx-auto">
        <div
          data-reveal="fade-up"
          className="mb-8 md:mb-10 max-w-2xl"
        >
          <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-3">
            How nuncio works
          </p>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-[1] mb-4">
            A considered first message for the
            conversations that can change your business.
          </h2>
          <p className="text-ink-muted text-body-sm leading-relaxed">
            Research accelerates the work. You retain the judgement — approve the
            opening, and set the boundaries the representative answers within.
          </p>
        </div>

        <div data-reveal-group className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {TILES.map((tile) => (
            <div
              key={tile.step}
              data-reveal-item
              data-reveal="fade-up"
              className="rounded-2xl border border-cream-dark bg-white/70 p-6 card-hover hover:bg-white"
            >
              <div className="mb-4">
                <span className="text-label-sm uppercase tracking-widest text-accent font-medium">
                  {tile.step}
                </span>
              </div>
              <h3 className="font-display text-2xl tracking-tight mb-2">
                {tile.title}
              </h3>
              <p className="text-body-xs text-ink-muted leading-relaxed">
                {tile.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
