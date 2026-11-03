import { db } from "@/lib/db";
import { createTest } from "@/app/actions/tests";
import { deleteTest } from "@/app/actions/admin";
export const dynamic = "force-dynamic";
const f = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2";

export default async function Page() {
  const tests = await db.practiceTest.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { attempts: true } } } });
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold">Create model test</h1>
        <p className="mb-4 text-sm text-slate-600">Questions are picked at random from approved questions of the subject.</p>
        <form action={createTest} className="grid gap-3">
          <input name="title" required className={f} placeholder="Test title" />
          <input name="subject" required className={f} placeholder="Subject (same spelling as saved questions)" />
          <input name="count" type="number" min={5} max={100} defaultValue={20} className={f} aria-label="Number of questions" />
          <input name="minutes" type="number" min={1} defaultValue={20} className={f} aria-label="Minutes" />
          <button className="rounded-xl bg-royal px-4 py-2.5 font-semibold text-white">Create test</button>
        </form>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Existing tests</h2>
        {tests.length === 0 && <p className="text-sm text-slate-600">No tests yet.</p>}
        <ul className="grid gap-2">
          {tests.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{t.title} <span className="text-xs text-slate-500">· {t.minutes} min · {t._count.attempts} attempts</span></span>
              <form action={deleteTest.bind(null, t.id)}><button className="rounded-lg border border-red-300 px-3 py-1 text-red-700">Delete</button></form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
