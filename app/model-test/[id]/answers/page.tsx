import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import ModelTestLoginButton from "@/components/model-test-login-button";
import ModelTestAnswerSheet from "@/components/model-test-answer-sheet";
import type { ExamQuestion } from "@/components/LiveExamPlayer";

export const dynamic = "force-dynamic";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function bn(n: number | string) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      {children}
    </div>
  );
}

export default async function ModelTestAnswersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const test = await db.modelTest.findUnique({ where: { id } });
  if (!test || test.status === "DRAFT") notFound();

  const session = await auth();

  if (!session?.user?.email) {
    return (
      <Shell>
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          উত্তরপত্র দেখতে Google দিয়ে লগইন করুন।
        </p>
        <div className="mt-6 w-full max-w-xs">
          <ModelTestLoginButton callbackUrl={`/model-test/${test.id}/answers`} />
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

  const attempt = await db.attempt.findUnique({
    where: { testId_userId: { testId: test.id, userId: user.id } },
  });

  if (!attempt) {
    return (
      <Shell>
        <div className="text-5xl">📭</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          আপনি এখনো এই পরীক্ষা দেননি, তাই উত্তরপত্র নেই।
        </p>
        <Link
          href={`/model-test/${test.id}`}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white"
        >
          পরীক্ষার পেজে যান
        </Link>
      </Shell>
    );
  }

  const rawAnswers = attempt.answers;
  const hasSavedAnswers =
    rawAnswers !== null &&
    typeof rawAnswers === "object" &&
    !Array.isArray(rawAnswers);

  if (!hasSavedAnswers) {
    return (
      <Shell>
        <div className="text-5xl">🗂️</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{test.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          এই পরীক্ষার উত্তরপত্র সংরক্ষিত নেই।
        </p>
        <p className="mt-1 text-xs text-slate-400">
          উত্তরপত্র সংরক্ষণের সুবিধা চালু হওয়ার আগে দেওয়া পরীক্ষাগুলোর উত্তরপত্র দেখা যায় না।
        </p>
        <Link
          href={`/model-test/${test.id}`}
          className="mt-5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
        >
          ← ফিরে যান
        </Link>
      </Shell>
    );
  }

  const answers = rawAnswers as unknown as Record<string, number>;
  const questions = Array.isArray(test.questions)
    ? (test.questions as unknown as ExamQuestion[])
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/model-test/${test.id}`}
        className="inline-block text-sm font-semibold text-indigo-600 hover:underline"
      >
        ← ফলাফলে ফিরে যান
      </Link>

      <div className="mt-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-center text-white shadow">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
          উত্তরপত্র
        </div>
        <h1 className="mt-1 text-xl font-bold">{test.title}</h1>
        <p className="mt-1 text-sm opacity-90">
          প্রাপ্ত নম্বর: {bn(attempt.score)} / {bn(attempt.total)}
        </p>
      </div>

      <div className="mt-4">
        <ModelTestAnswerSheet questions={questions} answers={answers} />
      </div>
    </div>
  );
}
