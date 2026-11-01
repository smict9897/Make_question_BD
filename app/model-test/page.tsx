import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import ModelTestShareButton from "@/components/model-test-share-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(n: number | string) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

function fmtDate(d: Date) {
  return d.toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(date: Date, now: Date) {
  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const sec = Math.floor(Math.abs(diffMs) / 1000);
  const suffix = future ? "পরে" : "আগে";

  if (sec < 60) return future ? "এখনই" : "এইমাত্র";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${bn(min)} মিনিট ${suffix}`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${bn(hour)} ঘণ্টা ${suffix}`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${bn(day)} দিন ${suffix}`;
  const month = Math.floor(day / 30);
  return `${bn(month)} মাস ${suffix}`;
}

// Attempt-এ createdAt না থাকলে null ফেরত দেয়, পেজ ভাঙে না
async function countRecentAttempts(since: Date): Promise<number | null> {
  try {
    return await (db.attempt as any).count({
      where: { createdAt: { gte: since } },
    });
  } catch {
    return null;
  }
}

const FILTERS = [
  { key: "all", label: "সব" },
  { key: "live", label: "🟢 চলছে" },
  { key: "upcoming", label: "🟡 আসছে" },
  { key: "ended", label: "🔴 শেষ" },
  { key: "free", label: "ফ্রি" },
  { key: "paid", label: "প্রিমিয়াম" },
];

type SearchParams = Promise<{
  filter?: string;
  page?: string;
  subject?: string;
  q?: string;
}>;

export default async function ModelTestFeedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as string) : "all";
  const subject = (sp.subject ?? "").trim();
  const q = (sp.q ?? "").trim().slice(0, 60);
  const now = new Date();

  const where: Prisma.ModelTestWhereInput = { status: "PUBLISHED" };
  if (filter === "free") where.isPaid = false;
  if (filter === "paid") where.isPaid = true;
  if (filter === "live") {
    where.startAt = { lte: now };
    where.endAt = { gte: now };
  }
  if (filter === "upcoming") where.startAt = { gt: now };
  if (filter === "ended") where.endAt = { lt: now };
  if (subject) where.subject = subject;
  if (q) where.title = { contains: q };

  const total = await db.modelTest.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rawPage = parseInt(sp.page ?? "1", 10);
  const page = Math.min(totalPages, Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage));

  const tests = await db.modelTest.findMany({
    where,
    orderBy: { startAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      className: true,
      subject: true,
      chapter: true,
      difficulty: true,
      minutes: true,
      isPaid: true,
      startAt: true,
      endAt: true,
      questions: true,
    },
  });

  const ids = tests.map((t) => t.id);

  const counts = ids.length
    ? await db.attempt.groupBy({
        by: ["testId"],
        where: { testId: { in: ids } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map(counts.map((c) => [c.testId, c._count._all]));

  // স্ট্যাটস বার
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [totalTests, liveTests, totalAttempts, recentAttempts, subjectRows] =
    await Promise.all([
      db.modelTest.count({ where: { status: "PUBLISHED" } }),
      db.modelTest.count({
        where: { status: "PUBLISHED", startAt: { lte: now }, endAt: { gte: now } },
      }),
      db.attempt.count(),
      countRecentAttempts(dayAgo),
      db.modelTest.findMany({
        where: { status: "PUBLISHED" },
        distinct: ["subject"],
        select: { subject: true },
        orderBy: { subject: "asc" },
      }),
    ]);
  const subjects = subjectRows.map((s) => s.subject);

  // লগইন করা থাকলে কোন টেস্ট দিয়েছেন
  const attemptedSet = new Set<string>();
  const session = await auth();
  if (session?.user?.email && ids.length) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (user) {
      const mine = await db.attempt.findMany({
        where: { userId: user.id, testId: { in: ids } },
        select: { testId: true },
      });
      mine.forEach((m) => attemptedSet.add(m.testId));
    }
  }

  function href(f: string, p: number) {
    const params = new URLSearchParams();
    if (f !== "all") params.set("filter", f);
    if (subject) params.set("subject", subject);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/model-test?${s}` : "/model-test";
  }

  const pageNumbers: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pageNumbers.push(i);
  }

  const hasActiveSearch = Boolean(subject || q);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Premium banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-6 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl">
              <span>🎯 লাইভ মডেল টেস্ট — </span>
              <span className="text-amber-400">প্রিমিয়াম</span>
              <span> ব্যাচে যোগ দিন</span>
            </h1>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              সব পেইড পরীক্ষা আনলক করুন • র‍্যাংক দেখুন • নিজেকে যাচাই করুন
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex h-10 items-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-sm font-bold text-white shadow">
              👑 Join Premium · শীঘ্রই আসছে
            </span>
            <a
              href="#search"
              className="flex h-10 items-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 text-sm font-bold text-white shadow"
            >
              🔍 বিষয়ভিত্তিক খুঁজুন
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {/* Stats */}
        <div
          className={`grid grid-cols-2 gap-2 sm:gap-3 ${
            recentAttempts !== null ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          <div className="rounded-xl bg-indigo-50 p-3 text-center">
            <div className="text-xl font-extrabold text-indigo-600 sm:text-2xl">
              {bn(totalTests)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">মোট পরীক্ষা</div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <div className="text-xl font-extrabold text-emerald-600 sm:text-2xl">
              {bn(liveTests)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">এখন চলছে</div>
          </div>
          {recentAttempts !== null && (
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <div className="text-xl font-extrabold text-amber-600 sm:text-2xl">
                {bn(recentAttempts)}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                ২৪ ঘণ্টার অংশগ্রহণ
              </div>
            </div>
          )}
          <div className="rounded-xl bg-pink-50 p-3 text-center">
            <div className="text-xl font-extrabold text-pink-600 sm:text-2xl">
              {bn(totalAttempts)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">মোট অংশগ্রহণ</div>
          </div>
        </div>

        {/* Search + Subject */}
        <form
          id="search"
          method="get"
          action="/model-test"
          className="mt-4 flex scroll-mt-20 flex-col gap-2 sm:flex-row"
        >
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="🔍 পরীক্ষার নাম খুঁজুন..."
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400"
          />
          <select
            name="subject"
            defaultValue={subject}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
          >
            <option value="">📚 সব বিষয়</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700"
          >
            খুঁজুন
          </button>
          {hasActiveSearch && (
            <Link
              href={filter !== "all" ? `/model-test?filter=${filter}` : "/model-test"}
              className="flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
            >
              ✕ মুছুন
            </Link>
          )}
        </form>

        {/* Filters */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href(f.key, 1)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${
                filter === f.key
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Cards */}
        {tests.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              এই ফিল্টারে কোনো পরীক্ষা পাওয়া যায়নি।
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((t) => {
              const state =
                now < t.startAt ? "upcoming" : now > t.endAt ? "ended" : "live";
              const qCount = Array.isArray(t.questions) ? t.questions.length : 0;
              const participants = countMap.get(t.id) ?? 0;
              const attempted = attemptedSet.has(t.id);

              let btnText = "▶ পরীক্ষা শুরু";
              let btnClass = "bg-indigo-600 text-white hover:bg-indigo-700";
              if (attempted) {
                btnText = "✅ ফলাফল দেখুন";
                btnClass = "bg-emerald-600 text-white hover:bg-emerald-700";
              } else if (state === "upcoming") {
                btnText = "🟡 শীঘ্রই শুরু";
                btnClass = "bg-amber-100 text-amber-700";
              } else if (state === "ended") {
                btnText = "🔴 শেষ হয়েছে";
                btnClass = "bg-slate-100 text-slate-500";
              } else if (t.isPaid) {
                btnText = "🔒 Unlock Premium";
                btnClass = "bg-gradient-to-r from-amber-400 to-orange-500 text-white";
              }

              return (
                <div
                  key={t.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                    t.isPaid ? "border-amber-300" : "border-slate-200"
                  }`}
                >
                  <div
                    className={`h-1.5 ${
                      t.isPaid
                        ? "bg-gradient-to-r from-amber-400 to-orange-500"
                        : "bg-gradient-to-r from-indigo-500 to-pink-500"
                    }`}
                  />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            t.isPaid
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {t.isPaid ? "👑 PREMIUM" : "FREE"}
                        </span>
                        <span className="truncate text-[11px] text-slate-400">
                          {timeAgo(t.startAt, now)}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        👥 {bn(participants)} জন
                      </span>
                    </div>

                    <div className="mt-2 inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                      {t.subject}
                    </div>

                    <h2 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-slate-800">
                      {t.title}
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {t.className} • {t.chapter}
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px] font-semibold text-slate-600">
                      <div className="rounded-lg bg-slate-50 py-1.5">
                        ❓ {bn(qCount)} প্রশ্ন
                      </div>
                      <div className="rounded-lg bg-slate-50 py-1.5">
                        ⏱ {bn(t.minutes)} মি.
                      </div>
                      <div className="rounded-lg bg-slate-50 py-1.5">{t.difficulty}</div>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-500">
                      {state === "upcoming"
                        ? `শুরু: ${fmtDate(t.startAt)}`
                        : state === "live"
                        ? `🟢 চলছে — শেষ: ${fmtDate(t.endAt)}`
                        : `শেষ হয়েছে: ${fmtDate(t.endAt)}`}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/model-test/${t.id}`}
                        className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-bold ${btnClass}`}
                      >
                        {btnText}
                      </Link>
                      <Link
                        href={`/model-test/${t.id}/leaderboard`}
                        aria-label="Leaderboard"
                        className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs hover:bg-slate-50"
                      >
                        🏆
                      </Link>
                      <ModelTestShareButton
                        path={`/model-test/${t.id}`}
                        title={t.title}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            {page > 1 && (
              <Link
                href={href(filter, page - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                ‹ আগের
              </Link>
            )}
            {pageNumbers.map((p) => (
              <Link
                key={p}
                href={href(filter, p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  p === page
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {bn(p)}
              </Link>
            ))}
            {page < totalPages && (
              <Link
                href={href(filter, page + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                পরের ›
              </Link>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          মোট {bn(total)}টি পরীক্ষার মধ্যে পেজ {bn(page)} / {bn(totalPages)}
        </p>
      </div>
    </div>
  );
}

// ===== ফাইল শেষ =====
