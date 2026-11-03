import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(n: number | string) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${bn(m)} মি. ${bn(s)} সে.`;
}

const PERIODS = [
  { key: "all", label: "🏆 সব সময়", days: 0 },
  { key: "month", label: "📅 এই মাস", days: 30 },
  { key: "week", label: "🔥 এই সপ্তাহ", days: 7 },
];

type Row = {
  userId: string;
  name: string;
  image: string | null;
  exams: number;
  score: number;
  total: number;
  time: number;
  percent: number;
};

function Avatar({
  name,
  image,
  size,
}: {
  name: string;
  image: string | null;
  size: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full border-2 border-white object-cover shadow`}
      />
    );
  }
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-indigo-100 font-bold text-indigo-600 shadow`}
    >
      {name.charAt(0)}
    </div>
  );
}

type SearchParams = Promise<{ period?: string }>;

export default async function GlobalLeaderboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[0];

  const where =
    period.days > 0
      ? {
          createdAt: {
            gte: new Date(Date.now() - period.days * 24 * 60 * 60 * 1000),
          },
        }
      : {};

  const grouped = await db.attempt.groupBy({
    by: ["userId"],
    where,
    _sum: { score: true, total: true, timeSpent: true },
    _count: { _all: true },
  });

  const sorted = grouped
    .map((g) => ({
      userId: g.userId,
      exams: g._count._all,
      score: g._sum.score ?? 0,
      total: g._sum.total ?? 0,
      time: g._sum.timeSpent ?? 0,
    }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.time - b.time));

  const top = sorted.slice(0, 50);

  // বর্তমান ইউজার
  let myId: string | null = null;
  const session = await auth();
  if (session?.user?.email) {
    const me = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    myId = me?.id ?? null;
  }
  const myIndex = myId ? sorted.findIndex((s) => s.userId === myId) : -1;

  // নাম ও ছবি আনা (টপ ৫০ + নিজে)
  const needIds = new Set(top.map((t) => t.userId));
  if (myIndex >= 0 && myId) needIds.add(myId);

  const users = needIds.size
    ? await db.user.findMany({
        where: { id: { in: Array.from(needIds) } },
        select: { id: true, name: true, image: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  function toRow(s: (typeof sorted)[number]): Row {
    const u = userMap.get(s.userId);
    return {
      userId: s.userId,
      name: u?.name || "শিক্ষার্থী",
      image: u?.image ?? null,
      exams: s.exams,
      score: s.score,
      total: s.total,
      time: s.time,
      percent: s.total > 0 ? Math.round((s.score / s.total) * 100) : 0,
    };
  }

  const rows = top.map(toRow);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const myRow = myIndex >= 0 ? toRow(sorted[myIndex]) : null;

  // Podium সাজানো: ২য়, ১ম, ৩য়
  const podiumOrder = [
    { pos: 2, row: podium[1], height: "h-24", medal: "🥈", ring: "ring-slate-300" },
    { pos: 1, row: podium[0], height: "h-32", medal: "🥇", ring: "ring-amber-400" },
    { pos: 3, row: podium[2], height: "h-20", medal: "🥉", ring: "ring-orange-300" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 px-4 pb-6 pt-8 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-extrabold sm:text-3xl">🏆 গ্লোবাল লিডারবোর্ড</h1>
          <p className="mt-1 text-sm opacity-90">
            সব মডেল টেস্ট মিলিয়ে সেরা শিক্ষার্থীরা
          </p>

          <div className="mt-4 flex justify-center gap-2">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={p.key === "all" ? "/model-test/leaderboard" : `/model-test/leaderboard?period=${p.key}`}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  period.key === p.key
                    ? "bg-white text-indigo-700"
                    : "bg-white/20 text-white"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <div className="mx-auto mt-6 flex max-w-md items-end justify-center gap-2">
            {podiumOrder.map(({ pos, row, height, medal, ring }) =>
              row ? (
                <div key={pos} className="flex w-1/3 flex-col items-center text-center">
                  {pos === 1 && <div className="text-2xl">👑</div>}
                  <div className={`rounded-full ring-4 ${ring}`}>
                    <Avatar
                      name={row.name}
                      image={row.image}
                      size={pos === 1 ? "h-16 w-16 text-xl" : "h-12 w-12 text-base"}
                    />
                  </div>
                  <div className="mt-1 w-full truncate px-1 text-xs font-bold">
                    {row.name}
                  </div>
                  <div className="text-[11px] opacity-90">{bn(row.score)} পয়েন্ট</div>
                  <div
                    className={`mt-1 flex w-full items-start justify-center rounded-t-xl bg-white/20 pt-2 text-2xl ${height}`}
                  >
                    {medal}
                  </div>
                </div>
              ) : (
                <div key={pos} className="w-1/3" />
              )
            )}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 py-5">
        {/* আমার র‍্যাংক */}
        {myRow && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-600 text-white">
              <div className="text-[10px] font-semibold">আপনার</div>
              <div className="text-base font-extrabold leading-none">
                #{bn(myIndex + 1)}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-800">{myRow.name}</div>
              <div className="text-xs text-slate-500">
                {bn(myRow.exams)} টি পরীক্ষা • গড় {bn(myRow.percent)}%
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-base font-extrabold text-indigo-600">
                {bn(myRow.score)}
              </div>
              <div className="text-[11px] text-slate-500">পয়েন্ট</div>
            </div>
          </div>
        )}

        {!myRow && session?.user?.email && (
          <div className="mb-4 rounded-2xl border border-dashed border-indigo-300 bg-white p-3 text-center text-xs font-semibold text-slate-600">
            এই সময়ে আপনি কোনো মডেল টেস্ট দেননি। পরীক্ষা দিয়ে লিডারবোর্ডে ঢুকে পড়ুন!
          </div>
        )}

        {/* তালিকা */}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              এই সময়ে এখনো কেউ পরীক্ষা দেয়নি।
            </p>
            <Link
              href="/model-test"
              className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white"
            >
              পরীক্ষা দিন
            </Link>
          </div>
        ) : (
          rest.length > 0 && (
            <div className="grid gap-2">
              {rest.map((r, i) => {
                const rank = i + 4;
                const isMe = r.userId === myId;
                return (
                  <div
                    key={r.userId}
                    className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm ${
                      isMe
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="w-8 shrink-0 text-center text-sm font-extrabold text-slate-500">
                      #{bn(rank)}
                    </div>
                    <Avatar name={r.name} image={r.image} size="h-10 w-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {r.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {bn(r.exams)} টি পরীক্ষা • গড় {bn(r.percent)}% • ⏱{" "}
                        {formatDuration(r.time)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-extrabold text-emerald-600">
                        {bn(r.score)}
                      </div>
                      <div className="text-[11px] text-slate-400">পয়েন্ট</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <p className="mt-5 text-center text-xs text-slate-400">
          পয়েন্ট = সব মডেল টেস্টের মোট সঠিক উত্তর। পয়েন্ট সমান হলে যার মোট সময় কম সে এগিয়ে।
        </p>

        <div className="mt-4 text-center">
          <Link
            href="/model-test"
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            ← সব মডেল টেস্ট
          </Link>
        </div>
      </div>
    </div>
  );
}

// ===== ফাইল শেষ =====
