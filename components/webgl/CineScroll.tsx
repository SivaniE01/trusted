"use client";

import { useEffect, useRef, useState } from "react";
import type { CineEngine } from "@/components/webgl/cineEngine";
import { isCoarsePointer, isDialogOpen, prefersReducedMotion } from "@/lib/motion/env";

/**
 * Owns cinematic mode for the landing page.
 * - Starts the scroll engine (code-split) when motion is allowed.
 * - Keyboard users: the first Tab press switches to standard scrolling, so every section is reachable.
 * - Screen-reader users get a "Switch to standard scrolling" control at the top of the page.
 * - Standard mode keeps the POC's per-section edge fade.
 */
export function CineScroll() {
  const [cinematic, setCinematic] = useState(true);
  /** True only while the engine is actually running (never under reduced motion). */
  const [running, setRunning] = useState(false);
  const lastScene = useRef(0);
  const wasCinematic = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;

    /* touch devices scroll normally: the stop-by-stop engine fights native momentum scrolling */
    if (!cinematic || prefersReducedMotion() || isCoarsePointer()) {
      root.classList.remove("cine");
      if (wasCinematic.current) {
        /* the cine timeline's scroll offset means nothing in standard mode: return to the section being viewed */
        wasCinematic.current = false;
        const scene = main.querySelectorAll<HTMLElement>(":scope > .cine-scene")[lastScene.current];
        if (scene && lastScene.current > 0) scene.scrollIntoView({ block: "start", behavior: "instant" });
        else window.scrollTo({ top: 0, behavior: "instant" });
      }
      return startScrollFade();
    }

    root.classList.add("cine");
    wasCinematic.current = true;
    let engine: CineEngine | null = null;
    let cancelled = false;

    void import("@/components/webgl/cineEngine").then(({ startCineScroll }) => {
      if (cancelled) return;
      try {
        engine = startCineScroll(main);
        if (engine) setRunning(true);
        else setCinematic(false);
      } catch (error) {
        console.warn("Cinematic scroll disabled:", error);
        setCinematic(false);
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || isDialogOpen() || document.querySelector(".mobile-menu.open")) return;
      lastScene.current = engine?.activeScene() ?? 0;
      setCinematic(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKeyDown);
      if (engine) lastScene.current = engine.activeScene();
      engine?.dispose();
      root.classList.remove("cine");
      setRunning(false);
    };
  }, [cinematic]);

  if (!cinematic || !running) return null;
  return (
    <button
      type="button"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100000] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-cream"
      onClick={() => setCinematic(false)}
    >
      Switch to standard scrolling
    </button>
  );
}

/** POC "Scroll Fade In/Out Effect for viewport edges" (standard mode only). */
function startScrollFade(): () => void {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".section-shell"));
  const update = () => {
    const viewHeight = window.innerHeight;
    const edgeThreshold = 140;
    sections.forEach((sec) => {
      const rect = sec.getBoundingClientRect();
      sec.classList.toggle("scroll-fade-out", rect.bottom < edgeThreshold || rect.top > viewHeight - edgeThreshold);
    });
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
  return () => {
    window.removeEventListener("scroll", update);
    sections.forEach((sec) => sec.classList.remove("scroll-fade-out"));
  };
}
