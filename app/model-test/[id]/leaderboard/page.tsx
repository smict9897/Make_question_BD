import Link from "next/link";
import { notFound } from "next/navigation";
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

type Row = {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  institution: string | null;
  score: number;
  total: number;
  timeSpent: number;
};

function Avatar({ name, image, size }: { name: string; image: string | null; size: string }) {
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
      className={`${size} flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-lg font-bold text-indigo-600 shadow`}
    >
      {name?.charAt(0) || "?"}
    </div>
  );
}

export default async function ModelTestLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const test = await db.modelTest.findUnique({ where: { id } });
  if (!test || test.status === "DRAFT") notFound();

  const session = await auth();
  let myUserId: string | null = null;
  if (session?.user?.email) {
    const me = await db.user.findUnique({ where: { email: session.user.email } });
    myUserId = me?.id ?? null;
  }

  const attempts = await db.attempt.findMany({
    where: { testId: id },
    orderBy: [{ score: "desc" }, { timeSpent: "asc" }],
    take: 200,
  });

  const rows: Row[] = attempts.map((a) => ({
    id: a.id,
    userId: a.userId,
    userName: a.userName,
    userImage: a.userImage,
    institution: a.institution,
    score: a.score,
    total: a.total,
    timeSpent: a.timeSpent,
  }));

  const myIndex = myUserId ? rows.findIndex((r) => r.userId === myUserId) : -1;
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const podium = [
    { row: top3[1], rank: 2 },
    { row: top3[0], rank: 1 },
    { row: top3[2], rank: 3 },
  ].filter((x) => x.row);

  const podiumStyle: Record<number, { height: string; color: string; icon: string; avatar: string }> = {
    1: { height: "h-28", color: "bg-amber-400", icon: "👑", avatar: "h-20 w-20" },
    2: { height: "h-20", color: "bg-slate-300", icon: "🥈", avatar: "h-16 w-16" },
    3: { height: "h-16", color: "bg-orange-300", icon: "🥉", avatar: "h-16 w-16" },
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/model-test/${id}`}
        className="inline-block text-sm font-semibold text-indigo-600 hover:underline"
      >
        ← পরীক্ষার পেজে ফিরে যান
      </Link>

      <div className="mt-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-center text-white shadow">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Leaderboard
        </div>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">{test.title}</h1>
        <p className="mt-1 text-sm opacity-90">
          {test.subject} • {bn(rows.length)} জন অংশগ্রহণকারী
        </p>
      </div>

      {myRow && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-3">
          <div className="text-center">
            <div className="text-xs text-slate-500">আপনার র‍্যাংক</div>
            <div className="text-2xl font-bold text-indigo-600">#{bn(myIndex + 1)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold text-emerald-600">
              {bn(myRow.score)}
              <span className="text-xs text-slate-400"> / {bn(myRow.total)}</span>
            </div>
            <div className="text-xs text-slate-500">⏱ {formatDuration(myRow.timeSpent)}</div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            এখনো কেউ এই পরীক্ষায় অংশ নেয়নি।
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-end justify-center gap-2">
            {podium.map(({ row, rank }) => {
              const st = podiumStyle[rank];
              const isMe = row.userId === myUserId;
              return (
                <div key={row.id} className="flex w-1/3 max-w-[140px] flex-col items-center">
                  <div className="text-2xl">{st.icon}</div>
                  <Avatar name={row.userName} image={row.userImage} size={st.avatar} />
                  <div
                    className={`mt-1 w-full truncate text-center text-xs font-bold ${
                      isMe ? "text-indigo-600" : "text-slate-800"
                    }`}
                  >
                    {row.userName}
                  </div>
                  <div className="text-xs font-semibold text-emerald-600">
                    {bn(row.score)}/{bn(row.total)}
                  </div>
                  <div
                    className={`mt-1 flex w-full items-center justify-center rounded-t-xl text-xl font-extrabold text-white ${st.color} ${st.height}`}
                  >
                    {bn(rank)}
                  </div>
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="mt-4 grid gap-2">
              {rest.map((r, i) => {
                const rank = i + 4;
                const isMe = r.userId === myUserId;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      isMe
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="w-8 shrink-0 text-center text-sm font-bold text-slate-500">
                      #{bn(rank)}
                    </div>
                    <Avatar name={r.userName} image={r.userImage} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {r.userName}
                        {isMe && <span className="ml-1 text-xs text-indigo-600">(আপনি)</span>}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {r.institution ? `${r.institution} • ` : ""}⏱ {formatDuration(r.timeSpent)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-base font-bold text-emerald-600">
                      {bn(r.score)}
                      <span className="text-xs text-slate-400"> / {bn(r.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
