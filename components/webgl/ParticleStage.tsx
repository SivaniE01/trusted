"use client";

import { useEffect, useRef } from "react";

/**
 * Fixed background stage: CSS fallback image + WebGL planet + ribbons + vignette/grain,
 * plus the cursor aura, scroll progress bar and viewport edge fades from the POC.
 * The markup is server-rendered (fallback paints immediately); WebGL code is loaded after hydration.
 */
export function ParticleStage({ animated = true }: { animated?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!animated || !stage || !layer) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    void Promise.all([import("@/components/webgl/particleHero"), import("@/components/webgl/ribbons")]).then(
      ([{ startParticleHero }, { startRibbons }]) => {
        if (cancelled) return;
        const stopHero = startParticleHero({
          stage,
          layer,
          vignette: vignetteRef.current,
          aura: auraRef.current,
        });
        if (stopHero) {
          cleanups.push(stopHero);
          const stopRibbons = startRibbons(layer);
          if (stopRibbons) cleanups.push(stopRibbons);
        }
        // No WebGL: the .neural-fallback image stays visible (it only hides once .is-ready is set).
      },
    );

    return () => {
      cancelled = true;
      cleanups.reverse().forEach((fn) => fn());
    };
  }, [animated]);

  /* scroll progress bar */
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    /* scrollHeight forces layout, so cache it (refreshed when the page resizes) and write at most once per frame */
    let maximum = 0;
    let raf = 0;
    let last = "";
    const measure = () => {
      maximum = document.documentElement.scrollHeight - window.innerHeight;
      schedule();
    };
    const paint = () => {
      raf = 0;
      const width = (maximum > 0 ? (window.scrollY / maximum) * 100 : 0).toFixed(2) + "%";
      if (width !== last) {
        last = width;
        bar.style.width = width;
      }
    };
    function schedule() {
      if (!raf) raf = requestAnimationFrame(paint);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      <div className="particle-stage" ref={stageRef} aria-hidden="true">
        <div className="neural-fallback" />
        <div ref={layerRef} style={{ display: "contents" }} />
        <div className="particle-vignette" ref={vignetteRef} />
        <div className="particle-grain" />
      </div>
      <div className="cursor-aura" ref={auraRef} aria-hidden="true" />
      <div className="scroll-progress" ref={progressRef} style={{ width: "0%" }} />
      <div className="viewport-fade-top" aria-hidden="true" />
      <div className="viewport-fade-bottom" aria-hidden="true" />
      <div className="viewport-fade-left" aria-hidden="true" />
      <div className="viewport-fade-right" aria-hidden="true" />
    </>
  );
}
