import Link from "next/link";
import { db } from "@/lib/db";
import { PlusCircle, Users, Clock, Pencil } from "lucide-react";
import ShareLinkButton from "@/components/share-link-button";
import ModelTestDeleteButton from "@/components/model-test-delete-button";

export const dynamic = "force-dynamic";

function getLiveStatus(test: { status: string; startAt: Date; endAt: Date }) {
  if (test.status === "DRAFT") {
    return { label: "খসড়া", color: "bg-slate-200 text-slate-700", dot: "⚪" };
  }
  const now = new Date();
  if (now < test.startAt) {
    return { label: "আসছে (Upcoming)", color: "bg-amber-100 text-amber-800", dot: "🟡" };
  }
  if (now > test.endAt) {
    return { label: "শেষ (Ended)", color: "bg-red-100 text-red-700", dot: "🔴" };
  }
  return { label: "লাইভ (Live)", color: "bg-green-100 text-green-700", dot: "🟢" };
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ModelTestListPage() {
  const tests = await db.modelTest.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attempts: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">মডেল টেস্ট ড্যাশবোর্ড</h1>
        <Link
          href="/admin/model-test/create"
          className="inline-flex items-center gap-2 rounded-xl bg-royal px-4 py-2.5 font-semibold text-white hover:opacity-90"
        >
          <PlusCircle size={18} /> নতুন তৈরি করুন
        </Link>
      </div>

      {tests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          এখনো কোনো মডেল টেস্ট তৈরি হয়নি।
        </div>
      )}

      <div className="grid gap-4">
        {tests.map((t) => {
          const status = getLiveStatus(t);
          const shareUrl = `https://saifulsir.com/model-test/${t.id}`;
          return (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
                      {status.dot} {status.label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        t.isPaid ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {t.isPaid ? "পেইড" : "ফ্রি"}
                    </span>
                  </div>
                  <h2 className="truncate text-lg font-bold text-slate-900">{t.title}</h2>
                  <p className="text-sm text-slate-600">
                    {t.className} · {t.subject} · {t.chapter}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Users size={14} /> {t._count.attempts} জন অংশ নিয়েছে
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} /> {t.minutes} মিনিট
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    শুরু: {formatDateTime(t.startAt)} &nbsp;→&nbsp; শেষ: {formatDateTime(t.endAt)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Link
                  href={`/admin/model-test/${t.id}/leaderboard`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  লিডারবোর্ড দেখুন
                </Link>
                <Link
                  href={`/admin/model-test/${t.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={14} /> Edit
                </Link>
                <ModelTestDeleteButton id={t.id} attemptCount={t._count.attempts} />
                {t.status === "PUBLISHED" && <ShareLinkButton url={shareUrl} />}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
