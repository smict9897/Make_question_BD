import Link from "next/link";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import {
  approvePurchase,
  rejectPurchase,
  revokePurchase,
} from "@/app/actions/package-requests";

export const dynamic = "force-dynamic";

type SP = Promise<{ ok?: string; error?: string }>;

function fmtDateTime(d: Date) {
  return d.toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "⏳ যাচাই বাকি", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "✅ অনুমোদিত", cls: "bg-green-100 text-green-800" },
  REJECTED: { label: "❌ বাতিল", cls: "bg-red-100 text-red-800" },
};

export default async function AdminPackageRequestsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await staff();
  const sp = await searchParams;

  const pending = await db.packagePurchase.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true, email: true } },
      package: { select: { title: true, durationDays: true } },
    },
  });

  const history = await db.packagePurchase.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      user: { select: { name: true, email: true } },
      package: { select: { title: true } },
    },
  });

  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          ⏳ পেমেন্ট অনুরোধ ({pending.length})
        </h1>
        <Link
          href="/admin/packages"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          💎 প্যাকেজ
        </Link>
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        💡 Approve করার আগে bKash/Nagad অ্যাপে মিলিয়ে নিন: TrxID, টাকার পরিমাণ ও
        প্রেরকের নম্বর হুবহু মিলছে কিনা।
      </div>

      {/* পেন্ডিং */}
      {pending.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          🎉 কোনো অনুরোধ যাচাই বাকি নেই।
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border-2 border-amber-300 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    {p.user.name || "নামহীন"}
                  </p>
                  <p className="break-all text-xs text-slate-500">{p.user.email}</p>
                </div>
                <p className="text-xl font-extrabold text-indigo-700">৳{p.amount}</p>
              </div>

              <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                <p>
                  📦 <span className="font-semibold">{p.package.title}</span> ·{" "}
                  {p.package.durationDays} দিন
                </p>
                <p>
                  🧾 TrxID:{" "}
                  <span className="select-all font-mono font-bold">
                    {p.transactionId}
                  </span>
                </p>
                <p>
                  📱 প্রেরক:{" "}
                  <span className="select-all font-semibold">{p.paymentNumber}</span>
                </p>
                <p className="text-xs text-slate-500">
                  🕒 জমা: {fmtDateTime(p.createdAt)}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <form action={approvePurchase}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    ✅ Approve
                  </button>
                </form>
                <form action={rejectPurchase}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    ❌ Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ইতিহাস */}
      {history.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-slate-900">
            📜 আগের অনুরোধ (সর্বশেষ ৩০টি)
          </h2>
          <div className="space-y-2">
            {history.map((p) => {
              const ui = STATUS_UI[p.status] ?? {
                label: p.status,
                cls: "bg-slate-100 text-slate-700",
              };
              const active =
                p.status === "APPROVED" && p.expiresAt && p.expiresAt > now;
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-100 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {p.user.name || p.user.email} · {p.package.title} · ৳{p.amount}
                      </p>
                      <p className="text-xs text-slate-500">
                        TrxID: {p.transactionId} · {fmtDate(p.createdAt)}
                      </p>
                      {p.status === "APPROVED" && p.expiresAt && (
                        <p className="text-xs text-slate-500">
                          মেয়াদ: {fmtDate(p.expiresAt)} পর্যন্ত{" "}
                          {active ? "(চালু)" : "(শেষ)"}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ui.cls}`}
                    >
                      {ui.label}
                    </span>
                  </div>

                  {active && (
                    <details className="mt-2 rounded-lg border border-red-200 p-2">
                      <summary className="cursor-pointer text-xs font-semibold text-red-700">
                        ↩️ অনুমোদন ফিরিয়ে নিন
                      </summary>
                      <p className="mt-2 text-xs text-red-700">
                        ⚠️ ইউজারের Premium সঙ্গে সঙ্গে বন্ধ হয়ে যাবে।
                      </p>
                      <form action={revokePurchase} className="mt-2">
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          নিশ্চিত, ফিরিয়ে নিন
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ===== ফাইল শেষ =====
