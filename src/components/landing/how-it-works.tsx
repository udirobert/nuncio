"use client";

import { motion } from "motion/react";

const TILES = [
  {
    step: "01",
    title: "Enrich",
    body: "TinyFish reads every public profile in parallel — LinkedIn, X, GitHub, Farcaster — and returns structured context, not scraped soup.",
  },
  {
    step: "02",
    title: "Synthesise",
    body: "Claude merges the sources into one rich profile and writes a script that references real, recent work — not job titles or generic flattery.",
  },
  {
    step: "03",
    title: "Compose",
    body: "The creative agent picks supporting visuals, organises assets, and prepares a 3-scene structure that matches the message's intent.",
  },
  {
    step: "04",
    title: "Render",
    body: "HeyGen renders the video with your cloned voice and avatar, captioned by Speechmatics. Branded share page included.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-10 md:py-14 border-t border-cream-dark/60">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 md:mb-10 max-w-2xl"
        >
          <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-3">
            How nuncio works
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[1] mb-4">
            Four agents, <span className="italic">ninety seconds</span>, one video
            that sounds like you wrote it.
          </h2>
          <p className="text-ink-muted text-[15px] leading-relaxed">
            Every step is auditable. The agent shows you what it pulled, what it
            chose to use, and what it deliberately ignored — so you can trust
            what gets sent in your name.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {TILES.map((tile, i) => (
            <motion.div
              key={tile.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="rounded-2xl border border-cream-dark bg-white/70 p-6 hover:bg-white hover:shadow-md transition-all"
            >
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest text-accent font-medium">
                  {tile.step}
                </span>
                <span className="font-[family-name:var(--font-display)] text-xl text-ink-faint/60">
                  ⌁
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-tight mb-2">
                {tile.title}
              </h3>
              <p className="text-[13px] text-ink-muted leading-relaxed">
                {tile.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
