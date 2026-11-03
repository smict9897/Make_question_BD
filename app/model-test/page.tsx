import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUserId, hasPremium } from "@/lib/premium";
import FeedShareButton from "@/components/feed-share-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type SP = Promise<{
  filter?: string;
  subject?: string;
  q?: string;
  page?: string;
}>;

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "live", label: "🟢 চলছে" },
  { id: "upcoming", label: "🟡 আসছে" },
  { id: "ended", label: "🔴 শেষ" },
  { id: "free", label: "ফ্রি" },
  { id: "paid", label: "👑 প্রিমিয়াম" },
];

function bn(n: number) {
  return n.toLocaleString("bn-BD");
}

function fmtDateTime(d: Date) {
  return d.toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(d: Date) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "এইমাত্র";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${bn(min)} মিনিট আগে`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${bn(hr)} ঘণ্টা আগে`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${bn(day)} দিন আগে`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${bn(mon)} মাস আগে`;
  return `${bn(Math.floor(mon / 12))} বছর আগে`;
}

function diffLabel(d: string) {
  const v = d.toUpperCase();
  if (v === "EASY") return "সহজ";
  if (v === "MEDIUM") return "মাঝারি";
  if (v === "HARD") return "কঠিন";
  return d;
}

export default async function ModelTestFeedPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const now = new Date();

  const filter = FILTERS.some((f) => f.id === sp.filter) ? sp.filter! : "all";
  const subject = (sp.subject ?? "").trim();
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  const where: Prisma.ModelTestWhereInput = { status: "PUBLISHED" };
  if (filter === "live") {
    where.startAt = { lte: now };
    where.endAt = { gte: now };
  } else if (filter === "upcoming") {
    where.startAt = { gt: now };
  } else if (filter === "ended") {
    where.endAt = { lt: now };
  } else if (filter === "free") {
    where.isPaid = false;
  } else if (filter === "paid") {
    where.isPaid = true;
  }
  if (subject) where.subject = subject;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const userId = await getCurrentUserId().catch(() => null);
  const premium = userId ? await hasPremium(userId).catch(() => false) : false;

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [tests, filteredCount, totalTests, liveNow, recentAttempts, totalAttempts, subjectRows] =
    await Promise.all([
      db.modelTest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { _count: { select: { attempts: true } } },
      }),
      db.modelTest.count({ where }),
      db.modelTest.count({ where: { status: "PUBLISHED" } }),
      db.modelTest.count({
        where: { status: "PUBLISHED", startAt: { lte: now }, endAt: { gte: now } },
      }),
      db.attempt.count({ where: { createdAt: { gte: since24h } } }),
      db.attempt.count(),
      db.modelTest.findMany({
        where: { status: "PUBLISHED" },
        distinct: ["subject"],
        select: { subject: true },
        orderBy: { subject: "asc" },
      }),
    ]);

  // এই ইউজার কোন কোন পরীক্ষা দিয়েছে
  const attemptedIds = new Set<string>();
  if (userId && tests.length > 0) {
    const mine = await db.attempt.findMany({
      where: { userId, testId: { in: tests.map((t) => t.id) } },
      select: { testId: true },
    });
    mine.forEach((a) => attemptedIds.add(a.testId));
  }

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  function href(over: { filter?: string; page?: number }) {
    const p = new URLSearchParams();
    const f = over.filter ?? filter;
    if (f && f !== "all") p.set("filter", f);
    if (subject) p.set("subject", subject);
    if (q) p.set("q", q);
    const pg = over.page ?? 1;
    if (pg > 1) p.set("page", String(pg));
    const s = p.toString();
    return s ? `/model-test?${s}` : "/model-test";
  }

  const stats = [
    { label: "মোট পরীক্ষা", value: totalTests, cls: "bg-indigo-50 text-indigo-700" },
    { label: "এখন চলছে", value: liveNow, cls: "bg-emerald-50 text-emerald-700" },
    { label: "২৪ ঘণ্টার অংশগ্রহণ", value: recentAttempts, cls: "bg-amber-50 text-amber-700" },
    { label: "মোট অংশগ্রহণ", value: totalAttempts, cls: "bg-pink-50 text-pink-700" },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-5 pb-28">
      {/* প্রিমিয়াম ব্যানার */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-6 text-white sm:rounded-b-2xl">
        <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl">
          🎯 লাইভ মডেল টেস্ট —{" "}
          <span className="text-amber-400">প্রিমিয়াম</span> ব্যাচে যোগ দিন
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          সব পেইড পরীক্ষা আনলক করুন • র‍্যাংক দেখুন • নিজেকে যাচাই করুন
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {premium ? (
            <Link
              href="/packages"
              className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-white"
            >
              👑 আপনার Premium চালু আছে
            </Link>
          ) : (
            <Link
              href="/packages"
              className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-white"
            >
              👑 Join Premium
            </Link>
          )}
          <Link
            href="/model-test/leaderboard"
            className="rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/30"
          >
            🏆 Global Leaderboard
          </Link>
          <a
            href="#search"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3 text-sm font-bold text-white"
          >
            🔍 বিষয়ভিত্তিক খুঁজুন
          </a>
        </div>
      </section>

      <div className="space-y-5 px-4">
        {/* স্ট্যাটস */}
        <section className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-2xl p-4 text-center ${s.cls}`}>
              <p className="text-2xl font-extrabold">{bn(s.value)}</p>
              <p className="mt-1 text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </section>

        {/* সার্চ */}
        <form id="search" action="/model-test" method="get" className="space-y-3">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="🔍 পরীক্ষার নাম খুঁজুন..."
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
          />
          <select
            name="subject"
            defaultValue={subject}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
          >
            <option value="">📚 সব বিষয়</option>
            {subjectRows.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white"
          >
            খুঁজুন
          </button>
        </form>

        {/* ফিল্টার ট্যাব */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-2">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={href({ filter: f.id })}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                  filter === f.id
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* কার্ড */}
        {tests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            কোনো পরীক্ষা পাওয়া যায়নি।
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((t) => {
              const started = t.startAt <= now;
              const ended = t.endAt < now;
              const live = started && !ended;
              const attempted = attemptedIds.has(t.id);
              const qCount = Array.isArray(t.questions) ? t.questions.length : 0;
              const locked = t.isPaid && !premium;

              let action: { label: string; href: string; cls: string };
              if (attempted) {
                action = {
                  label: "✅ ফলাফল দেখুন",
                  href: `/model-test/${t.id}`,
                  cls: "bg-emerald-600 text-white",
                };
              } else if (ended) {
                action = {
                  label: "🔴 শেষ হয়েছে",
                  href: `/model-test/${t.id}`,
                  cls: "bg-slate-200 text-slate-600",
                };
              } else if (!started) {
                action = {
                  label: "🟡 শীঘ্রই শুরু",
                  href: `/model-test/${t.id}`,
                  cls: "bg-amber-100 text-amber-800",
                };
              } else if (locked) {
                action = {
                  label: "🔒 Unlock Premium",
                  href: "/packages",
                  cls: "bg-gradient-to-r from-amber-400 to-orange-500 text-white",
                };
              } else {
                action = {
                  label: "▶ পরীক্ষা শুরু",
                  href: `/model-test/${t.id}`,
                  cls: "bg-indigo-600 text-white",
                };
              }

              return (
                <article
                  key={t.id}
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm ${
                    t.isPaid ? "border-2 border-amber-400" : "border border-slate-200"
                  }`}
                >
                  <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {t.isPaid ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            👑 PREMIUM
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                            FREE
                          </span>
                        )}
                        <span className="text-xs text-slate-500">{timeAgo(t.createdAt)}</span>
                      </div>
                      <span className="text-xs font-semibold text-indigo-700">
                        👥 {bn(t._count.attempts)} জন
                      </span>
                    </div>

                    <span className="inline-block rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                      {t.subject}
                    </span>

                    <div>
                      <h2 className="text-lg font-bold leading-snug text-slate-900">
                        {t.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {t.className} • {t.chapter}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-700">
                      <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                        ❓ {bn(qCount)} প্রশ্ন
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                        ⏱ {bn(t.minutes)} মি.
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                        {diffLabel(t.difficulty)}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      {live
                        ? `🟢 চলছে — শেষ: ${fmtDateTime(t.endAt)}`
                        : !started
                        ? `🟡 শুরু: ${fmtDateTime(t.startAt)}`
                        : `🔴 শেষ হয়েছে: ${fmtDateTime(t.endAt)}`}
                    </p>

                    <div className="flex items-center gap-2">
                      <Link
                        href={action.href}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-bold ${action.cls}`}
                      >
                        {action.label}
                      </Link>
                      <Link
                        href={`/model-test/${t.id}/leaderboard`}
                        aria-label="Leaderboard"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        🏆
                      </Link>
                      <FeedShareButton path={`/model-test/${t.id}`} title={t.title} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3 pt-2">
            {page > 1 ? (
              <Link
                href={href({ page: page - 1 })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                ← আগের
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-slate-500">
              {bn(page)} / {bn(totalPages)}
            </span>
            {page < totalPages ? (
              <Link
                href={href({ page: page + 1 })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                পরের →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  );
}

// ===== ফাইল শেষ =====
