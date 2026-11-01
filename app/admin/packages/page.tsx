import Link from "next/link";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import {
  createPackage,
  updatePackage,
  togglePackage,
  deletePackage,
  seedDefaultPackages,
} from "@/app/actions/package";

export const dynamic = "force-dynamic";

type SP = Promise<{ ok?: string; error?: string }>;

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500";

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await staff();
  const sp = await searchParams;

  const packages = await db.package.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { purchases: true } } },
  });

  const pendingCount = await db.packagePurchase.count({
    where: { status: "PENDING" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">💎 প্যাকেজ ম্যানেজমেন্ট</h1>
        <Link
          href="/admin/package-requests"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
        >
          ⏳ পেমেন্ট অনুরোধ ({pendingCount})
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

      {/* ডিফল্ট প্যাকেজ */}
      {packages.length === 0 && (
        <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50 p-4">
          <p className="mb-3 text-sm text-indigo-900">
            এখনো কোনো প্যাকেজ নেই। এক ক্লিকে ডিফল্ট ৩টা তৈরি করতে পারেন (১ মাস ৳১০০, ৬ মাস
            ৳৪৫০, ১ বছর ৳৭০০)। পরে এডিট করা যাবে।
          </p>
          <form action={seedDefaultPackages}>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              ✨ ডিফল্ট ৩টা প্যাকেজ তৈরি করুন
            </button>
          </form>
        </div>
      )}

      {/* নতুন প্যাকেজ */}
      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-base font-semibold text-slate-900">
          ➕ নতুন প্যাকেজ তৈরি করুন
        </summary>
        <form action={createPackage} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">প্যাকেজের নাম</label>
            <input name="title" required className={inputCls} placeholder="যেমন: ১ মাসের প্যাকেজ" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">বিবরণ (ঐচ্ছিক)</label>
            <input name="description" className={inputCls} placeholder="সব Premium মডেল টেস্ট আনলক" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">দাম (৳)</label>
              <input name="price" type="number" min={0} required className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">মেয়াদ (দিন)</label>
              <input name="durationDays" type="number" min={1} required className={inputCls} placeholder="30" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" defaultChecked /> চালু থাকবে
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            ✅ প্যাকেজ তৈরি করুন
          </button>
        </form>
      </details>

      {/* প্যাকেজ তালিকা */}
      <div className="space-y-4">
        {packages.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              p.active ? "border-slate-200" : "border-slate-300 opacity-70"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{p.title}</h2>
                {p.description && (
                  <p className="text-sm text-slate-600">{p.description}</p>
                )}
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold">৳{p.price}</span> · {p.durationDays} দিন ·{" "}
                  {p._count.purchases} টি অনুরোধ
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  p.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                }`}
              >
                {p.active ? "চালু" : "বন্ধ"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <form action={togglePackage}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {p.active ? "⏸ বন্ধ করুন" : "▶ চালু করুন"}
                </button>
              </form>
            </div>

            {/* এডিট */}
            <details className="mt-3 rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
                ✏️ এডিট করুন
              </summary>
              <form action={updatePackage} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">নাম</label>
                  <input name="title" required defaultValue={p.title} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">বিবরণ</label>
                  <input name="description" defaultValue={p.description ?? ""} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">দাম (৳)</label>
                    <input name="price" type="number" min={0} required defaultValue={p.price} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">মেয়াদ (দিন)</label>
                    <input
                      name="durationDays"
                      type="number"
                      min={1}
                      required
                      defaultValue={p.durationDays}
                      className={inputCls}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="active" defaultChecked={p.active} /> চালু থাকবে
                </label>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  💾 সেভ করুন
                </button>
              </form>
            </details>

            {/* ডিলিট */}
            <details className="mt-2 rounded-lg border border-red-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">
                🗑 ডিলিট
              </summary>
              <p className="mt-2 text-xs text-red-700">
                ⚠️ ডিলিট করলে এই প্যাকেজের সব পেমেন্ট রেকর্ড ({p._count.purchases} টি) মুছে যাবে।
                যাদের মেয়াদ চলছে তারাও Premium অ্যাক্সেস হারাবে। শুধু বন্ধ করতে চাইলে উপরের
                "বন্ধ করুন" ব্যবহার করুন।
              </p>
              <form action={deletePackage} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  নিশ্চিত, ডিলিট করুন
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ফাইল শেষ =====
