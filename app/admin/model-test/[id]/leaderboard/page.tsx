import Link from "next/link";
import { notFound } from "next/navigation";
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

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function rankBadge(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${bn(rank)}`;
}

export default async function AdminModelTestLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const test = await db.modelTest.findUnique({ where: { id } });
  if (!test) notFound();

  const attempts = await db.attempt.findMany({
    where: { testId: id },
    orderBy: [{ score: "desc" }, { timeSpent: "asc" }],
  });

  const count = attempts.length;
  const totalMarks = attempts[0]?.total ?? 0;
  const avgScore =
    count > 0 ? attempts.reduce((sum, a) => sum + a.score, 0) / count : 0;
  const highScore = count > 0 ? attempts[0].score : 0;
  const avgTime =
    count > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.timeSpent, 0) / count)
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/admin/model-test"
        className="inline-block text-sm font-semibold text-indigo-600 hover:underline"
      >
        ← মডেল টেস্ট ড্যাশবোর্ডে ফিরে যান
      </Link>

      <div className="mt-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white shadow">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Leaderboard
        </div>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">{test.title}</h1>
        <p className="mt-1 text-sm opacity-90">
          {test.className} • {test.subject} • {test.chapter}
        </p>
        <p className="mt-1 text-xs opacity-80">
          {formatDateTime(test.startAt)} থেকে {formatDateTime(test.endAt)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-xs text-slate-500">মোট পরীক্ষার্থী</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{bn(count)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-xs text-slate-500">গড় নম্বর</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {bn(avgScore.toFixed(1))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-xs text-slate-500">সর্বোচ্চ নম্বর</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">
            {bn(highScore)}
            {totalMarks > 0 && (
              <span className="text-sm text-slate-400"> / {bn(totalMarks)}</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <div className="text-xs text-slate-500">গড় সময়</div>
          <div className="mt-1 text-base font-bold text-blue-600">
            {count > 0 ? formatDuration(avgTime) : "—"}
          </div>
        </div>
      </div>

      {count === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            এখনো কেউ এই পরীক্ষায় অংশ নেয়নি।
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {attempts.map((a, i) => {
            const rank = i + 1;
            const percent = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
            const top = rank <= 3;

            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm ${
                  top ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
                }`}
              >
                <div
                  className={`w-10 shrink-0 text-center font-bold ${
                    top ? "text-2xl" : "text-sm text-slate-500"
                  }`}
                >
                  {rankBadge(rank)}
                </div>

                {a.userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.userImage}
                    alt={a.userName}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                    {a.userName?.charAt(0) || "?"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-800">{a.userName}</div>
                  <div className="truncate text-xs text-slate-500">
                    রোল: {a.rollNumber} • {a.studentClass}
                    {a.institution ? ` • ${a.institution}` : ""}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>⏱ {formatDuration(a.timeSpent)}</span>
                    {a.warnings > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-600">
                        ⚠️ {bn(a.warnings)}টি ওয়ার্নিং
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold text-emerald-600">
                    {bn(a.score)}
                    <span className="text-xs text-slate-400"> / {bn(a.total)}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-500">{bn(percent)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
