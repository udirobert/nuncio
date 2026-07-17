"use client";

import { motion } from "motion/react";

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
    body: "Send a polished personal video and give a high-value conversation the attention it deserves.",
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
            A considered first message for the
            conversations that can change your business.
          </h2>
          <p className="text-ink-muted text-[15px] leading-relaxed">
            Research accelerates the work. You retain the judgement. Review the
            context, the hook, and the final script before anything is sent in
            your name.
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
