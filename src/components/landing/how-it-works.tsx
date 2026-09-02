"use client";

const TILES = [
  {
    step: "01",
    title: "Choose",
    body: "Start with a person or company worth real effort—not a list you plan to blast.",
  },
  {
    step: "02",
    title: "Ground it",
    body: "Nuncio turns public context and your reason for reaching out into a relevant, specific opening.",
  },
  {
    step: "03",
    title: "Make it yours",
    body: "Edit the hook, script, and creative direction until it sounds like a message you would actually send.",
  },
  {
    step: "04",
    title: "Open a door",
    body: "Your disclosed AI twin takes the first meeting live — with a recorded video riding along as fallback.",
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
            Research accelerates the work. You retain the judgement. Review the
            context, the hook, and the final script before anything is sent in
            your name.
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
