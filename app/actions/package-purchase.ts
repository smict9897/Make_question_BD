"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/premium";
import { PAYMENT_METHODS } from "@/lib/payment-info";

const BACK = "/packages";

function fail(message: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  redirect(`${BACK}?ok=${encodeURIComponent(message)}`);
}

// +880 / 880 / স্পেস সরিয়ে ০১XXXXXXXXX ফরম্যাটে আনা
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("880")) d = "0" + d.slice(3);
  return d;
}

export async function submitPackagePurchase(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) fail("আগে Google দিয়ে লগইন করুন");

  const packageId = String(formData.get("packageId") ?? "");
  const method = String(formData.get("method") ?? "");
  const transactionId = String(formData.get("transactionId") ?? "")
    .trim()
    .toUpperCase();
  const senderNumber = normalizePhone(String(formData.get("senderNumber") ?? ""));

  if (!packageId) fail("একটা প্যাকেজ বেছে নিন");
  if (!PAYMENT_METHODS.some((m) => m.id === method))
    fail("bKash বা Nagad বেছে নিন");
  if (!/^[A-Z0-9]{6,20}$/.test(transactionId))
    fail("Transaction ID সঠিক নয় (৬-২০ অক্ষর, শুধু ইংরেজি অক্ষর ও সংখ্যা)");
  if (!/^01[3-9][0-9]{8}$/.test(senderNumber))
    fail("যে নম্বর থেকে টাকা পাঠিয়েছেন সেটা সঠিক ১১ ডিজিটে দিন");

  const pkg = await db.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) fail("এই প্যাকেজটি এখন পাওয়া যাচ্ছে না");

  // আগের অনুরোধ এখনো যাচাই বাকি থাকলে নতুন নেওয়া হবে না
  const pending = await db.packagePurchase.findFirst({
    where: { userId, status: "PENDING" },
  });
  if (pending)
    fail("আপনার আগের একটি অনুরোধ যাচাই বাকি আছে। অ্যাডমিন দেখার পর আবার চেষ্টা করুন");

  // একই Transaction ID দুইবার ব্যবহার ঠেকানো (REJECTED বাদে)
  const duplicate = await db.packagePurchase.findFirst({
    where: { transactionId, status: { not: "REJECTED" } },
  });
  if (duplicate) fail("এই Transaction ID আগে ব্যবহার করা হয়েছে");

  await db.packagePurchase.create({
    data: {
      userId,
      packageId: pkg.id,
      amount: pkg.price,
      transactionId,
      paymentNumber: `${method} · ${senderNumber}`,
      status: "PENDING",
    },
  });

  revalidatePath(BACK);
  revalidatePath("/admin/packages");
  revalidatePath("/admin/package-requests");
  done("অনুরোধ জমা হয়েছে। অ্যাডমিন যাচাই করলে Premium চালু হবে");
}

// ===== ফাইল শেষ =====
