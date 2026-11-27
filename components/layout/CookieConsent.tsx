"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CONSENT_EVENT, CONSENT_KEY, readConsent, writeConsent, type ConsentChoice } from "@/lib/consent";

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) onChange();
  };
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Asks before any analytics loads. Nothing non-essential is set until the visitor accepts. */
export function CookieConsent() {
  // On the server (and during hydration) report "pending" so the banner never flashes for returning visitors.
  const consent = useSyncExternalStore<ConsentChoice | null | "pending">(subscribe, readConsent, () => "pending");

  if (consent !== null) return null;

  return (
    <section
      aria-label="Cookie preferences"
      className="cookie-consent fixed inset-x-4 bottom-4 z-[300] mx-auto max-w-xl rounded-2xl border border-line-gold bg-ink-soft/95 p-5 text-sm text-muted shadow-[0_30px_90px_#000000b3] backdrop-blur-xl sm:p-6"
    >
      <p className="m-0 leading-relaxed">
        We use essential cookies to run this site. With your permission we’d also like to use analytics to understand
        how it’s used. See our{" "}
        <Link href="/privacy" className="text-cream underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="button button-gold button-small" onClick={() => writeConsent("accepted")}>
          Accept analytics
        </button>
        <button type="button" className="button button-ghost button-small" onClick={() => writeConsent("declined")}>
          Essential only
        </button>
      </div>
    </section>
  );
}
