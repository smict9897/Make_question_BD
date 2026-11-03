"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Printer, Shuffle, Wand2 } from "lucide-react";
import MathText from "@/components/MathText";

type Item = {
  id: string; 
  text: string; 
  options?: any; 
  correct?: string;
  explanation?: string; 
  category?: string; 
  subject?: string; 
  topic?: string; 
  source?: string;
  type?: string; 
  stimulus?: string;
  subQuestions?: { k: string; kh: string; g: string; gh: string };
};

const LABELS = {
  bn: ["ক", "খ", "গ", "ঘ"],
  abc: ["a", "b", "c", "d"],
  num: ["১", "২", "৩", "৪"],
  roman: ["i", "ii", "iii", "iv"],
} as const;
type LabelKey = keyof typeof LABELS;

const TOGGLES: [string, string][] = [
  ["title", "টাইটেল"], ["address", "ঠিকানা"], ["cls", "ক্লাসের নাম"], ["subject", "বিষয়ের নাম"],
  ["chapter", "অধ্যায়ের নাম"], ["instr", "নির্দেশনা"], ["examinee", "পরীক্ষার্থীর তথ্য"],
  ["tags", "প্রশ্নের ট্যাগ"], ["marks", "প্রশ্নের মার্ক"], ["omr", "OMR যুক্ত"],
  ["divider", "কলাম ডিভাইডার"], ["subjCode", "বিষয় কোড"], ["obtained", "প্রাপ্ত নম্বর ঘর"],
  ["setCode", "সেট কোড"],
];

const DEF_SHOW: Record<string, boolean> = {
  title: true, address: false, cls: true, subject: true, chapter: true, instr: true,
  examinee: false, tags: false, marks: false, omr: false, divider: true,
  subjCode: false, obtained: false, setCode: true,
};
const DEF_INFO = {
  inst: "", address: "", exam: "", minutes: "", marks: "", code: "",
  instr: "সঠিক উত্তরের বৃত্তটি বল পয়েন্ট কলম দিয়ে ভরাট করো। কাটাকাটি করা যাবে না।",
};
const DEF_CFG = { format: "qa", cols: 2, style: "circle", label: "bn" as LabelKey, optCols: 2, ansKey: false };

const STORE = "qb:selected";
const SETTINGS = "qb:settings";

function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function shuffle<T>(arr: T[], seed: number): T[] {
  if (!seed) return arr;
  const r = rng(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 🎯 সৃজনশীল প্রশ্নের অংশ ও নম্বর
// ঘ খালি থাকলে (গণিত): ক-২, খ-৪, গ-৪
// ঘ থাকলে (অন্য বিষয়): ক-১, খ-২, গ-৩, ঘ-৪
function cqParts(sq?: Item["subQuestions"]): { label: string; text: string; mark: string }[] {
  if (!sq) return [];
  const k = (sq.k || "").trim();
  const kh = (sq.kh || "").trim();
  const g = (sq.g || "").trim();
  const gh = (sq.gh || "").trim();
  const three = !gh;
  const marks = three
    ? { ক: "২", খ: "৪", গ: "৪", ঘ: "" }
    : { ক: "১", খ: "২", গ: "৩", ঘ: "৪" };
  const all = [
    { label: "ক", text: k, mark: marks["ক"] },
    { label: "খ", text: kh, mark: marks["খ"] },
    { label: "গ", text: g, mark: marks["গ"] },
    { label: "ঘ", text: gh, mark: marks["ঘ"] },
  ];
  return all.filter((p) => p.text);
}

const printCss = `
@page { size: A4; margin: 12mm; }
@media print {
  header, footer, nav, .fixed, [data-noprint] { display: none !important; }
  body { background: #fff !important; }
  .katex { font-size: 1.05em !important; }
}`;

export default function QbBuilder() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(DEF_SHOW);
  const [info, setInfo] = useState(DEF_INFO);
  const [cfg, setCfg] = useState(DEF_CFG);
  const [setName, setSetName] = useState<"ক" | "খ">("ক");
  const [seed, setSeed] = useState(0);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.show) setShow({ ...DEF_SHOW, ...o.show });
        if (o.info) setInfo({ ...DEF_INFO, ...o.info });
        if (o.cfg) setCfg({ ...DEF_CFG, ...o.cfg });
      }
    } catch {}
    setReady(true);

    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch {}
    if (!ids.length) { setLoading(false); return; }
    fetch("/api/qb/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(SETTINGS, JSON.stringify({ show, info, cfg })); } catch {}
  }, [show, info, cfg, ready]);

  // 🎯 ৩ ধরনের প্রশ্ন আলাদা করা
  const mcqs = useMemo(() => items.filter(q => q.type === "MCQ" || (!q.type && q.options)), [items]);
  const sqs = useMemo(() => items.filter(q => q.type === "SHORT"), [items]);
  const cqs = useMemo(() => items.filter(q => q.type === "CQ" || (!q.type && q.stimulus)), [items]);

  const viewMcqs = useMemo(() => {
    const base = seed ? seed + (setName === "খ" ? 7919 : 0) : setName === "খ" ? 7919 : 0;
    return shuffle(mcqs, base).map((q, i) => {
      let entries: [string, string][] = [];
      if (q.options && typeof q.options === "object") {
        // 🎯 টাইপ কাস্টিং ঠিক করা হলো
        entries = (Object.entries(q.options) as [string, string][]).sort(([a], [b]) => a.localeCompare(b));
      }
      const opts = shuffle(entries, base ? base + i + 1 : 0);
      return { q, opts: opts.map(([, v]) => v), ci: opts.findIndex(([k]) => k === q.correct) };
    });
  }, [mcqs, seed, setName]);

  const viewSqs = useMemo(() => shuffle(sqs, seed), [sqs, seed]);
  const viewCqs = useMemo(() => shuffle(cqs, seed), [cqs, seed]);

  const uniq = (f: (q: Item) => string) => Array.from(new Set(items.map(f).filter(Boolean))).join(", ");

  const L = LABELS[cfg.label];
  const marked = cfg.format === "qa" || cfg.format === "sug";
  const input = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
  const chip = (on: boolean) => `rounded-lg border px-3 py-1.5 text-sm ${on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`;

  function tag(i: number, correct: boolean) {
    const l = L[i];
    if (cfg.style === "circle")
      return (
        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black text-[11px] ${marked && correct ? "bg-black text-white" : ""}`}>
          {l}
        </span>
      );
    const t = cfg.style === "paren" ? `(${l})` : cfg.style === "close" ? `${l})` : `${l}.`;
    return <span className={`shrink-0 ${marked && correct ? "font-bold underline" : ""}`}>{t}</span>;
  }

  if (loading) return <p className="py-10 text-center">লোড হচ্ছে...</p>;
  if (!items.length)
    return (
      <div className="py-10 text-center">
        <p>কোনো প্রশ্ন নির্বাচন করা হয়নি।</p>
        <Link href="/question-builder" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white">প্রশ্ন বাছাই করুন</Link>
      </div>
    );

  const showKey = viewMcqs.length > 0 && (cfg.format === "ans" || cfg.ansKey);
  const keyOnNewPage = cfg.format !== "ans";

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <style>{printCss}</style>

      {/* সাইডবার সেটিংস */}
      <aside data-noprint className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white">
            <Printer size={16} /> প্রিন্ট / PDF
          </button>
          <Link href="/question-builder" className="rounded-lg border px-3 py-2">+ আরও প্রশ্ন যোগ</Link>
        </div>

        <details open className="rounded-xl border bg-white p-3">
          <summary className="cursor-pointer font-semibold">বেসিক সেটিংস</summary>
          <p className="mt-2 text-xs text-slate-500">ফাইল ফরম্যাট</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[["qa", "প্রশ্ন ও উত্তর"], ["q", "প্রশ্ন"], ["ans", "উত্তরপত্র"], ["sug", "সাজেশন"]].map(([k, l]) => (
              <button key={k} className={chip(cfg.format === k)} onClick={() => setCfg({ ...cfg, format: k })}>{l}</button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={cfg.ansKey} onChange={(e) => setCfg({ ...cfg, ansKey: e.target.checked })} /> উত্তরপত্র সাথে দিন (আলাদা পাতায়)
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(["ক", "খ"] as const).map((n) => (
              <button key={n} className={chip(setName === n)} onClick={() => setSetName(n)}>সেট {n}</button>
            ))}
            <button className={chip(false) + " flex items-center gap-1"} onClick={() => setSeed(Math.floor(Math.random() * 1e6) + 1)}>
              <Shuffle size={14} /> এলোমেলো
            </button>
            {seed > 0 && <button className={chip(false)} onClick={() => setSeed(0)}>রিসেট</button>}
          </div>
        </details>

        <details className="rounded-xl border bg-white p-3">
          <summary className="cursor-pointer font-semibold">Page Setup</summary>
          <div className="mt-2 space-y-2">
            <input className={input} placeholder="প্রতিষ্ঠানের নাম" value={info.inst} onChange={(e) => setInfo({ ...info, inst: e.target.value })} />
            <input className={input} placeholder="পরীক্ষার নাম (যেমন: এসএসসি - ২০২৬)" value={info.exam} onChange={(e) => setInfo({ ...info, exam: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="সময় (মিনিট)" value={info.minutes} onChange={(e) => setInfo({ ...info, minutes: e.target.value })} />
              <input className={input} placeholder="পূর্ণমান" value={info.marks} onChange={(e) => setInfo({ ...info, marks: e.target.value })} />
            </div>
            <textarea className={input} rows={2} placeholder="নির্দেশনা" value={info.instr} onChange={(e) => setInfo({ ...info, instr: e.target.value })} />
          </div>
        </details>

        <details className="rounded-xl border bg-white p-3">
          <summary className="cursor-pointer font-semibold">কন্টেন্ট ডিসপ্লে</summary>
          <div className="mt-2 grid gap-1.5">
            {TOGGLES.map(([k, l]) => (
              <label key={k} className="flex items-center justify-between">
                {l}
                <input type="checkbox" checked={!!show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />
              </label>
            ))}
          </div>
        </details>

        <details className="rounded-xl border bg-white p-3">
          <summary className="cursor-pointer font-semibold">ফরম্যাটিং</summary>
          <p className="mt-2 text-xs text-slate-500">MCQ অপশন স্টাইল</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[["circle", "গোল"], ["dot", "ক."], ["paren", "(ক)"], ["close", "ক)"]].map(([k, l]) => (
              <button key={k} className={chip(cfg.style === k)} onClick={() => setCfg({ ...cfg, style: k })}>{l}</button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">MCQ অপশন কলাম</p>
          <div className="mt-1 flex gap-1.5">
            {[1, 2, 3, 4].map((n) => <button key={n} className={chip(cfg.optCols === n)} onClick={() => setCfg({ ...cfg, optCols: n })}>{n}</button>)}
          </div>
        </details>
      </aside>

      {/* মূল প্রশ্নপত্র (প্রিভিউ) */}
      <section className="overflow-x-auto">
        <div id="paper" className="mx-auto w-full max-w-[820px] bg-white p-6 text-black shadow print:max-w-none print:p-0 print:shadow-none font-sans">
          
          {/* হেডার */}
          <div className="text-center border-b-2 border-black pb-2 mb-4">
            {show.title && <h2 className="text-lg font-bold" contentEditable={edit} suppressContentEditableWarning>{info.inst || "প্রতিষ্ঠানের নাম"}</h2>}
            {info.exam && <p className="text-sm font-semibold">{info.exam}</p>}
            <div className="flex justify-between text-xs mt-1">
              <span>{show.cls && uniq((q) => q.category || "")}</span>
              <span>বিষয়: {uniq((q) => q.subject || "")}</span>
              <span>সময়: {info.minutes || "..."} মিনিট</span>
              <span>পূর্ণমান: {info.marks || "..."}</span>
            </div>
          </div>

          {show.instr && info.instr && <p className="mb-3 text-[11px] italic">{info.instr}</p>}

          {/* 🎯 ক-বিভাগ: বহুনির্বাচনি (MCQ) */}
          {cfg.format !== "ans" && viewMcqs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-center font-bold text-sm border-b border-black inline-block mx-auto mb-2">ক-বিভাগ: বহুনির্বাচনি প্রশ্ন</h3>
              <div style={{ columnCount: cfg.cols, columnGap: "20px" }}>
                {viewMcqs.map(({ q, opts, ci }, i) => (
                  <div key={q.id} style={{ breakInside: "avoid" }} className="mb-3 text-[13px] leading-snug">
                    <p contentEditable={edit} suppressContentEditableWarning>
                      <b>{i + 1}.</b> {edit ? q.text : <MathText text={q.text} />}
                    </p>
                    {opts.length > 0 && (
                      <div className="mt-1 grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: `repeat(${cfg.optCols}, minmax(0, 1fr))` }}>
                        {opts.map((o, k) => (
                          <p key={k} className="flex items-start gap-1.5">
                            {tag(k, k === ci)}
                            <span contentEditable={edit} suppressContentEditableWarning>{edit ? o : <MathText text={o} />}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🎯 খ-বিভাগ: সংক্ষিপ্ত প্রশ্ন (SQ) */}
          {cfg.format !== "ans" && viewSqs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-center font-bold text-sm border-b border-black inline-block mx-auto mb-2">খ-বিভাগ: সংক্ষিপ্ত প্রশ্ন</h3>
              <div style={{ columnCount: cfg.cols, columnGap: "20px" }}>
                {viewSqs.map((q, i) => (
                  <div key={q.id} style={{ breakInside: "avoid" }} className="mb-2 text-[13px] leading-snug flex gap-1">
                    <b>{i + 1}.</b> <span contentEditable={edit} suppressContentEditableWarning>{edit ? q.text : <MathText text={q.text} />}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🎯 গ-বিভাগ: সৃজনশীল প্রশ্ন (CQ) */}
          {cfg.format !== "ans" && viewCqs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-center font-bold text-sm border-b border-black inline-block mx-auto mb-2">গ-বিভাগ: সৃজনশীল প্রশ্ন</h3>
              <div className="space-y-4">
                {viewCqs.map((q, i) => {
                  const parts = cqParts(q.subQuestions);
                  return (
                    <div key={q.id} className="text-[13px] leading-snug border-b border-dashed border-gray-300 pb-2">
                      <b>{i + 1}.</b> <span contentEditable={edit} suppressContentEditableWarning><MathText text={q.stimulus || q.text || ""} /></span>
                      {parts.length > 0 && (
                        <div className="mt-1 grid grid-cols-1 gap-1 pl-2">
                          {parts.map((p) => (
                            <p key={p.label} className="flex items-start justify-between gap-2">
                              <span>
                                <b>({p.label})</b> <MathText text={p.text} />
                              </span>
                              {p.mark && <span className="shrink-0 whitespace-nowrap font-semibold">[{p.mark}]</span>}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* উত্তরমালা */}
          {showKey && (
            <div className="mt-4 border-t border-black pt-2" style={keyOnNewPage ? { breakBefore: "page", pageBreakBefore: "always" } : undefined}>
              <p className="text-sm font-bold">উত্তরমালা (ক-বিভাগ): সেট {setName}</p>
              <div className="mt-1 grid grid-cols-5 gap-x-3 gap-y-0.5 text-xs">
                {viewMcqs.map((v, i) => v.ci >= 0 && <span key={i}>{i + 1}. {L[v.ci]}</span>)}
              </div>
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

// ===== ফাইল শেষ =====
