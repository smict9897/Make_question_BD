import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUserId, getPremiumStatus } from "@/lib/premium";
import { submitPackagePurchase } from "@/app/actions/package-purchase";
import {
  PAYMENT_NUMBER,
  PAYMENT_TYPE,
  PAYMENT_METHODS,
  PAYMENT_STEPS,
} from "@/lib/payment-info";

export const dynamic = "force-dynamic";

type SP = Promise<{ ok?: string; error?: string }>;

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500";

function fmtDate(d: Date) {
  return d.toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function durationText(days: number) {
  if (days % 365 === 0) return `${days / 365} বছর`;
  if (days % 30 === 0) return `${days / 30} মাস`;
  return `${days} দিন`;
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "⏳ যাচাই চলছে", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "✅ অনুমোদিত", cls: "bg-green-100 text-green-800" },
  REJECTED: { label: "❌ বাতিল", cls: "bg-red-100 text-red-800" },
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();

  const packages = await db.package.findMany({
    where: { active: true },
    orderBy: { price: "asc" },
  });

  const premium = userId ? await getPremiumStatus(userId) : null;

  const purchases = userId
    ? await db.packagePurchase.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { package: { select: { title: true } } },
      })
    : [];

  const hasPending = purchases.some((p) => p.status === "PENDING");

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* হেডার */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          👑 Premium
        </p>
        <h1 className="mt-1 text-2xl font-bold">সব Premium মডেল টেস্ট আনলক করুন</h1>
        <p className="mt-2 text-sm text-slate-300">
          একটা প্যাকেজ নিলেই মেয়াদ পর্যন্ত সব Premium পরীক্ষা দিতে পারবেন।
        </p>
      </div>

      {sp.ok && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✅ {sp.ok}
        </div>
      )}
      {sp.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          ❌ {sp.error}
        </div>
      )}

      {/* লগইন লাগবে */}
      {!userId && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-slate-700">
            প্যাকেজ কিনতে আগে Google দিয়ে লগইন করতে হবে।
          </p>
          <Link
            href="/api/auth/signin?callbackUrl=%2Fpackages"
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            🔐 লগইন করুন
          </Link>
        </div>
      )}

      {/* চালু Premium */}
      {premium?.isPremium && premium.expiresAt && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            👑 আপনার Premium চালু আছে
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {premium.packageTitle} · মেয়াদ শেষ: {fmtDate(premium.expiresAt)}
          </p>
        </div>
      )}

      {/* যাচাই বাকি */}
      {hasPending && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          ⏳ আপনার একটি পেমেন্ট অনুরোধ অ্যাডমিন যাচাই করছে। অনুমোদন হলে Premium
          নিজে থেকেই চালু হবে।
        </div>
      )}

      {/* প্যাকেজ ও পেমেন্ট ফর্ম */}
      {packages.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-600">
          এখন কোনো প্যাকেজ চালু নেই। একটু পরে আবার দেখুন।
        </div>
      ) : (
        userId &&
        !hasPending && (
          <form action={submitPackagePurchase} className="space-y-6">
            {/* ১. প্যাকেজ */}
            <section>
              <h2 className="mb-3 text-base font-bold text-slate-900">
                ১. প্যাকেজ বেছে নিন
              </h2>
              <div className="space-y-3">
                {packages.map((p, i) => (
                  <label key={p.id} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="packageId"
                      value={p.id}
                      required
                      defaultChecked={i === 0}
                      className="peer sr-only"
                    />
                    <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white p-4 peer-checked:border-indigo-600 peer-checked:bg-indigo-50">
                      <div>
                        <p className="font-bold text-slate-900">{p.title}</p>
                        <p className="text-xs text-slate-600">
                          {p.description || "সব Premium মডেল টেস্ট আনলক"} ·{" "}
                          {durationText(p.durationDays)}
                        </p>
                      </div>
                      <p className="text-xl font-extrabold text-indigo-700">
                        ৳{p.price}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* ২. পেমেন্ট নির্দেশনা */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-bold text-slate-900">
                ২. {PAYMENT_TYPE} করুন
              </h2>
              <div className="rounded-lg bg-slate-900 p-4 text-center">
                <p className="text-xs text-slate-400">
                  {PAYMENT_TYPE} নম্বর (bKash / Nagad)
                </p>
                <p className="mt-1 select-all text-2xl font-extrabold tracking-wider text-amber-300">
                  {PAYMENT_NUMBER}
                </p>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {PAYMENT_STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>

            {/* ৩. তথ্য জমা */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-bold text-slate-900">
                ৩. পেমেন্টের তথ্য দিন
              </h2>

              <p className="mb-2 text-xs font-medium text-slate-600">
                কোন মাধ্যমে পাঠিয়েছেন?
              </p>
              <div className="mb-4 grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((m, i) => (
                  <label key={m.id} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      value={m.id}
                      required
                      defaultChecked={i === 0}
                      className="peer sr-only"
                    />
                    <div
                      className={`rounded-lg border-2 border-slate-200 bg-white py-2.5 text-center text-sm font-bold text-slate-700 ${
                        m.id === "bKash"
                          ? "peer-checked:border-pink-600 peer-checked:bg-pink-50 peer-checked:text-pink-700"
                          : "peer-checked:border-orange-500 peer-checked:bg-orange-50 peer-checked:text-orange-700"
                      }`}
                    >
                      {m.label}
                    </div>
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Transaction ID (TrxID)
                  </label>
                  <input
                    name="transactionId"
                    required
                    minLength={6}
                    maxLength={20}
                    autoComplete="off"
                    placeholder="যেমন: 9A7B3C2D1E"
                    className={`${inputCls} uppercase`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    যে নম্বর থেকে টাকা পাঠিয়েছেন
                  </label>
                  <input
                    name="senderNumber"
                    required
                    inputMode="tel"
                    maxLength={14}
                    placeholder="01XXXXXXXXX"
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white"
              >
                ✅ অনুরোধ জমা দিন
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                ভুল TrxID দিলে অনুরোধ বাতিল হবে। সঠিক তথ্য দিন।
              </p>
            </section>
          </form>
        )
      )}

      {/* আগের অনুরোধ */}
      {purchases.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-slate-900">
            📜 আপনার অনুরোধের তালিকা
          </h2>
          <div className="space-y-2">
            {purchases.map((p) => {
              const ui = STATUS_UI[p.status] ?? {
                label: p.status,
                cls: "bg-slate-100 text-slate-700",
              };
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {p.package.title} · ৳{p.amount}
                    </p>
                    <p className="text-xs text-slate-500">
                      TrxID: {p.transactionId} · {fmtDate(p.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ui.cls}`}
                  >
                    {ui.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="text-center">
        <Link href="/model-test" className="text-sm font-semibold text-indigo-700">
          ← মডেল টেস্টে ফিরে যান
        </Link>
      </div>
    </main>
  );
}

// ===== ফাইল শেষ =====
