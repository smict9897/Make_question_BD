"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function ShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? "কপি হয়েছে!" : "লিংক শেয়ার করুন"}
    </button>
  );
}
