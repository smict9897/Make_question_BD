import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import ModelTestLoginButton from "@/components/model-test-login-button";
import ProfileNameEditor from "@/components/profile-name-editor";
import ProfilePremiumCard from "@/components/profile-premium-card";

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

function getGreeting() {
  const hourRaw = Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      hour12: false,
    })
  );
  const hour = hourRaw % 24;
  if (hour >= 5 && hour < 12) return { text: "সুপ্রভাত", icon: "🌅" };
  if (hour >= 12 && hour < 16) return { text: "শুভ দুপুর", icon: "☀️" };
  if (hour >= 16 && hour < 19) return { text: "শুভ বিকেল", icon: "🌇" };
  return { text: "শুভ রাত্রি", icon: "🌙" };
}

const LEVELS = [
  { name: "Spark", min: 0, icon: "⚡" },
  { name: "Lamp", min: 100, icon: "🪔" },
  { name: "Torch", min: 300, icon: "🔦" },
  { name: "Star", min: 700, icon: "⭐" },
  { name: "Rocket", min: 1500, icon: "🚀" },
  { name: "Champion", min: 3000, icon: "🏆" },
];

function getLevelInfo(xp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) idx = i;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.round(((xp - current.min) / (next.min - current.min)) * 100))
    : 100;
  return {
    levelNo: idx + 1,
    current,
    next,
    progress,
    toNext: next ? next.min - xp : 0,
  };
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      {children}
    </div>
  );
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <Shell>
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">আপনার প্রোফাইল দেখুন</h1>
        <p className="mt-2 text-sm text-slate-500">
          প্রোফাইল দেখতে Google দিয়ে লগইন করুন।
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ModelTestLoginButton callbackUrl="/profile" />
        </div>
      </Shell>
    );
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });

  if (!user) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-slate-800">
          ইউজার পাওয়া যায়নি, আবার লগইন করুন।
        </h1>
      </Shell>
    );
  }

  const attempts = await db.attempt.findMany({
    where: { userId: user.id },
    orderBy: { id: "desc" },
    take: 50,
  });

  const testIds = Array.from(new Set(attempts.map((a) => a.testId)));
  const tests = testIds.length
    ? await db.modelTest.findMany({
        where: { id: { in: testIds } },
        select: { id: true, title: true, subject: true },
      })
    : [];
  const testMap = new Map(tests.map((t) => [t.id, t]));

  const ranks = await Promise.all(
    attempts.map(async (a) => {
      const better = await db.attempt.count({
        where: {
          testId: a.testId,
          OR: [
            { score: { gt: a.score } },
            { score: a.score, timeSpent: { lt: a.timeSpent } },
          ],
        },
      });
      return better + 1;
    })
  );

  const examCount = attempts.length;
  const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
  const percents = attempts.map((a) =>
    a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
  );
  const avgPercent =
    examCount > 0 ? Math.round(percents.reduce((s, p) => s + p, 0) / examCount) : 0;
  const bestPercent = examCount > 0 ? Math.max(...percents) : 0;

  const xp = examCount * 20 + totalScore * 5;
  const level = getLevelInfo(xp);

  const displayName = user.name || session.user.name || "শিক্ষার্থী";
  const image = user.image || session.user.image || null;
  const greeting = getGreeting();

  const quickActions = [
    { href: "#history", icon: "📝", label: "আমার পরীক্ষা" },
    { href: "/model-test", icon: "🎯", label: "মডেল টেস্ট" },
    { href: "/model-test/leaderboard", icon: "🏆", label: "Leaderboard" },
    { href: "/packages", icon: "👑", label: "প্যাকেজ" },
    { href: "/exam", icon: "🤖", label: "AI পরীক্ষা" },
    { href: "/tests", icon: "📚", label: "প্র্যাকটিস টেস্ট" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Greeting + নাম এডিট */}
      <div className="flex items-center gap-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="h-14 w-14 shrink-0 rounded-full border-2 border-indigo-200 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
            {displayName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <ProfileNameEditor
            initialName={displayName}
            greetingText={greeting.text}
            greetingIcon={greeting.icon}
          />
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </div>

      {/* Level card */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xl">
            {level.current.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800">
              Level {bn(level.levelNo)} · {level.current.name}
            </div>
            <div className="text-xs text-slate-500">
              {level.next
                ? `${bn(level.toNext)} XP বাকি — ${level.next.name} লেভেলে পৌঁছাতে`
                : "আপনি সর্বোচ্চ লেভেলে পৌঁছেছেন! 🎉"}
            </div>
          </div>
          <div className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
            {bn(xp)} XP
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            style={{ width: `${level.progress}%` }}
          />
        </div>
      </div>

      {/* Stats + Premium */}
      <div className="mt-4 grid gap-4 sm:grid-cols-5">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4 text-white shadow sm:col-span-3">
          <div className="text-xs font-semibold opacity-80">আপনার পারফরম্যান্স</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/15 p-2">
              <div className="text-2xl font-extrabold">{bn(examCount)}</div>
              <div className="text-[11px] opacity-90">মোট পরীক্ষা</div>
            </div>
            <div className="rounded-xl bg-white/15 p-2">
              <div className="text-2xl font-extrabold">{bn(avgPercent)}%</div>
              <div className="text-[11px] opacity-90">গড় নম্বর</div>
            </div>
            <div className="rounded-xl bg-white/15 p-2">
              <div className="text-2xl font-extrabold">{bn(bestPercent)}%</div>
              <div className="text-[11px] opacity-90">সেরা ফল</div>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <ProfilePremiumCard userId={user.id} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-slate-800">Quick Actions</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickActions.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3 text-center text-xs font-semibold text-slate-700 hover:bg-indigo-50"
            >
              <span className="text-2xl">{q.icon}</span>
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      {/* History */}
      <div id="history" className="mt-4 scroll-mt-20">
        <div className="mb-2 text-sm font-bold text-slate-800">
          📝 আমার পরীক্ষার ইতিহাস
        </div>

        {examCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="text-4xl">📭</div>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              আপনি এখনো কোনো মডেল টেস্ট দেননি।
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {attempts.map((a, i) => {
              const t = testMap.get(a.testId);
              const percent = percents[i];
              const rank = ranks[i];
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <div className="text-[10px] font-semibold">র‍্যাংক</div>
                    <div className="text-base font-extrabold leading-none">
                      #{bn(rank)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-800">
                      {t?.title ?? "মুছে ফেলা টেস্ট"}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {t?.subject ? `${t.subject} • ` : ""}⏱ {formatDuration(a.timeSpent)}
                    </div>
                    <Link
                      href={`/model-test/${a.testId}/leaderboard`}
                      className="mt-0.5 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      🏆 Leaderboard দেখুন
                    </Link>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-bold text-emerald-600">
                      {bn(a.score)}
                      <span className="text-xs text-slate-400"> / {bn(a.total)}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {bn(percent)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== ফাইল শেষ =====
