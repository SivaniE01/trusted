/**
 * Orbital light ribbons + shooting stars over the star field (appear after the planet has scattered).
 * Ported from the POC `ribbons-js` script; drawing code unchanged, plus lifecycle + cleanup.
 */
import { Disposer, clamp, ease, prefersReducedMotion } from "@/lib/motion/env";
import { planetJourney } from "@/lib/motion/journey";

type Layer = {
  depth: number;
  amp: number;
  freq: number;
  phase: number;
  offset: number;
  width: number;
  strands: number;
  alpha: number;
  twist: number;
  speed: number;
  lw: number;
};
type Point = [number, number];
type Shooter = { x: number; y: number; vx: number; vy: number; life: number; dur: number };

/** Draws onto a new canvas appended to `layer`. Returns cleanup, or null when skipped (reduced motion / no 2D). */
export function startRibbons(layer: HTMLElement): (() => void) | null {
  if (prefersReducedMotion()) return null;

  const cv = document.createElement("canvas");
  cv.className = "ribbon-canvas";
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;mix-blend-mode:screen";
  layer.append(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) {
    cv.remove();
    return null;
  }

  const d = new Disposer();
  let W = 0,
    H = 0,
    DPR = 1;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 1);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
  };
  resize();
  d.on(window, "resize", resize);

  let px = 0,
    py = 0,
    tx = 0,
    ty = 0;
  d.on(
    window,
    "pointermove",
    (e) => {
      tx = (e.clientX / Math.max(W, 1)) * 2 - 1;
      ty = (e.clientY / Math.max(H, 1)) * 2 - 1;
    },
    { passive: true },
  );

  /* far -> near: thinner/dimmer far away, wider/brighter and more parallax up close */
  const layers: Layer[] = [
    {
      depth: 0.35,
      amp: 0.07,
      freq: 0.9,
      phase: 0.0,
      offset: -0.3,
      width: 34,
      strands: 11,
      alpha: 0.2,
      twist: 2.4,
      speed: 0.045,
      lw: 0.7,
    },
    {
      depth: 0.65,
      amp: 0.09,
      freq: 0.75,
      phase: 2.1,
      offset: 0.0,
      width: 64,
      strands: 16,
      alpha: 0.3,
      twist: 1.7,
      speed: 0.06,
      lw: 0.9,
    },
    {
      depth: 1.0,
      amp: 0.08,
      freq: 1.05,
      phase: 4.2,
      offset: 0.3,
      width: 42,
      strands: 12,
      alpha: 0.26,
      twist: 2.9,
      speed: 0.08,
      lw: 1.1,
    },
  ];
  const SEG = 36;
  const gold = (a: number) => "rgba(232,176,72," + a.toFixed(3) + ")";
  const hot = (a: number) => "rgba(255,240,200," + a.toFixed(3) + ")";

  const ribbonPoint = (
    L: Layer,
    u: number,
    k: number,
    n: number,
    t: number,
    A: Point,
    dir: Point,
    N: Point,
    D: number,
  ): Point => {
    const sway = L.amp * D * Math.sin(u * Math.PI * L.freq * 2 + t * 0.12 + L.phase);
    const twist = Math.cos(u * Math.PI * L.twist + t * 0.22 + L.phase);
    const off = (k / (n - 1) - 0.5) * L.width * twist + (k - (n - 1) / 2) * 0.5;
    const side = L.offset * D * 0.5 + sway + off;
    return [
      A[0] + dir[0] * D * u + N[0] * side + px * L.depth * 26,
      A[1] + dir[1] * D * u + N[1] * side + py * L.depth * 16,
    ];
  };

  let shooter: Shooter | null = null,
    nextShot = 2.5;
  const spawnShooter = () => {
    const ang = -0.62 + (Math.random() - 0.5) * 0.25; /* lower-left -> upper-right */
    const speed = (0.9 + Math.random() * 0.5) * Math.hypot(W, H);
    shooter = {
      x: W * (-0.05 + Math.random() * 0.45),
      y: H * (0.55 + Math.random() * 0.45),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0,
      dur: 0.85 + Math.random() * 0.35,
    };
  };

  let last = performance.now(),
    wasDrawn = false;
  const frame = (now: number) => {
    /* the ribbons drift slowly, so ~30fps looks the same and leaves frame time for scrolling */
    if (now - last < 30) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    const t = now / 1000;
    const zoom = planetJourney.current?.zoom ?? 0;
    const vis = ease(clamp((zoom - 0.3) / 0.35));
    const reveal = ease(clamp((zoom - 0.3) / 0.6));
    if (vis < 0.005) {
      if (wasDrawn) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        cv.style.opacity = "0";
        wasDrawn = false;
      }
      return;
    }
    wasDrawn = true;
    cv.style.opacity = vis.toFixed(3);
    px += (tx - px) * 0.04;
    py += (ty - py) * 0.04;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    const A: Point = [-0.08 * W, 1.08 * H],
      B: Point = [1.08 * W, -0.08 * H];
    const D = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const dir: Point = [(B[0] - A[0]) / D, (B[1] - A[1]) / D];
    const N: Point = [-dir[1], dir[0]];
    const uEnd = Math.max(0.001, reveal);

    layers.forEach((L) => {
      const h = ((t * L.speed + L.phase * 0.13) % 1.25) - 0.1; /* highlight position along the ribbon */
      for (let k = 0; k < L.strands; k++) {
        const edge = k === 0 || k === L.strands - 1;
        const a = L.alpha * (edge ? 1.35 : 0.7);
        const p0 = ribbonPoint(L, 0, k, L.strands, t, A, dir, N, D);
        const p1 = ribbonPoint(L, uEnd, k, L.strands, t, A, dir, N, D);
        const g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
        const hh = h / uEnd;
        const stops: [number, string][] = [
          [0, gold(0)],
          [0.14, gold(a * 0.7)],
          [0.86, gold(a * 0.7)],
          [1, gold(0)],
        ];
        if (hh > -0.1 && hh < 1.1) {
          stops.push(
            [clamp(hh - 0.08), gold(a * 0.8)],
            [clamp(hh), hot(Math.min(1, a * 3.2))],
            [clamp(hh + 0.08), gold(a * 0.8)],
          );
        }
        stops.sort((m, n) => m[0] - n[0]).forEach((s) => g.addColorStop(s[0], s[1]));
        ctx.strokeStyle = g;
        ctx.lineWidth = L.lw * (edge ? 1.3 : 1);
        ctx.beginPath();
        for (let i = 0; i <= SEG; i++) {
          const p = ribbonPoint(L, (i / SEG) * uEnd, k, L.strands, t, A, dir, N, D);
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      /* soft glow travelling with the highlight */
      if (h > 0 && h < uEnd) {
        const c = ribbonPoint(L, h, (L.strands - 1) / 2, L.strands, t, A, dir, N, D);
        const r = 60 + 50 * L.depth;
        const glow = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
        glow.addColorStop(0, hot(0.16 * L.depth + 0.05));
        glow.addColorStop(1, hot(0));
        ctx.fillStyle = glow;
        ctx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
      }
    });

    /* shooting star */
    if (reveal > 0.9) {
      nextShot -= dt;
      if (!shooter && nextShot <= 0) {
        spawnShooter();
        nextShot = 3 + Math.random() * 4;
      }
    }
    if (shooter) {
      const s: Shooter = shooter;
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = s.life / s.dur;
      if (k >= 1) shooter = null;
      else {
        const fade = Math.sin(Math.PI * k);
        const tail = 0.13;
        const x0 = s.x - s.vx * tail,
          y0 = s.y - s.vy * tail;
        const g = ctx.createLinearGradient(x0, y0, s.x, s.y);
        g.addColorStop(0, gold(0));
        g.addColorStop(0.75, gold(0.35 * fade));
        g.addColorStop(1, hot(0.95 * fade));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 14);
        hg.addColorStop(0, hot(0.9 * fade));
        hg.addColorStop(1, hot(0));
        ctx.fillStyle = hg;
        ctx.fillRect(s.x - 14, s.y - 14, 28, 28);
      }
    }
    ctx.globalCompositeOperation = "source-over";
  };
  d.loop(frame);

  return () => {
    d.dispose();
    cv.remove();
  };
}
