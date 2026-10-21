import { useEffect, useState } from "react";

/**
 * A CSS media query as a boolean.
 *
 * Used where CSS alone cannot do the job — chiefly so that a heavy asset (a
 * video) is mounted in only one place. Rendering a scene twice and hiding one
 * copy with `display: none` still costs a second network request for the
 * media; mounting one copy and choosing its layout in JS does not.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Deferred so the effect never sets state synchronously.
    const raf = requestAnimationFrame(() => setMatches(m.matches));
    m.addEventListener("change", handler);
    return () => {
      cancelAnimationFrame(raf);
      m.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}

/** The breakpoint the house uses for the desktop hero grid. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
