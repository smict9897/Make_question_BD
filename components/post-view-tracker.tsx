"use client";

import { useEffect } from "react";
import { recordPostView } from "@/app/actions/post-views";

// লেখার পেজে বসাতে হবে। একই ব্রাউজার সেশনে একই লেখা একবারই গোনা হবে।
export default function PostViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `pv:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage বন্ধ থাকলেও চলবে
    }
    recordPostView(postId).catch(() => {});
  }, [postId]);

  return null;
}

// ===== ফাইল শেষ =====
