"use server";

import { db } from "@/lib/db";

// কোনো লেখা পড়া হলে ভিউ ১ বাড়ায়। ব্যর্থ হলেও পাঠককে কিছু দেখানো হবে না।
export async function recordPostView(postId: string) {
  if (!postId || typeof postId !== "string") return;
  try {
    await db.post.updateMany({
      where: { id: postId, published: true },
      data: { views: { increment: 1 } },
    });
  } catch {
    // চুপচাপ উপেক্ষা
  }
}

// ===== ফাইল শেষ =====
