"use client";

import { useState } from "react";

type Props = {
  path: string;
  title: string;
};

export default function ModelTestShareButton({ path, title }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}${path}`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      // ইউজার শেয়ার বাতিল করলে কিছু করার দরকার নেই
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("লিংক কপি করুন:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="শেয়ার করুন"
      className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
    >
      {copied ? "✓ কপি" : "🔗"}
    </button>
  );
}
