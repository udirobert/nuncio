import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const revealPresets: Record<
  string,
  { from: gsap.TweenVars; to: gsap.TweenVars }
> = {
  "fade-up": {
    from: { y: 32, autoAlpha: 0 },
    to: { y: 0, autoAlpha: 1 },
  },
  "blur-in": {
    from: { y: 18, autoAlpha: 0, filter: "blur(10px)" },
    to: { y: 0, autoAlpha: 1, filter: "blur(0px)" },
  },
  scale: {
    from: { scale: 0.96, autoAlpha: 0 },
    to: { scale: 1, autoAlpha: 1 },
  },
  "slide-left": {
    from: { x: 48, autoAlpha: 0 },
    to: { x: 0, autoAlpha: 1 },
  },
  "slide-right": {
    from: { x: -48, autoAlpha: 0 },
    to: { x: 0, autoAlpha: 1 },
  },
};

export function initScrollReveals() {
  if (typeof window === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  if (reduceMotion) {
    gsap.set("[data-reveal], [data-reveal-item], [data-motion-text]", {
      autoAlpha: 1,
    });
    return;
  }

  // Reveal groups (cards, lists)
  gsap.utils.toArray("[data-reveal-group]").forEach((group) => {
    const items = (group as HTMLElement).querySelectorAll("[data-reveal-item]");
    if (!items.length) return;

    gsap.fromTo(
      items,
      { y: 36, autoAlpha: 0, filter: "blur(8px)" },
      {
        y: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.95,
        ease: "power4.out",
        stagger: 0.075,
        scrollTrigger: {
          trigger: group as HTMLElement,
          start: "top 82%",
          once: true,
        },
      }
    );
  });

  // Individual reveals
  gsap.utils.toArray("[data-reveal]:not([data-reveal-item])").forEach((el) => {
    const element = el as HTMLElement;
    const preset = revealPresets[element.dataset.reveal || "fade-up"] || revealPresets["fade-up"];
    const delay = Number(element.dataset.revealDelay || 0);

    gsap.fromTo(element, preset.from, {
      ...preset.to,
      duration: 0.9,
      ease: "power4.out",
      delay,
      scrollTrigger: {
        trigger: element,
        start: "top 84%",
        once: true,
      },
    });
  });

  // Staggered text reveals
  gsap.utils.toArray("[data-motion-text='words']").forEach((el) => {
    const element = el as HTMLElement;
    const words = splitWords(element);

    gsap.set(element, { autoAlpha: 1 });
    gsap.fromTo(
      words,
      { yPercent: 110, autoAlpha: 0, filter: "blur(8px)" },
      {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "power4.out",
        stagger: 0.055,
        scrollTrigger: {
          trigger: element,
          start: "top 82%",
          once: true,
        },
      }
    );
  });

  gsap.utils.toArray("[data-motion-text='lines']").forEach((el) => {
    const element = el as HTMLElement;
    const lines = splitLines(element);

    gsap.set(element, { autoAlpha: 1 });
    gsap.fromTo(
      lines,
      { yPercent: 100, autoAlpha: 0, filter: "blur(8px)" },
      {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 1,
        ease: "power4.out",
        stagger: 0.11,
        scrollTrigger: {
          trigger: element,
          start: "top 84%",
          once: true,
        },
      }
    );
  });
}

function splitWords(element: HTMLElement) {
  if (element.dataset.motionSplit === "true") {
    return element.querySelectorAll(".motion-word");
  }

  const text = element.textContent || "";
  const parts = text.split(/(\s+)/);
  element.textContent = "";
  element.setAttribute("aria-label", text.trim());

  let index = 0;
  parts.forEach((part) => {
    if (!part.trim()) {
      element.appendChild(document.createTextNode(part));
      return;
    }

    const mask = document.createElement("span");
    const word = document.createElement("span");

    mask.className = "motion-word-mask";
    mask.setAttribute("aria-hidden", "true");
    word.className = "motion-word";
    word.textContent = part;
    word.style.setProperty("--word-index", String(index));

    mask.appendChild(word);
    element.appendChild(mask);
    index += 1;
  });

  element.dataset.motionSplit = "true";
  return element.querySelectorAll(".motion-word");
}

function splitLines(element: HTMLElement) {
  if (element.dataset.motionLineSplit === "true") {
    return element.querySelectorAll(".motion-line");
  }

  const text = (element.textContent || "").trim();
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    // Not enough lines — fall back to word split.
    return splitWords(element);
  }

  element.textContent = "";
  element.setAttribute("aria-label", text);

  lines.forEach((line) => {
    const mask = document.createElement("span");
    const inner = document.createElement("span");

    mask.className = "motion-line-mask";
    mask.setAttribute("aria-hidden", "true");
    inner.className = "motion-line";
    inner.textContent = line;

    mask.appendChild(inner);
    element.appendChild(mask);
    element.appendChild(document.createTextNode(" "));
  });

  element.dataset.motionLineSplit = "true";
  return element.querySelectorAll(".motion-line");
}
