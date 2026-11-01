import AdminAIGenerator from "@/components/admin-ai-generator";
import Link from "next/link";
import { Users, FileText, Download, Wallet, Sparkles, ListChecks, Mail, Briefcase, Plus } from "lucide-react";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

const COLORS = ["#2563eb", "#f97316", "#16a34a", "#a855f7", "#ec4899"];
const card = "rounded-2xl border border-white/70 bg-white p-4 shadow-sm";

function Donut({ data }: { data: [string, number][] }) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  let acc = 0;
  return (
    <div className="mt-4 flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label="Chart">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        {total > 0 && data.map(([l, v], i) => {
          const p = (v / total) * 100;
          const el = <circle key={l} cx="21" cy="21" r="15.9155" fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="5" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={-acc} />;
          acc += p;
          return el;
        })}
      </svg>
      <ul className="grid flex-1 gap-1.5 text-sm">
        {data.length === 0 && <li className="text-slate-500">No data yet</li>}
        {data.map(([l, v], i) => (
          <li key={l} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{l}</span>
            <span className="font-semibold">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tint }: { label: string; value: string | number; icon: typeof Users; tint: string }) {
  return (
    <div className={`${card} flex items-center gap-4`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon size={22} /></span>
      <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </div>
  );
}

export default async function Admin() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [students, dl, materials, ai, tests, inquiries, jobs, earn, newUsers, byCat, byDiff, recentInq, recentAtt] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.resource.aggregate({ _sum: { downloads: true } }),
    db.resource.count(),
    db.question.count({ where: { source: "AI" } }),
    db.modelTest.count(),
    db.inquiry.count(),
    db.job.count(),
    db.purchase.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.user.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    db.resource.groupBy({ by: ["category"], _count: { _all: true } }),
    db.question.groupBy({ by: ["difficulty"], _count: { _all: true } }),
    db.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.attempt.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const n = newUsers.filter((u) => u.createdAt.getFullYear() === d.getFullYear() && u.createdAt.getMonth() === d.getMonth()).length;
    return { label: d.toLocaleString("en-US", { month: "short" }), n };
  });
  const max = Math.max(1, ...months.map((m) => m.n));

  return (
    <div className="grid gap-4">
      
      {/* 🎯 এখানে এআই জেনারেটর বক্সটি যুক্ত করা হলো */}
      <AdminAIGenerator />
      
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Overview</h1><p className="text-sm text-slate-500">{now.toLocaleDateString("en-GB", { dateStyle: "full" })}</p></div>
        <Link href="/admin/pdf" className="inline-flex items-center gap-2 rounded-xl bg-hire px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />Add material</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Students" value={students} icon={Users} tint="bg-blue-100 text-royal" />
        <Stat label="Materials" value={materials} icon={FileText} tint="bg-orange-100 text-hire" />
        <Stat label="Downloads" value={dl._sum.downloads ?? 0} icon={Download} tint="bg-green-100 text-green-600" />
        <Stat label="Earnings (৳)" value={earn._sum.amount ?? 0} icon={Wallet} tint="bg-purple-100 text-purple-600" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="AI questions" value={ai} icon={Sparkles} tint="bg-blue-100 text-royal" />
        <Stat label="Model tests" value={model-test} icon={ListChecks} tint="bg-green-100 text-green-600" />
        <Stat label="Inquiries" value={inquiries} icon={Mail} tint="bg-orange-100 text-hire" />
        <Stat label="Job circulars" value={jobs} icon={Briefcase} tint="bg-purple-100 text-purple-600" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <section className={`${card} xl:col-span-2`}>
          <h2 className="font-semibold">New students, last 6 months</h2>
          <div className="mt-4 flex h-44 items-stretch gap-3">
            {months.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-lg bg-gradient-to-t from-royal to-blue-300" style={{ height: `${Math.max(4, (m.n / max) * 100)}%` }} title={`${m.n}`} /></div>
                <span className="text-xs font-semibold">{m.n}</span><span className="text-xs text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={card}><h2 className="font-semibold">Materials by category</h2><Donut data={byCat.map((c) => [c.category, c._count._all])} /></section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <section className={card}><h2 className="font-semibold">Questions by difficulty</h2><Donut data={byDiff.map((d) => [d.difficulty, d._count._all])} /></section>
        <section className={card}>
          <h2 className="font-semibold">Recent inquiries</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {recentInq.length === 0 && <li className="text-slate-500">No inquiries yet</li>}
            {recentInq.map((i) => <li key={i.id} className="rounded-xl bg-slate-50 p-3"><p className="font-medium">{i.name}</p><p className="truncate text-slate-500">{i.message}</p></li>)}
          </ul>
          <Link href="/admin/inquiries" className="mt-3 inline-block text-sm font-medium text-royal">View all</Link>
        </section>
        <section className={card}>
          <h2 className="font-semibold">Recent test results</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {recentAtt.length === 0 && <li className="text-slate-500">No attempts yet</li>}
            {recentAtt.map((a) => <li key={a.id} className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{a.userName}</span><span className="font-semibold">{a.score}/{a.total}</span></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
