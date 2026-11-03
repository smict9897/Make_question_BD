"use server";

import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const BACK = "/admin/package-requests";
const DAY_MS = 24 * 60 * 60 * 1000;

function fail(message: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  redirect(`${BACK}?ok=${encodeURIComponent(message)}`);
}

function refresh() {
  revalidatePath(BACK);
  revalidatePath("/admin/packages");
  revalidatePath("/packages");
  revalidatePath("/profile");
  revalidatePath("/model-test");
}

// ✅ অনুমোদন: মেয়াদ বসবে। চালু Premium থাকলে তার শেষ থেকে বাড়বে
export async function approvePurchase(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("অনুরোধের আইডি পাওয়া যায়নি");

  const purchase = await db.packagePurchase.findUnique({
    where: { id },
    include: { package: true },
  });
  if (!purchase) fail("অনুরোধ পাওয়া যায়নি");
  if (purchase.status !== "PENDING") fail("এই অনুরোধ আগেই প্রক্রিয়া করা হয়েছে");

  const now = new Date();

  // ইউজারের এখনো চলমান সর্বশেষ মেয়াদ
  const current = await db.packagePurchase.findFirst({
    where: {
      userId: purchase.userId,
      status: "APPROVED",
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });

  const start = current?.expiresAt && current.expiresAt > now ? current.expiresAt : now;
  const expiresAt = new Date(start.getTime() + purchase.package.durationDays * DAY_MS);

  // একসাথে দুইবার চাপলে যেন দুইবার না হয়
  const res = await db.packagePurchase.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED", approvedAt: now, expiresAt },
  });
  if (res.count === 0) fail("এই অনুরোধ আগেই প্রক্রিয়া করা হয়েছে");

  refresh();
  done("অনুমোদন হয়েছে, Premium চালু করা হয়েছে");
}

// ❌ বাতিল
export async function rejectPurchase(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("অনুরোধের আইডি পাওয়া যায়নি");

  const res = await db.packagePurchase.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED" },
  });
  if (res.count === 0) fail("এই অনুরোধ আগেই প্রক্রিয়া করা হয়েছে");

  refresh();
  done("অনুরোধ বাতিল করা হয়েছে");
}

// ↩️ ভুলে অনুমোদন হলে ফিরিয়ে নেওয়া (Premium বন্ধ হবে)
export async function revokePurchase(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("অনুরোধের আইডি পাওয়া যায়নি");

  const res = await db.packagePurchase.updateMany({
    where: { id, status: "APPROVED" },
    data: { status: "REJECTED", expiresAt: null, approvedAt: null },
  });
  if (res.count === 0) fail("এই অনুরোধ অনুমোদিত অবস্থায় নেই");

  refresh();
  done("অনুমোদন ফিরিয়ে নেওয়া হয়েছে");
}

// ===== ফাইল শেষ =====
