"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./utils";

/**
 * The dashboard's one orchestrated moment: numbers count up on first load.
 * Reduced motion (or later value changes) → snap straight to the value.
 */
export function useCountUp(target: number | undefined, duration = 650): number | undefined {
  const [display, setDisplay] = useState<number | undefined>(undefined);
  const animated = useRef(false);

  useEffect(() => {
    if (target === undefined) return;
    if (animated.current || prefersReducedMotion() || target === 0) {
      animated.current = true;
      setDisplay(target);
      return;
    }
    animated.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
