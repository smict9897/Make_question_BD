"use client";
import { useState, useTransition } from "react";
import { Sparkles, Save } from "lucide-react";
import { generateQuiz, type QuizItem } from "@/app/actions/generate-quiz";
import { saveQuestions } from "@/app/actions/questions";

type Row = QuizItem & { keep: boolean };
const f = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";
export default function AdminAI() {
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function gen(fd: FormData) {
    setMsg(""); setMeta(Object.fromEntries(fd) as Record<string, string>);
    start(async () => {
      const r = await generateQuiz(Object.fromEntries(fd));
      if (r.ok) setRows(r.items.map((x) => ({ ...x, keep: true }))); else setMsg(r.error);
    });
  }
  function save() {
    start(async () => {
      const keep = rows.filter((r) => r.keep).map(({ keep, ...q }) => q);
      const r = await saveQuestions(meta, keep);
      setMsg(r.message); if (r.ok) setRows(rows.filter((x) => !x.keep));
    });
  }
  return (
    <div>
      <form action={gen} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <input name="subject" className={f} placeholder="Subject" required />
        <input name="category" className={f} placeholder="Class / category" required />
        <input name="topic" className={f} placeholder="Topic" required />
        <select name="difficulty" className={f}><option>Easy</option><option>Medium</option><option>Hard</option></select>
        <select name="count" className={f}><option>5</option><option>10</option><option>20</option></select>
        <select name="lang" className={f}><option>Bangla</option><option>English</option></select>
        <button disabled={pending} className="flex items-center justify-center gap-2 rounded-md bg-royal px-4 py-2 text-white disabled:opacity-60 sm:col-span-3">
          <Sparkles size={16} />{pending ? "Working…" : "Generate quiz with AI"}
        </button>
      </form>
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      <div className="mt-6 grid gap-4">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.keep} onChange={(e) => set(i, { keep: e.target.checked })} />Approve question {i + 1}</label>
            
            <textarea className={f} value={r.text || ""} onChange={(e) => set(i, { text: e.target.value })} />
            
            {(["A", "B", "C", "D"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name={`c${i}`} aria-label={`Correct answer ${k}`} checked={r.correct === k} onChange={() => set(i, { correct: k })} />
                <span className="w-4 text-sm">{k}</span>
                
                {/* 🎯 এখানে {} এর জায়গায় { A: "", B: "", C: "", D: "" } দেওয়া হলো */}
                <input className={f} value={r.options?.[k] || ""} onChange={(e) => set(i, { options: { ...(r.options || { A: "", B: "", C: "", D: "" }), [k]: e.target.value } })} />
                
              </div>
            ))}
            
            <textarea className={f} value={r.explanation || ""} onChange={(e) => set(i, { explanation: e.target.value })} />
            
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <button onClick={save} disabled={pending} className="mt-4 flex items-center gap-2 rounded-md bg-hire px-5 py-2.5 font-semibold text-white disabled:opacity-60">
          <Save size={16} />Save approved questions
        </button>
      )}
    </div>
  );
}
