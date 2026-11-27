/**
 * Inline script for the landing page: enables cinematic mode (html.cine) before first paint,
 * unless the visitor prefers reduced motion or is on a touch device (phones / tablets scroll normally).
 * Lives outside any "use client" module so server components receive the actual string.
 */
export const CINE_BOOT_SCRIPT = `try{if(!window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches)document.documentElement.classList.add("cine")}catch(e){}`;
