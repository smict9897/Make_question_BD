import Link from "next/link";
import { db } from "@/lib/db";
import { getPremiumStatus } from "@/lib/premium";

function fmtDate(d: Date) {
  return d.toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ProfilePremiumCard({ userId }: { userId: string }) {
  const premium = await getPremiumStatus(userId).catch(() => ({
    isPremium: false,
    expiresAt: null as Date | null,
    packageTitle: null as string | null,
  }));

  // চালু Premium
  if (premium.isPremium && premium.expiresAt) {
    const daysLeft = Math.max(
      1,
      Math.ceil((premium.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
    return (
      <section className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
              👑 Premium সক্রিয়
            </p>
            <p className="mt-1 text-base font-bold text-slate-900">{premium.packageTitle}</p>
            <p className="mt-1 text-xs text-slate-600">
              মেয়াদ শেষ: {fmtDate(premium.expiresAt)}
            </p>
          </div>
          <div className="rounded-xl bg-amber-500 px-3 py-2 text-center text-white">
            <p className="text-lg font-extrabold leading-none">
              {daysLeft.toLocaleString("bn-BD")}
            </p>
            <p className="text-[10px]">দিন বাকি</p>
          </div>
        </div>
        <Link
          href="/packages"
          className="mt-3 block rounded-xl bg-white px-4 py-2.5 text-center text-sm font-bold text-amber-800 ring-1 ring-amber-300"
        >
          🔄 মেয়াদ বাড়ান
        </Link>
      </section>
    );
  }

  // যাচাই বাকি অনুরোধ আছে কিনা
  const pending = await db.packagePurchase
    .count({ where: { userId, status: "PENDING" } })
    .catch(() => 0);

  if (pending > 0) {
    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900">⏳ পেমেন্ট যাচাই চলছে</p>
        <p className="mt-1 text-xs text-amber-800">
          অ্যাডমিন অনুমোদন করলে আপনার Premium নিজে থেকেই চালু হবে।
        </p>
        <Link
          href="/packages"
          className="mt-3 block rounded-xl bg-white px-4 py-2.5 text-center text-sm font-bold text-amber-800 ring-1 ring-amber-300"
        >
          অনুরোধের অবস্থা দেখুন
        </Link>
      </section>
    );
  }

  // Free ইউজার
  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        আপনার প্ল্যান: Free
      </p>
      <p className="mt-1 text-base font-bold">👑 Premium নিয়ে সব পরীক্ষা আনলক করুন</p>
      <p className="mt-1 text-xs text-slate-300">
        মাত্র ৳১০০ থেকে শুরু • bKash / Nagad
      </p>
      <Link
        href="/packages"
        className="mt-3 block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-center text-sm font-bold text-white"
      >
        👑 Join Premium
      </Link>
    </section>
  );
}

// ===== ফাইল শেষ =====
