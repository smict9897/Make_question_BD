import Link from "next/link";
import { db } from "@/lib/db";

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

type BannerTest = {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  isPaid: boolean;
  startAt: Date;
  endAt: Date;
};

export default async function HomeModelTestBanner() {
  const now = new Date();
  let tests: BannerTest[] = [];
  const countMap = new Map<string, number>();

  try {
    const select = {
      id: true,
      title: true,
      subject: true,
      minutes: true,
      isPaid: true,
      startAt: true,
      endAt: true,
    } as const;

    // আগে চলমান ও আসন্ন টেস্ট
    tests = await db.modelTest.findMany({
      where: { status: "PUBLISHED", endAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: 3,
      select,
    });

    // না থাকলে সর্বশেষ ৩টা
    if (tests.length === 0) {
      tests = await db.modelTest.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { startAt: "desc" },
        take: 3,
        select,
      });
    }

    if (tests.length > 0) {
      const counts = await db.attempt.groupBy({
        by: ["testId"],
        where: { testId: { in: tests.map((t) => t.id) } },
        _count: { _all: true },
      });
      counts.forEach((c) => countMap.set(c.testId, c._count._all));
    }
  } catch {
    return null;
  }

  if (tests.length === 0) return null;

  return (
    <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">
              🎯 লাইভ মডেল টেস্ট
            </h2>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              পরীক্ষা দিন, র‍্যাংক দেখুন, নিজেকে যাচাই করুন।
            </p>
          </div>
          <Link
            href="/model-test"
            className="flex h-10 items-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-sm font-bold text-white shadow"
          >
            সব দেখুন →
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => {
            const state =
              now < t.startAt ? "upcoming" : now > t.endAt ? "ended" : "live";
            const participants = countMap.get(t.id) ?? 0;

            return (
              <Link
                key={t.id}
                href={`/model-test/${t.id}`}
                className="block rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      t.isPaid
                        ? "bg-amber-400 text-slate-900"
                        : "bg-emerald-400 text-slate-900"
                    }`}
                  >
                    {t.isPaid ? "👑 PREMIUM" : "FREE"}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-200">
                    {state === "live"
                      ? "🟢 চলছে"
                      : state === "upcoming"
                      ? "🟡 আসছে"
                      : "🔴 শেষ"}
                  </span>
                </div>

                <div className="mt-2 inline-block rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
                  {t.subject}
                </div>

                <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug">
                  {t.title}
                </h3>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300">
                  <span>⏱ {bn(t.minutes)} মি.</span>
                  <span>👥 {bn(participants)} জন</span>
                </div>

                <div className="mt-1 text-[11px] text-slate-400">
                  {state === "upcoming"
                    ? `শুরু: ${fmtDate(t.startAt)}`
                    : state === "live"
                    ? `শেষ: ${fmtDate(t.endAt)}`
                    : `শেষ হয়েছে: ${fmtDate(t.endAt)}`}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ===== ফাইল শেষ =====
