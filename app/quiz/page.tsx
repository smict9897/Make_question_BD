import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Zap, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import QuizBox from "@/components/quiz-box";
import Practice, { type Q } from "@/components/practice";

export const metadata: Metadata = {
  title: "প্রশ্নপত্র তৈরি করুন",
  description:
    "ক্লাস, বিষয় ও অধ্যায় বেছে এক ক্লিকে AI দিয়ে প্রশ্ন তৈরি করুন, প্রশ্ন ব্যাংক থেকে প্রশ্নপত্র বানান আর PDF নামান। বিনামূল্যে কুইজ প্র্যাকটিসও করুন।",
  alternates: { canonical: "/quiz" },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function QuizPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const role = (await auth())?.user?.role ?? null;
  const [rows, grouped] = await Promise.all([
    // শুধু MCQ (যে প্রশ্নের সঠিক উত্তর আছে) প্র্যাকটিসে আসবে; CQ/SQ বাদ
    db.question
      .findMany({
        where: { approved: true, correct: { not: "" }, ...(subject ? { subject } : {}) },
        take: 50,
      })
      .catch(() => []),
    db.question.groupBy({ by: ["category", "subject", "topic"], where: { approved: true } }).catch(() => []),
  ]);
  const triples = grouped.map((r) => ({ category: r.category ?? "", subject: r.subject ?? "", topic: r.topic ?? "" }));
  const qs: Q[] = rows
    .filter((r) => !!(r.correct && r.correct.trim()))
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map((r) => ({ id: r.id, text: r.text, options: r.options as Record<string, string>, correct: r.correct, explanation: r.explanation }));
  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-2">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
        <Link
          href="/question-builder"
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-lg"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <ListChecks size={26} />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold">দেখে প্রশ্ন তৈরি করুন</span>
            <span className="block text-sm text-white/90">প্রশ্ন ব্যাংক থেকে নিজে দেখে বাছাই করে প্রশ্নপত্র বানান</span>
          </span>
          <ArrowRight size={22} />
        </Link>
        <a
          href="#ai"
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Zap size={26} />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold">Live Online Exam</span>
            <span className="block text-sm text-white/90">ক্লাস, বিষয় ও অধ্যায় দিন, AI প্রশ্ন বানিয়ে দেবে</span>
          </span>
          <ArrowRight size={22} />
        </a>
      </div>
      <section id="ai" className="scroll-mt-24">
        <h1 className="mb-4 text-2xl font-bold"> Live Online Exam(AI)</h1>
        <QuizBox triples={triples} role={role} />
      </section>
      <section><h2 className="mb-4 text-2xl font-bold">Practice from the question bank</h2>
        {qs.length ? <Practice qs={qs} /> : <p className="text-slate-600">No approved questions yet.</p>}</section>
    </main>
  );
}

// ===== ফাইল শেষ =====
