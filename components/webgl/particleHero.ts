/**
 * WebGL particle planet — ported from the POC main script (docs/poc/finaleee.html).
 * The geometry, shaders and uniforms are unchanged; this module adds lifecycle (start/stop),
 * cleanup, tab-visibility pausing and a smaller particle budget on small screens.
 */
import { planetFragmentShader } from "@/components/webgl/shaders/planet.frag";
import { planetVertexShader } from "@/components/webgl/shaders/planet.vert";
import { Disposer, isCoarsePointer, prefersReducedMotion } from "@/lib/motion/env";
import { ZERO_JOURNEY, planetJourney } from "@/lib/motion/journey";

export type ParticleHeroElements = {
  stage: HTMLElement;
  /** Empty container React never renders into; each mount gets a fresh canvas here. */
  layer: HTMLElement;
  vignette: HTMLElement | null;
  aura: HTMLElement | null;
};

/** Lossless copy of the POC's embedded PNG: the sampler needs exact pixel colours. */
export const PLANET_IMAGE_SRC = "/images/planet-lossless.webp";

type Vec = number[];

/** Starts the hero. Returns a cleanup function, or null if WebGL is unavailable (CSS fallback stays visible). */
export function startParticleHero({ stage, layer, vignette, aura }: ParticleHeroElements): (() => void) | null {
  const reduced = prefersReducedMotion();
  const coarse = isCoarsePointer();
  /* small screens get the lighter (touch) particle budget too */
  const lite = coarse || window.innerWidth < 640;

  const canvas = document.createElement("canvas");
  canvas.className = "particle-canvas";
  canvas.setAttribute("aria-hidden", "true");
  layer.prepend(canvas);

  /* antialiasing buys nothing for additive-blended point sprites and costs a multisampled framebuffer */
  const glOptions: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  };
  const gl = (canvas.getContext("webgl2", glOptions) ?? canvas.getContext("webgl", glOptions)) as
    WebGLRenderingContext | WebGL2RenderingContext | null;
  if (!gl) {
    canvas.remove();
    return null;
  }

  const d = new Disposer();

  let width = 0;
  let height = 0;
  let pointCount = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerVelocityX = 0;
  let pointerVelocityY = 0;
  let pointerPresence = 0;
  let targetPointerPresence = 0;
  let pointerImpulse = 0;
  let lastPointerMove = 0;
  let program: WebGLProgram | null = null;
  const shaders: WebGLShader[] = [];
  const buffers: WebGLBuffer[] = [];

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("WebGL shader allocation failed");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "WebGL shader compilation failed");
    }
    return shader;
  };

  try {
    const vertexShader = compile(gl.VERTEX_SHADER, planetVertexShader);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, planetFragmentShader);
    program = gl.createProgram();
    if (!program) throw new Error("WebGL program allocation failed");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "WebGL program link failed");
    }
  } catch (error) {
    console.warn(error);
    program = null;
  }

  if (!program) {
    releaseGl();
    canvas.remove();
    return null;
  }
  const prog = program;

  const positionLocation = gl.getAttribLocation(prog, "aPosition");
  const metaLocation = gl.getAttribLocation(prog, "aMeta");
  const colorLocation = gl.getAttribLocation(prog, "aColor");
  const kindLocation = gl.getAttribLocation(prog, "aKind");
  const orbitLocation = gl.getAttribLocation(prog, "aOrbit");
  const resolutionLocation = gl.getUniformLocation(prog, "uResolution");
  const pointerLocation = gl.getUniformLocation(prog, "uPointer");
  const velocityLocation = gl.getUniformLocation(prog, "uVelocity");
  const presenceLocation = gl.getUniformLocation(prog, "uPresence");
  const impulseLocation = gl.getUniformLocation(prog, "uImpulse");
  const timeLocation = gl.getUniformLocation(prog, "uTime");
  const ratioLocation = gl.getUniformLocation(prog, "uPixelRatio");
  const moveLocation = gl.getUniformLocation(prog, "uMove");
  const explodeLocation = gl.getUniformLocation(prog, "uExplode");
  const zoomLocation = gl.getUniformLocation(prog, "uZoom");
  const spinLocation = gl.getUniformLocation(prog, "uSpin");
  const camLocation = gl.getUniformLocation(prog, "uCamZ");
  const yawLocation = gl.getUniformLocation(prog, "uYaw");
  const brightLocation = gl.getUniformLocation(prog, "uBright");

  /* adaptive resolution: starts at 1.0 and only ever steps down if frames run long (never oscillates) */
  let quality = 1;
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.25) * quality;

  const resize = () => {
    const ratio = pixelRatio();
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  d.on(
    window,
    "pointermove",
    (event) => {
      targetPointerX = (event.clientX / Math.max(width, 1) - 0.5) * 2;
      targetPointerY = (event.clientY / Math.max(height, 1) - 0.5) * 2;
      targetPointerPresence = 1;
      lastPointerMove = performance.now();
      if (aura) {
        aura.style.transform = "translate3d(" + event.clientX + "px," + event.clientY + "px,0)";
        aura.classList.add("is-active");
      }
    },
    { passive: true },
  );
  const releasePointer = () => {
    targetPointerPresence = 0;
    if (aura) aura.classList.remove("is-active");
  };
  d.on(document.documentElement, "pointerleave", releasePointer);
  d.on(window, "blur", releasePointer);
  d.on(
    window,
    "pointerdown",
    () => {
      if (!coarse && !reduced) pointerImpulse = 1;
    },
    { passive: true },
  );

  let disposed = false;
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (disposed) return;
    const sample = document.createElement("canvas");
    sample.width = lite ? 390 : 560;
    sample.height = Math.round(sample.width / (image.width / image.height));
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) return;
    sampleCtx.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
    const step = lite ? 2 : 1;
    const positions: number[] = [];
    const metadata: number[] = [];
    const colors: number[] = [];
    const kinds: number[] = [];
    const orbits: number[] = [];
    const add = (p: Vec, meta: Vec, c: Vec, kind: Vec, orbit?: Vec) => {
      positions.push(p[0]!, p[1]!, p[2]!);
      metadata.push(meta[0]!, meta[1]!, meta[2]!, meta[3]!);
      colors.push(c[0]!, c[1]!, c[2]!);
      kinds.push(kind[0]!, kind[1] || 0, kind[2] || 0, 0);
      orbits.push(orbit ? orbit[0]! : 0, orbit ? orbit[1]! : 0, orbit ? orbit[2]! : 0, 0);
    };
    /* sphere geometry measured from the image (centre + radius as fractions of the image) */
    const CX = 0.72376,
      CY = 0.51027,
      RX = 0.16801,
      RY = 0.33602;

    for (let y = 0; y < sample.height; y += step) {
      for (let x = 0; x < sample.width; x += step) {
        const index = (y * sample.width + x) * 4;
        const red = pixels[index]!;
        const green = pixels[index + 1]!;
        const blue = pixels[index + 2]!;
        const light = red * 0.5 + green * 0.42 + blue * 0.08;
        if (light < 27 || red < green * 1.06 || Math.random() > 0.96) continue;
        const u = (x / sample.width - CX) / RX;
        const v = -(y / sample.height - CY) / RY;
        const r = Math.sqrt(u * u + v * v);
        if (r >= 1.06) continue; /* old flat orbits/dust are replaced by real 3D ones below */
        const meta = [
          Math.min(1, light / 230),
          0.28 + Math.min(2.0, light / 125) + Math.random() * 0.38,
          Math.random() * Math.PI * 2,
          0.24 + Math.random() * 0.52,
        ];
        const c = [Math.min(1, red / 255), Math.min(1, green / 255), Math.min(1, blue / 255)];
        if (r < 0.965) {
          const z = Math.sqrt(Math.max(0, 1 - r * r));
          add([u, v, z], meta, c, [0]); /* front of the globe */
          const back = meta.slice();
          back[2] = Math.random() * Math.PI * 2;
          add([u, v, -z], back, c, [0]); /* matching back, so it never looks empty while spinning */
        } else {
          add([u, v, 0], meta, c, [1]); /* glowing outline */
        }
      }
    }

    /* three tilted orbits sized and angled like the ones in the artwork (a = radius, incl, roll) */
    const orbitDefs = [
      { a: 1.62, incl: 1.29, roll: 0.1, w: 0.22 },
      { a: 1.52, incl: 1.27, roll: -0.51, w: -0.17 },
      { a: 1.4, incl: 1.27, roll: 0.83, w: 0.26 },
    ];
    const gold = [
      [1.0, 0.7, 0.22],
      [1.0, 0.8, 0.36],
      [1.0, 0.88, 0.55],
      [0.92, 0.6, 0.16],
    ];
    const pickGold = () => gold[(Math.random() * gold.length) | 0]!;
    const perOrbit = lite ? 1300 : 3600;
    orbitDefs.forEach((o) => {
      for (let i = 0; i < perOrbit; i++) {
        const core = Math.random() < 0.72;
        const jitter = core ? (Math.random() - 0.5) * 0.03 : (Math.random() - 0.5) * 0.16;
        const lift = core ? (Math.random() - 0.5) * 0.02 : (Math.random() - 0.5) * 0.1;
        const moon = Math.random() < 0.004;
        const energy = core ? 0.55 + Math.random() * 0.45 : 0.2 + Math.random() * 0.3;
        add(
          [Math.random() * Math.PI * 2, jitter, lift],
          [
            moon ? 1 : energy,
            moon ? 2.6 : core ? 0.7 + Math.random() * 0.9 : 0.35 + Math.random() * 0.5,
            Math.random() * Math.PI * 2,
            0.24 + Math.random() * 0.52,
          ],
          pickGold(),
          [2, o.w * (0.92 + Math.random() * 0.16), 0.35],
          [o.a, o.incl, o.roll],
        );
      }
    });

    /* drifting dust around the planet */
    const dust = lite ? 900 : 2600;
    for (let i = 0; i < dust; i++) {
      const th = Math.random() * Math.PI * 2,
        ph = Math.acos(2 * Math.random() - 1);
      const rr = 1.1 + Math.pow(Math.random(), 1.6) * 1.3;
      add(
        [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph) * 0.8, rr * Math.sin(ph) * Math.sin(th)],
        [
          0.15 + Math.random() * 0.4,
          0.3 + Math.random() * 0.6,
          Math.random() * Math.PI * 2,
          0.24 + Math.random() * 0.52,
        ],
        pickGold(),
        [3],
      );
    }

    pointCount = positions.length / 3;
    const upload = (location: number, data: number[], size: number) => {
      if (location < 0) return;
      const buffer = gl.createBuffer();
      if (!buffer) return;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };
    upload(positionLocation, positions, 3);
    upload(metaLocation, metadata, 4);
    upload(colorLocation, colors, 3);
    upload(kindLocation, kinds, 4);
    upload(orbitLocation, orbits, 4);

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    stage.classList.add("is-ready");
  };
  image.src = PLANET_IMAGE_SRC;

  /* pause rendering while the tab is hidden */
  let hidden = document.hidden;
  d.on(document, "visibilitychange", () => {
    hidden = document.hidden;
  });

  let lastFrame = 0;
  let avgFrame = 16.7;
  let frameCount = 0;
  const render = (timestamp: number) => {
    if (hidden || pointCount === 0) {
      lastFrame = 0;
      return;
    }
    const dt = lastFrame ? timestamp - lastFrame : 0;
    lastFrame = timestamp;
    if (dt > 0 && dt < 200) {
      avgFrame += (dt - avgFrame) * 0.06;
      if (++frameCount % 90 === 0 && avgFrame > 24 && quality > 0.6) {
        quality = Math.max(0.6, quality * 0.85);
        resize();
      }
    }
    if (performance.now() - lastPointerMove > 1400) targetPointerPresence = 0;
    const pointerDeltaX = targetPointerX - pointerX;
    const pointerDeltaY = targetPointerY - pointerY;
    pointerVelocityX += (pointerDeltaX * 1.8 - pointerVelocityX) * 0.18;
    pointerVelocityY += (pointerDeltaY * 1.8 - pointerVelocityY) * 0.18;
    pointerX += pointerDeltaX * 0.09;
    pointerY += pointerDeltaY * 0.09;
    pointerPresence += (targetPointerPresence - pointerPresence) * 0.085;
    pointerImpulse *= reduced ? 0 : 0.93;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform2f(pointerLocation, pointerX, pointerY);
    gl.uniform2f(velocityLocation, pointerVelocityX, pointerVelocityY);
    gl.uniform1f(presenceLocation, coarse || reduced ? 0 : pointerPresence);
    gl.uniform1f(impulseLocation, pointerImpulse);
    gl.uniform1f(timeLocation, reduced ? 0 : timestamp / 1000);
    gl.uniform1f(ratioLocation, pixelRatio());
    const journey = planetJourney.current ?? ZERO_JOURNEY;
    gl.uniform1f(moveLocation, journey.move);
    gl.uniform1f(explodeLocation, journey.explode);
    gl.uniform1f(zoomLocation, journey.zoom);
    const zz = journey.zoom,
      flight = zz < 0.5 ? 4 * zz * zz * zz : 1 - Math.pow(-2 * zz + 2, 3) / 2;
    gl.uniform1f(camLocation, 9 - 73 * flight);
    /* Earth-like spin on its own axis; scrolling to slide 2 turns it a further half revolution.
       No extra spin once it breaks into stars, so the star field never turns like a clock. */
    const seconds = reduced ? 0 : timestamp / 1000;
    gl.uniform1f(spinLocation, seconds * 0.24 + journey.move * Math.PI * 0.9);
    gl.uniform1f(yawLocation, seconds * 0.05 + journey.move * 0.6);
    gl.uniform1f(brightLocation, 1.12 + 0.3 * journey.move);
    /* ease the left-side vignette while the planet sits on the left, keep some of it behind the star field */
    const vignetteOpacity = (1 - 0.78 * journey.move + 0.35 * journey.explode).toFixed(3);
    if (vignette && vignette.style.opacity !== vignetteOpacity) vignette.style.opacity = vignetteOpacity;
    gl.drawArrays(gl.POINTS, 0, pointCount);
  };

  resize();
  d.on(window, "resize", resize);
  d.loop(render);

  function releaseGl() {
    buffers.forEach((b) => gl!.deleteBuffer(b));
    shaders.forEach((s) => gl!.deleteShader(s));
    if (program) gl!.deleteProgram(program);
    gl!.getExtension("WEBGL_lose_context")?.loseContext();
  }

  return () => {
    disposed = true;
    image.onload = null;
    d.dispose();
    stage.classList.remove("is-ready");
    if (aura) aura.classList.remove("is-active");
    releaseGl();
    canvas.remove();
  };
}
