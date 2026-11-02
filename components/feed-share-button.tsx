"use client";

import { useState } from "react";

export default function FeedShareButton({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // ইউজার শেয়ার বাতিল করেছে
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("লিংক কপি করুন", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="শেয়ার"
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
    >
      {copied ? "✓ কপি" : "🔗"}
    </button>
  );
}

// ===== ফাইল শেষ =====
