"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2, LogIn, Sparkles, Square, X } from "lucide-react";
import { generateQuiz, saveQuizToBank, type QuizItem } from "@/app/actions/generate-quiz";
import { NCTB_CLASSES, type NctbClass } from "../lib/nctb-data";

type Triple = { category: string; subject: string; topic: string };
type Meta = { subject: string; category: string; topic: string; difficulty: "Easy" | "Medium" | "Hard"; lang: "Bangla" | "English"; type?: "MCQ" | "SHORT" | "CQ" | "MIXED" };

const BASE_CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "SSC", "HSC", "Admission", "Job"];
const OTHER = "__other__";
const BN = ["ক", "খ", "গ", "ঘ"];
const DRAFT = "qb:draft";
const PREVIEW = 30;
const MAX_PAPER = 50;
const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const classLabel = (v: string) => {
  if (/^\d+$/.test(v)) return `ক্লাস ${v}`;
  if (v === "SSC") return "SSC (নবম-দশম)";
  if (v === "HSC") return "HSC (একাদশ-দ্বাদশ)";
  return v;
};
const f = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2";

// 🎯 lib/nctb-data.ts থেকে ক্লাস খুঁজে বের করা
function findClassData(key: string): NctbClass | undefined {
  if (!key) return undefined;
  if (["6", "7", "8"].includes(key)) {
    return NCTB_CLASSES.find((c) => c.class === `Class ${key}`);
  }
  if (key === "SSC") {
    return NCTB_CLASSES.find((c) => /9|10|SSC/i.test(c.class));
  }
  if (key === "HSC") {
    return NCTB_CLASSES.find((c) => /11|12|HSC/i.test(c.class));
  }
  return undefined;
}

function countOptions(role: string | null): number[] {
  if (role === "ADMIN") return [20, 25, 30, 50, 100, 200, 300, 500, 1000];
  if (role === "TEACHER") return [20, 25, 30];
  return [5, 10];
}

export default function QuizBox({ triples = [], role = null }: { triples?: Triple[]; role?: string | null }) {
  const router = useRouter();
  const classes = useMemo(() => uniq([...BASE_CLASSES, ...triples.map((t) => t.category)]), [triples]);
  const opts = countOptions(role);

  const [cat, setCat] = useState("");
  const [subjSel, setSubjSel] = useState("");
  const [subjOther, setSubjOther] = useState("");

  // 🎯 ইউনিট/ক্যাটাগরি (subCategories থাকলে) + নির্দিষ্ট অধ্যায়
  const [topCatSel, setTopCatSel] = useState("");
  const [topSel, setTopSel] = useState("");
  const [topOther, setTopOther] = useState("");

  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [count, setCount] = useState<number>(opts[0]);
  const [lang, setLang] = useState<"Bangla" | "English">("Bangla");

  const [qType, setQType] = useState<"MCQ" | "SHORT" | "CQ" | "MIXED">("MCQ");

  const [items, setItems] = useState<QuizItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [savedIds, setSavedIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const stopRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.items) && d.items.length > 0 && d.meta) {
        setItems(d.items);
        setMeta(d.meta);
      }
    } catch {}
  }, []);

  const selectedClassData = useMemo(() => findClassData(cat), [cat]);

  const curriculumSubjects = useMemo(
    () => (selectedClassData ? selectedClassData.subjects.map((s) => s.name) : []),
    [selectedClassData]
  );
  const dbSubjects = useMemo(
    () => uniq(triples.filter((t) => t.category === cat).map((t) => t.subject)),
    [triples, cat],
  );
  const subjects = useMemo(() => uniq([...curriculumSubjects, ...dbSubjects]), [curriculumSubjects, dbSubjects]);

  const subjIsOther = subjSel === OTHER || (cat !== "" && subjects.length === 0);
  const subject = subjIsOther ? subjOther.trim() : subjSel;

  // 🎯 নির্বাচিত সাবজেক্টের পুরো ডেটা (chapters/subCategories সহ)
  const currentSubjectData = useMemo(
    () => selectedClassData?.subjects.find((s) => s.name === subjSel),
    [selectedClassData, subjSel]
  );

  const flatChapters = useMemo(() => currentSubjectData?.chapters ?? [], [currentSubjectData]);
  const groupedTopics = useMemo(() => currentSubjectData?.subCategories ?? [], [currentSubjectData]);
  const hasGroups = groupedTopics.length > 0;

  const dbTopics = useMemo(
    () => (subjIsOther ? [] : uniq(triples.filter((t) => t.category === cat && t.subject === subjSel).map((t) => t.topic))),
    [triples, cat, subjSel, subjIsOther],
  );

  // flat কেসে (subCategories না থাকলে) curriculum chapters + db topics মার্জ করা
  const flatTopicsMerged = useMemo(() => uniq([...flatChapters, ...dbTopics]), [flatChapters, dbTopics]);

  const topicsInSelectedCategory = useMemo(() => {
    if (!topCatSel) return [];
    const grp = groupedTopics.find((g) => g.category === topCatSel);
    return grp?.topics ?? [];
  }, [groupedTopics, topCatSel]);

  // 🎯 ড্রপডাউনে দেখানোর জন্য চূড়ান্ত তালিকা
  const chapterOptions = hasGroups ? topicsInSelectedCategory : flatTopicsMerged;

  const topIsOther =
    topSel === OTHER || (subject !== "" && chapterOptions.length === 0 && (!hasGroups || !!topCatSel));
  const topic = topIsOther ? topOther.trim() : topSel;

  async function generate() {
    setError("");
    setLoginMsg("");
    setSavedIds(null);
    setPicked({});
    setItems([]);
    try {
      localStorage.removeItem(DRAFT);
    } catch {}
    if (!cat || !subject || !topic) {
      setError("ক্লাস, বিষয় ও অধ্যায় তিনটিই দিন।");
      return;
    }

    const m: Meta = { subject, category: cat, topic, difficulty, lang, type: qType };
    setMeta(m);
    stopRef.current = false;
    setLoading(true);

    // 🎯 প্রশ্নের ধরন অনুযায়ী ব্যাচ সাইজ পরিবর্তন (টাইমআউট এড়াতে)
    let currentBatch = 10;
    if (qType === "CQ") currentBatch = 2;
    else if (qType === "SHORT") currentBatch = 5;
    else if (qType === "MIXED") currentBatch = 3;

    const all: QuizItem[] = [];
    const ids: string[] = [];
    let fails = 0;
    let lastErr = "";
    let stopped = false;
    let err = "";

    try {
      while (all.length < count && !stopRef.current && fails < 3) {
        const need = Math.min(currentBatch, count - all.length);
        const r = await generateQuiz({ ...m, count: need, avoid: all.slice(-40).map((q) => (q.text || q.stimulus || "").slice(0, 80)) });
        if (!r.ok) {
          fails++;
          lastErr = r.error;
          continue;
        }
        const seen = new Set(all.map((q) => norm(q.text || q.stimulus || "")));
        const fresh = r.items.filter((q) => !seen.has(norm(q.text || q.stimulus || ""))).slice(0, need);
        if (!fresh.length) {
          fails++;
          continue;
        }
        const s = await saveQuizToBank({ ...m, items: fresh });
        if (!s.ok) {
          all.push(...fresh);
          setItems([...all]);
          stopped = true;
          if (s.error.includes("লগইন")) {
            setLoginMsg(s.error);
            if (ids.length === 0 && all.length <= MAX_PAPER) {
              try {
                localStorage.setItem(DRAFT, JSON.stringify({ items: all, meta: m }));
              } catch {}
            }
          } else {
            err = s.error;
          }
          break;
        }
        ids.push(...s.ids);
        all.push(...fresh);
        setItems([...all]);
      }
    } catch {
      err = "প্রশ্ন তৈরি হয়নি। আবার চেষ্টা করুন।";
    }

    if (ids.length > 0) setSavedIds(ids);
    if (!err && !stopped && !stopRef.current && all.length < count) err = lastErr || "কিছু প্রশ্ন তৈরি হয়নি।";
    if (err) setError(all.length ? `${err} (এ পর্যন্ত ${all.length} টি প্রশ্ন তৈরি হয়েছে)` : err);
    setLoading(false);
  }

  async function makePaper() {
    if (!meta || !items.length) return;
    setError("");
    let ids = savedIds ?? [];
    const rest = items.slice(ids.length);
    if (rest.length) {
      setSaving(true);
      try {
        const r = await saveQuizToBank({ ...meta, items: rest });
        if (!r.ok) {
          setSaving(false);
          if (r.error.includes("লগইন")) setLoginMsg(r.error);
          else setError(r.error);
          return;
        }
        ids = [...ids, ...r.ids];
        setSavedIds(ids);
      } catch {
        setError("সেভ হয়নি। আবার চেষ্টা করুন।");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    try {
      localStorage.setItem("qb:selected", JSON.stringify(ids));
      localStorage.removeItem(DRAFT);
    } catch {}
    router.push("/question-builder/build");
  }

  const allSaved = !!savedIds && savedIds.length === items.length && items.length > 0;

  return (
    <div>
      {loginMsg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLoginMsg("")}
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLoginMsg("")}
              aria-label="বন্ধ করুন"
              className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <LogIn size={24} />
            </span>
            <h3 className="mt-3 text-lg font-bold text-slate-900">লগইন করুন</h3>
            <p className="mt-2 text-sm text-slate-600">{loginMsg}</p>
            <p className="mt-1 text-xs text-slate-500">আপনার তৈরি করা প্রশ্নগুলো সংরক্ষিত থাকবে।</p>
            <div className="mt-5 grid gap-2">
              <Link
                href={`/login?next=${encodeURIComponent("/quiz")}`}
                className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white"
              >
                লগইন করুন
              </Link>
              <button
                type="button"
                onClick={() => setLoginMsg("")}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700"
              >
                এখন না
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) void generate();
        }}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="grid gap-1 text-sm font-medium">
          <span>ক্লাস</span>
          <select
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              setSubjSel("");
              setSubjOther("");
              setTopCatSel("");
              setTopSel("");
              setTopOther("");
            }}
            className={f}
          >
            <option value="">ক্লাস বাছুন</option>
            {classes.map((c) => (
              <option key={c} value={c}>{classLabel(c)}</option>
            ))}
          </select>
        </label>

        <div className="grid gap-1 text-sm font-medium">
          <span>বিষয়</span>
          {!cat ? (
            <select disabled className={f}><option>আগে ক্লাস বাছুন</option></select>
          ) : (
            <>
              {subjects.length > 0 && (
                <select
                  value={subjSel}
                  onChange={(e) => {
                    setSubjSel(e.target.value);
                    setSubjOther("");
                    setTopCatSel("");
                    setTopSel("");
                    setTopOther("");
                  }}
                  className={f}
                >
                  <option value="">বিষয় বাছুন</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value={OTHER}>অন্য (নিজে লিখুন)</option>
                </select>
              )}
              {subjIsOther && (
                <input value={subjOther} onChange={(e) => setSubjOther(e.target.value)} placeholder="বিষয়ের নাম লিখুন" className={f} />
              )}
            </>
          )}
        </div>

        {/* 🎯 ইউনিট/ক্যাটাগরি (শুধু subCategories থাকলে দেখাবে) */}
        {subject && hasGroups && (
          <label className="grid gap-1 text-sm font-medium">
            <span>ইউনিট/ক্যাটাগরি</span>
            <select
              value={topCatSel}
              onChange={(e) => {
                setTopCatSel(e.target.value);
                setTopSel("");
                setTopOther("");
              }}
              className={f}
            >
              <option value="">ইউনিট/ক্যাটাগরি বাছুন</option>
              {groupedTopics.map((g) => (
                <option key={g.category} value={g.category}>{g.category}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-1 text-sm font-medium">
          <span>অধ্যায়</span>
          {!subject ? (
            <select disabled className={f}><option>আগে বিষয় দিন</option></select>
          ) : hasGroups && !topCatSel ? (
            <select disabled className={f}><option>আগে ইউনিট/ক্যাটাগরি বাছুন</option></select>
          ) : (
            <>
              {chapterOptions.length > 0 && (
                <select
                  value={topSel}
                  onChange={(e) => {
                    setTopSel(e.target.value);
                    setTopOther("");
                  }}
                  className={f}
                >
                  <option value="">অধ্যায় বাছুন</option>
                  {chapterOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value={OTHER}>অন্য (নিজে লিখুন)</option>
                </select>
              )}
              {topIsOther && (
                <input value={topOther} onChange={(e) => setTopOther(e.target.value)} placeholder="অধ্যায়ের নাম লিখুন" className={f} />
              )}
            </>
          )}
        </div>

        <label className="grid gap-1 text-sm font-medium">
          <span>প্রশ্নের ধরন</span>
          <select value={qType} onChange={(e) => setQType(e.target.value as any)} className={f} disabled={loading}>
            <option value="MCQ">📝 শুধু MCQ (বহুনির্বাচনি)</option>
            <option value="SHORT">✍️ শুধু সংক্ষিপ্ত প্রশ্ন</option>
            <option value="CQ">🧠 শুধু সৃজনশীল প্রশ্ন</option>
            <option value="MIXED">🎲 মিক্স (MCQ + সংক্ষিপ্ত + সৃজনশীল)</option>
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1 text-sm font-medium">
            <span>কঠিনতা</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")} className={f}>
              <option value="Easy">সহজ</option>
              <option value="Medium">মাঝারি</option>
              <option value="Hard">কঠিন</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <span>প্রশ্ন সংখ্যা</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={f} disabled={loading}>
              {opts.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <span>ভাষা</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as "Bangla" | "English")} className={f}>
              <option value="Bangla">বাংলা</option>
              <option value="English">English</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {loading ? `প্রশ্ন তৈরি হচ্ছে… (${items.length}/${count})` : "এক ক্লিকে প্রশ্ন তৈরি করুন"}
        </button>

        {loading && (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, Math.round((items.length / count) * 100))}%` }} />
            </div>
            <p className="text-xs text-slate-500">
              {role === "ADMIN" || role === "TEACHER"
                ? "প্রতিটি ভাগ তৈরি হওয়ার সাথে সাথে প্রশ্ন ব্যাংকে সেভ হচ্ছে। পেজ খোলা রাখুন, ফোনের স্ক্রিন বন্ধ করবেন না।"
                : "প্রশ্ন তৈরি হচ্ছে, একটু অপেক্ষা করুন।"}
            </p>
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600"
            >
              <Square size={14} /> থামান
            </button>
          </>
        )}
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      {items.length > 0 && !loading && (
        <div className="mt-5 grid gap-4">
          <p className="text-sm text-slate-600">
            {allSaved && meta
              ? `${items.length} টি প্রশ্ন তৈরি হয়েছে ও প্রশ্ন ব্যাংকে সংরক্ষিত হয়েছে (${meta.category} › ${meta.subject} › ${meta.topic})`
              : `${items.length} টি প্রশ্ন তৈরি হয়েছে`}
          </p>

          {items.length <= MAX_PAPER ? (
            <button
              type="button"
              onClick={() => void makePaper()}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <FilePlus2 size={18} />}
              {saving ? "সেভ হচ্ছে…" : "প্রশ্নপত্র তৈরি করুন"}
            </button>
          ) : (
            <Link
              href="/question-builder"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
            >
              <FilePlus2 size={18} /> প্রশ্ন বেছে প্রশ্নপত্র বানান
            </Link>
          )}

          {items.length > PREVIEW && (
            <p className="text-xs text-slate-500">নিচে প্রথম {PREVIEW} টি প্রশ্ন দেখানো হলো। বাকিগুলো প্রশ্ন ব্যাংকে আছে।</p>
          )}

          {items.slice(0, PREVIEW).map((q, i) => {
            const chosen = picked[i];
            const isCq = q.type === "CQ" || !!q.subQuestions;
            const isShort = q.type === "SHORT";
            const isMcq = !isCq && !isShort;

            return (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-semibold mb-2">
                  {i + 1}. {isCq ? (q.stimulus || "উদ্দীপক") : (q.text || "প্রশ্ন")}
                </p>

                {isCq && q.subQuestions && (
                  <div className="mt-2 text-sm text-slate-700 space-y-1 pl-2">
                    <p><b>(ক)</b> {q.subQuestions.k || ""}</p>
                    <p><b>(খ)</b> {q.subQuestions.kh || ""}</p>
                    <p><b>(গ)</b> {q.subQuestions.g || ""}</p>
                    <p><b>(ঘ)</b> {q.subQuestions.gh || ""}</p>
                  </div>
                )}

                {isMcq && (
                  <div className="mt-2 grid gap-2">
                    {(["A", "B", "C", "D"] as const).map((k, j) => {
                      const isCorrect = k === q.correct;
                      const isChosen = chosen === k;
                      const cls = chosen
                        ? isCorrect
                          ? "border-emerald-600 bg-emerald-50"
                          : isChosen
                            ? "border-red-500 bg-red-50"
                            : "border-slate-200"
                        : "border-slate-300 hover:bg-slate-50";
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={!!chosen}
                          onClick={() => setPicked((p) => ({ ...p, [i]: k }))}
                          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm ${cls}`}
                        >
                          <b>{BN[j]}.</b>
                          <span>{q.options?.[k] || ""}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {isShort && (
                  <p className="mt-2 text-sm text-slate-600">ব্যাখ্যা/উত্তর: {q.explanation || "সংরক্ষিত আছে"}</p>
                )}

                {chosen && q.explanation && isMcq && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
