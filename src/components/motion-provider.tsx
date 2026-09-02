"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { initScrollReveals } from "@/lib/gsap-reveals";

let globalInitDone = false;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (globalInitDone) return;
    globalInitDone = true;

    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!reduceMotion) {
      const lenis = new Lenis({
        lerp: 0.08,
        smoothWheel: true,
        wheelMultiplier: 0.9,
        anchors: true,
      });

      lenis.on("scroll", ScrollTrigger.update);

      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });

      gsap.ticker.lagSmoothing(0);
      lenisRef.current = lenis;
    }

    // Default motion language: smooth, editorial, restrained.
    gsap.defaults({ ease: "power3.out", duration: 0.85 });

    const refresh = () => {
      initScrollReveals();
      ScrollTrigger.refresh();
    };

    if (document.readyState === "complete") {
      requestAnimationFrame(refresh);
    } else {
      window.addEventListener("load", refresh);
    }

    return () => {
      window.removeEventListener("load", refresh);
      lenisRef.current?.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      globalInitDone = false;
    };
  }, []);

  return <>{children}</>;
}
