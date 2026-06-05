"use client";

import { useEffect, useState } from "react";
import { COUPLE } from "@/lib/config";

// Lets any guest who has the link pass it along — native share sheet on mobile
// (Messages, WhatsApp, etc.), copy-to-clipboard everywhere else. Uses the live
// page URL so it's always correct regardless of env config.
export default function ShareLink() {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.origin);
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.getElementById("share-url");
      if (el instanceof HTMLInputElement) {
        el.select();
        document.execCommand("copy");
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClick() {
    if (canShare) {
      try {
        await navigator.share({
          title: `${COUPLE.names}'s Wedding Photos`,
          text: `Add your photos from ${COUPLE.names}'s wedding:`,
          url,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    void copy();
  }

  return (
    <div className="mt-6 w-full max-w-xl rounded-2xl bg-white/50 p-4 text-center">
      <p className="text-sm text-ink/70">
        Know someone else who took photos? Send them this link:
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id="share-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-blue-soft/60 bg-white/70 px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={handleClick}
          className="shrink-0 rounded-xl bg-blue-deep px-4 py-2 text-sm font-semibold text-cream active:scale-[0.99]"
        >
          {canShare ? "Share" : copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
