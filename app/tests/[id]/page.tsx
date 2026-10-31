import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import TestRunner from "@/components/test-runner";
export const dynamic = "force-dynamic";
export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.practiceTest.findUnique({ where: { id } });
  if (!t) notFound();
  const rows = await db.question.findMany({ where: { id: { in: t.questionIds as string[] } } });
  const qs = rows.map((r) => ({ id: r.id, text: r.text, options: r.options as Record<string, string> })); // correct answers never reach the browser
  const top = await db.practiceAttempt.findMany({ where: { testId: id }, orderBy: [{ score: "desc" }, { createdAt: "asc" }], take: 10 });
  const user = (await auth())?.user;
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_280px]">
      <section>
        <h1 className="mb-4 text-2xl font-bold">{t.title}</h1>
        {user ? <TestRunner testId={id} minutes={t.minutes} qs={qs} /> : <p>Please <Link className="text-royal underline" href="/login">log in</Link> to take this test.</p>}
      </section>
      <aside><h2 className="mb-3 font-bold">Leaderboard</h2>
        {top.length === 0 ? <p className="text-sm text-slate-600">No attempts yet.</p> :
          <ol className="grid gap-2 text-sm">{top.map((x, i) => <li key={x.id} className="flex justify-between rounded-md bg-white p-2"><span>{i + 1}. {x.userName}</span><span>{x.score}/{x.total}</span></li>)}</ol>}
      </aside>
    </main>
  );
}
