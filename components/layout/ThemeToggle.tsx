"use client";

import { THEME_KEY } from "@/lib/theme";

/** Light / dark switch. The icon is chosen in CSS from html[data-theme], so there is no hydration state. */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage can be blocked; the switch still works for this visit */
    }
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Switch between light and dark theme">
      <span className="to-light" aria-hidden="true">
        ☀
      </span>
      <span className="to-dark" aria-hidden="true">
        ☾
      </span>
    </button>
  );
}
