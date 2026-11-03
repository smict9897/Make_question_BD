import Link from "next/link";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Tests() {
  const tests = await db.practiceTest.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Model tests</h1>
      {tests.length === 0 && <p className="mt-6 text-slate-600">No tests yet.</p>}
      <ul className="mt-6 grid gap-3">{tests.map((t) => (
        <li key={t.id}><Link href={`/tests/${t.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-royal">
          <p className="font-semibold">{t.title}</p><p className="text-sm text-slate-600">{(t.questionIds as string[]).length} questions · {t.minutes} minutes</p></Link></li>))}
      </ul>
    </main>
  );
}
