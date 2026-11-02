import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPremium } from "@/lib/premium";
import ModelTestLoginButton from "@/components/model-test-login-button";
import ModelTestClient from "@/components/model-test-client";
import type { ExamQuestion } from "@/components/LiveExamPlayer";

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

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      {children}
    </div>
  );
}

export default async function ModelTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const test = await db.modelTest.findUnique({ where: { id } });

  if (!test) notFound();

  const session = await auth();
  const now = new Date();

  if (test.status === "DRAFT") {
    return (
      <Shell>
        <div className="text-5xl">⚪</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">এই টেস্টটি এখনো প্রকাশিত হয়নি</h1>
        <p className="mt-2 text-sm text-slate-500">পরে আবার চেষ্টা করুন।</p>
      </Shell>
    );
  }

  if (!session?.user?.email) {
    return (
      <Shell>
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-500">পরীক্ষা দেওয়ার জন্য আপনাকে Google দিয়ে লগইন করতে হবে।</p>
        <div className="mt-6 w-full max-w-xs">
          <ModelTestLoginButton callbackUrl={`/model-test/${test.id}`} />
        </div>
      </Shell>
    );
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-slate-800">ইউজার পাওয়া যায়নি, আবার লগইন করুন।</h1>
      </Shell>
    );
  }

  // আগে অংশ নিয়ে থাকলে সময়সীমা শেষ হলেও ফলাফল দেখানো হবে
  const existingAttempt = await db.attempt.findUnique({
    where: { testId_userId: { testId: test.id, userId: user.id } },
  });

  if (existingAttempt) {
    const betterCount = await db.attempt.count({
      where: {
        testId: test.id,
        OR: [
          { score: { gt: existingAttempt.score } },
          {
            score: existingAttempt.score,
            timeSpent: { lt: existingAttempt.timeSpent },
          },
        ],
      },
    });
    const myRank = betterCount + 1;

    return (
      <Shell>
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-600">আপনি ইতিমধ্যে এই পরীক্ষাটি দিয়েছেন।</p>

        <div className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <div className="text-xs text-slate-500">প্রাপ্ত নম্বর</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">
              {bn(existingAttempt.score)} / {bn(existingAttempt.total)}
            </div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div className="text-xs text-slate-500">সময় লেগেছে</div>
            <div className="mt-1 text-sm font-bold text-blue-600">
              {formatDuration(existingAttempt.timeSpent)}
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <div className="text-xs text-slate-500">আপনার র‍্যাংক</div>
            <div className="mt-1 text-lg font-bold text-amber-600">#{bn(myRank)}</div>
          </div>
        </div>

        <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
          <Link
            href={`/model-test/${test.id}/answers`}
            className="col-span-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:opacity-90"
          >
            📄 উত্তরপত্র দেখুন
          </Link>
          <Link
            href={`/model-test/${test.id}/leaderboard`}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow hover:opacity-90"
          >
            🏆 Leaderboard
          </Link>
          <Link
            href="/profile"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            👤 Profile
          </Link>
        </div>
      </Shell>
    );
  }

  if (now < test.startAt) {
    return (
      <Shell>
        <div className="text-5xl">🟡</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-600">পরীক্ষাটি এখনো শুরু হয়নি।</p>
        <p className="mt-1 text-sm font-semibold text-indigo-600">শুরু হবে: {formatDateTime(test.startAt)}</p>
      </Shell>
    );
  }

  if (now > test.endAt) {
    return (
      <Shell>
        <div className="text-5xl">🔴</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-600">এই পরীক্ষার সময়সীমা শেষ হয়ে গেছে।</p>
        <p className="mt-1 text-xs text-slate-400">শেষ হয়েছে: {formatDateTime(test.endAt)}</p>
        <Link
          href={`/model-test/${test.id}/leaderboard`}
          className="mt-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow hover:opacity-90"
        >
          🏆 Leaderboard দেখুন
        </Link>
      </Shell>
    );
  }

  // 👑 প্রিমিয়াম পরীক্ষা: মেয়াদ চলা প্যাকেজ থাকলে ঢুকতে দেওয়া হবে
  if (test.isPaid) {
    const premium = await hasPremium(user.id).catch(() => false);

    if (!premium) {
      return (
        <Shell>
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
          <p className="mt-2 text-sm text-slate-600">এটি একটি প্রিমিয়াম মডেল টেস্ট।</p>
          <p className="mt-1 text-xs text-slate-500">
            একটা প্যাকেজ নিলেই মেয়াদ পর্যন্ত সব প্রিমিয়াম পরীক্ষা দিতে পারবেন।
          </p>
          <div className="mt-6 grid w-full max-w-xs gap-3">
            <Link
              href="/packages"
              className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-white shadow hover:opacity-90"
            >
              👑 প্যাকেজ নিন
            </Link>
            <Link
              href="/model-test"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              ← সব পরীক্ষা
            </Link>
          </div>
        </Shell>
      );
    }
  }

  const questions = Array.isArray(test.questions) ? (test.questions as unknown as ExamQuestion[]) : [];

  return (
    <ModelTestClient
      testId={test.id}
      examTitle={test.title}
      questions={questions}
      minutes={test.minutes}
      defaultName={session.user.name || user.name || ""}
    />
  );
}

// ===== ফাইল শেষ =====
