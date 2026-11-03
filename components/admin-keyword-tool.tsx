"use client";
import { useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, PlusCircle, Save, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { opportunityScore, parseVolume, type KeywordItem, type SeoPack } from "@/lib/keyword-research";

export type InsertTarget = "auto" | "focus" | "keywords";
export type SeoPatch = { title?: string; slug?: string; metaTitle?: string; metaDescription?: string; tags?: string };

type Props = {
  /** "CMS-এ যোগ করুন" চাপলে কিওয়ার্ড এই ফাংশনে যায় */
  onSelectKeyword?: (keyword: string, target?: InsertTarget) => void;
  /** SEO প্যাকের শিরোনাম/slug/meta/ট্যাগ ফর্মে বসানোর ফাংশন */
  onApplySeo?: (patch: SeoPatch) => void;
  initialTopic?: string;
  compact?: boolean;
};

type Res<T> = ({ ok: true } & T) | { ok: false; error: string };
type SavedList = { id: string; topic: string; savedAt: number; items: KeywordItem[] };

const DIFF_STYLE: Record<KeywordItem["difficulty"], { cls: string; label: string }> = {
  Low: { cls: "bg-green-100 text-green-800", label: "সহজ" },
  Medium: { cls: "bg-yellow-100 text-yellow-800", label: "মাঝারি" },
  High: { cls: "bg-red-100 text-red-800", label: "কঠিন" },
};
const DIFF_ORDER = { Low: 1, Medium: 2, High: 3 } as const;
const TYPES = ["Primary", "Long-tail", "Question"] as const;
const INTENTS = ["Informational", "Download", "Solution", "Preparation"] as const;

const selCls = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs";
const btn = "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60";

async function call<T>(url: string, init?: RequestInit): Promise<Res<T>> {
  try {
    const res = await fetch(url, init);
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error ?? `সমস্যা হয়েছে (কোড ${res.status})। আবার চেষ্টা করুন।` };
    return j as Res<T>;
  } catch {
    return { ok: false, error: "ইন্টারনেট সংযোগে সমস্যা হয়েছে। সংযোগ দেখে আবার চেষ্টা করুন।" };
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function downloadCsv(rows: KeywordItem[], name: string) {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["Keyword", "Type", "Intent", "Difficulty", "MonthlySearchEst", "OpportunityScore", "UsageTip"];
  const lines = [
    head.map(esc).join(","),
    ...rows.map((k) =>
      [k.keyword, k.type, k.intent, k.difficulty, k.monthlySearchEst, opportunityScore(k), k.usageTip].map(esc).join(","),
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\wঀ-৿-]+/g, "_") || "keywords"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Diff({ d }: { d: KeywordItem["difficulty"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DIFF_STYLE[d].cls}`}>{DIFF_STYLE[d].label}</span>
  );
}

function Score({ n }: { n: number }) {
  const color = n >= 60 ? "bg-emerald-500" : n >= 35 ? "bg-yellow-500" : "bg-red-400";
  return (
    <span className="inline-flex items-center gap-1.5" title="সুযোগ স্কোর: বেশি সার্চ ও কম কঠিন হলে বেশি">
      <span className="h-1.5 w-14 overflow-hidden rounded bg-slate-200">
        <span className={`block h-full ${color}`} style={{ width: `${n}%` }} />
      </span>
      <span className="text-xs font-semibold">{n}</span>
    </span>
  );
}

function RowActions({
  k, copied, inserted, canInsert, onCopy, onInsert,
}: {
  k: KeywordItem;
  copied: string;
  inserted: boolean;
  canInsert: boolean;
  onCopy: (text: string, id: string) => void;
  onInsert: (kw: string, target: InsertTarget) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => onCopy(k.keyword, k.keyword)} className={`${btn} border-slate-300 bg-white`}>
        {copied === k.keyword ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
        {copied === k.keyword ? "কপি হয়েছে" : "কপি"}
      </button>
      {canInsert && (
        <>
          <button type="button" onClick={() => onInsert(k.keyword, "auto")} className={`${btn} border-blue-600 bg-blue-600 text-white`}>
            {inserted ? <Check size={13} /> : <PlusCircle size={13} />}
            {inserted ? "যোগ হয়েছে" : "CMS-এ যোগ করুন"}
          </button>
          <button type="button" onClick={() => onInsert(k.keyword, "focus")} className={`${btn} border-slate-300 bg-white`}>
            ফোকাস কিওয়ার্ড
          </button>
        </>
      )}
    </div>
  );
}

export default function AdminKeywordTool({ onSelectKeyword, onApplySeo, initialTopic = "", compact = false }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [lang, setLang] = useState("mixed");
  const [audience, setAudience] = useState("all");
  const [count, setCount] = useState(12);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<KeywordItem[]>([]);

  const [fType, setFType] = useState("");
  const [fIntent, setFIntent] = useState("");
  const [fDiff, setFDiff] = useState("");
  const [sortBy, setSortBy] = useState("score");

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState("");
  const [inserted, setInserted] = useState<Set<string>>(new Set());

  const [pack, setPack] = useState<SeoPack | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  // 👇 নতুন আর্টিকেল জেনারেটরের স্টেট 👇
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleText, setArticleText] = useState("");
  // 👆 --------------------------------- 👆

  const [saved, setSaved] = useState<SavedList[] | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = items.filter(
      (k) => (!fType || k.type === fType) && (!fIntent || k.intent === fIntent) && (!fDiff || k.difficulty === fDiff),
    );
    const out = [...list];
    if (sortBy === "score") out.sort((a, b) => opportunityScore(b) - opportunityScore(a));
    else if (sortBy === "volume") out.sort((a, b) => parseVolume(b.monthlySearchEst) - parseVolume(a.monthlySearchEst));
    else if (sortBy === "easy") out.sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
    return out;
  }, [items, fType, fIntent, fDiff, sortBy]);

  const selected = useMemo(() => items.filter((k) => sel.has(k.keyword)), [items, sel]);
  const allVisibleSelected = rows.length > 0 && rows.every((k) => sel.has(k.keyword));

  async function search() {
    const t = topic.trim();
    if (t.length < 2) {
      setError("আগে একটি বিষয় লিখুন (যেমন: HSC ICT Chapter 3)।");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    const r = await call<{ items: KeywordItem[] }>("/api/admin/keyword-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: t, lang, audience, count }),
    });
    if (!r.ok) {
      setItems([]);
      setError(r.error);
    } else {
      setItems(r.items);
      setSel(new Set());
      setInserted(new Set());
      setPack(null);
      setApplied(new Set());
      setArticleText(""); // নতুন সার্চে আর্টিকেল রিসেট হবে
    }
    setLoading(false);
  }

  async function copy(text: string, id: string) {
    const ok = await copyText(text);
    setCopied(ok ? id : "");
    if (!ok) setError("কপি করা যায়নি। হাতে কপি করুন।");
    setTimeout(() => setCopied((c) => (c === id ? "" : c)), 1500);
  }

  function insert(keyword: string, target: InsertTarget = "auto") {
    onSelectKeyword?.(keyword, target);
    try {
      window.dispatchEvent(new CustomEvent("cms:keyword", { detail: { keyword, target } }));
    } catch {}
    setInserted((s) => new Set(s).add(keyword));
  }

  function insertSelected() {
    selected.forEach((k) => insert(k.keyword, "auto"));
    setNotice(`${selected.length} টি কিওয়ার্ড ফর্মে যোগ করা হয়েছে।`);
  }

  function toggle(kw: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(kw)) n.delete(kw);
      else n.add(kw);
      return n;
    });
  }

  function toggleAll() {
    setSel((s) => {
      const n = new Set(s);
      if (allVisibleSelected) rows.forEach((k) => n.delete(k.keyword));
      else rows.forEach((k) => n.add(k.keyword));
      return n;
    });
  }

  async function makePack() {
    const base = selected.length ? selected : [...rows].sort((a, b) => opportunityScore(b) - opportunityScore(a)).slice(0, 5);
    if (!base.length) return;
    setPackLoading(true);
    setError("");
    const r = await call<{ pack: SeoPack }>("/api/admin/keyword-research/seo-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim() || base[0].keyword, keywords: base.map((k) => k.keyword).slice(0, 12) }),
    });
    if (!r.ok) setError(r.error);
    else {
      setPack(r.pack);
      setApplied(new Set());
      setArticleText(""); // নতুন প্যাকে আর্টিকেল রিসেট হবে
    }
    setPackLoading(false);
  }

  // 👇 নতুন আর্টিকেল জেনারেট করার ফাংশন 👇
  async function generateArticle() {
    if (!pack || !pack.outline.length) return;
    setArticleLoading(true);
    setError("");
    setNotice("");
    
    const kwList = selected.length ? selected.map((k) => k.keyword) : items.map((k) => k.keyword);

    const r = await call<{ content: string }>("/api/admin/generate-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        topic: topic.trim() || "Blog Post", 
        outline: pack.outline,
        keywords: kwList.slice(0, 10)
      }),
    });

    if (!r.ok) {
      setError(r.error);
    } else {
      setArticleText(r.content);
      setNotice("আর্টিকেল তৈরি হয়েছে! নিচে দেখুন।");
    }
    setArticleLoading(false);
  }

  // 👇 এডিটরে পাঠানোর ফাংশন 👇
  function sendToComposer() {
    if (!articleText) return;
    try {
      window.dispatchEvent(new CustomEvent("cms:body", { detail: { content: articleText } }));
      setNotice("আর্টিকেলটি মূল এডিটরে পাঠানো হয়েছে!");
    } catch {
      setError("এডিটরে পাঠানো যায়নি।");
    }
  }
  // 👆 --------------------------------- 👆

  function applySeo(patch: SeoPatch, keys: string[]) {
    onApplySeo?.(patch);
    try {
      window.dispatchEvent(new CustomEvent("cms:seo", { detail: patch }));
    } catch {}
    setApplied((s) => {
      const n = new Set(s);
      keys.forEach((k) => n.add(k));
      return n;
    });
  }

  function applyAll() {
    if (!pack) return;
    const patch: SeoPatch = {};
    if (pack.titles[0]) patch.title = pack.titles[0];
    if (pack.slug) patch.slug = pack.slug;
    if (pack.metaTitle) patch.metaTitle = pack.metaTitle;
    if (pack.metaDescription) patch.metaDescription = pack.metaDescription;
    if (pack.hashtags.length) patch.tags = pack.hashtags.map((h) => `#${h}`).join(" ");
    applySeo(patch, ["title0", "slug", "metaTitle", "metaDescription", "tags"]);
  }

  async function loadSaved() {
    setSavedLoading(true);
    const r = await call<{ lists: SavedList[] }>("/api/admin/keyword-research/saved");
    if (!r.ok) setError(r.error);
    else setSaved(r.lists);
    setSavedLoading(false);
  }

  async function saveList() {
    if (!items.length) return;
    setSaving(true);
    setError("");
    const r = await call<{ id: string }>("/api/admin/keyword-research/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim() || items[0].keyword, items }),
    });
    if (!r.ok) setError(r.error);
    else {
      setNotice("তালিকা সংরক্ষিত হয়েছে।");
      if (savedOpen) void loadSaved();
    }
    setSaving(false);
  }

  async function removeList(id: string) {
    if (!confirm("এই তালিকা মুছে ফেলবেন?")) return;
    const r = await call<{ ok: true }>(`/api/admin/keyword-research/saved?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) setError(r.error);
    else setSaved((s) => (s ? s.filter((l) => l.id !== id) : s));
  }

  function openList(l: SavedList) {
    setTopic(l.topic);
    setItems(l.items);
    setSel(new Set());
    setInserted(new Set());
    setPack(null);
    setError("");
    setNotice("সংরক্ষিত তালিকা খোলা হয়েছে।");
    setArticleText("");
  }

  const canInsert = !!onSelectKeyword;
  const canApply = !!onApplySeo;

  function PackLine({ label, value, k, patch, note }: { label: string; value: string; k: string; patch?: SeoPatch; note?: string }) {
    if (!value) return null;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
        <p className="text-xs text-slate-500">{label}{note && <span className="ml-2">{note}</span>}</p>
        <p className="mt-0.5 break-words font-medium">{value}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => void copy(value, `pack-${k}`)} className={`${btn} border-slate-300 bg-white`}>
            {copied === `pack-${k}` ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            কপি
          </button>
          {canApply && patch && (
            <button type="button" onClick={() => applySeo(patch, [k])} className={`${btn} border-blue-600 bg-blue-600 text-white`}>
              {applied.has(k) ? <Check size={13} /> : <PlusCircle size={13} />}
              {applied.has(k) ? "বসেছে" : "ফর্মে বসান"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-xl font-bold">AI কিওয়ার্ড রিসার্চ</h2>
          <p className="text-sm text-slate-500">বিষয় লিখলে বাংলাদেশের ছাত্র ও চাকরিপ্রার্থীদের জন্য উপযোগী কিওয়ার্ড, সুযোগ স্কোর ও SEO প্যাক দেবে।</p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // পোস্ট ফর্মের ভেতরে থাকলে ফর্ম সাবমিট হওয়া আটকায়
                if (!loading) void search();
              }
            }}
            placeholder="যেমন: HSC ICT Chapter 3, NTRCA Math Suggestion"
            maxLength={200}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? "খোঁজা হচ্ছে…" : "কিওয়ার্ড খুঁজুন"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={lang} onChange={(e) => setLang(e.target.value)} className={selCls} aria-label="ভাষা">
            <option value="mixed">ভাষা: মিশ্র</option>
            <option value="bn">শুধু বাংলা</option>
            <option value="en">শুধু English</option>
            <option value="banglish">Banglish</option>
          </select>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className={selCls} aria-label="লক্ষ্য">
            <option value="all">লক্ষ্য: সবাই</option>
            <option value="student">ছাত্র-ছাত্রী</option>
            <option value="job">চাকরিপ্রার্থী</option>
          </select>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={selCls} aria-label="সংখ্যা">
            {[8, 12, 16, 20].map((n) => (
              <option key={n} value={n}>{n} টি</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const next = !savedOpen;
              setSavedOpen(next);
              if (next && saved === null) void loadSaved();
            }}
            className={`${btn} border-slate-300 bg-white`}
          >
            সংরক্ষিত তালিকা {savedOpen ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      {savedOpen && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {savedLoading && <p className="text-slate-500">লোড হচ্ছে…</p>}
          {saved && saved.length === 0 && <p className="text-slate-500">এখনো কোনো তালিকা সংরক্ষণ করা হয়নি।</p>}
          <ul className="space-y-2">
            {saved?.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.topic}</p>
                  <p className="text-xs text-slate-500">
                    {l.items.length} টি · {l.savedAt ? new Date(l.savedAt).toLocaleDateString("bn-BD") : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" onClick={() => openList(l)} className={`${btn} border-blue-600 bg-blue-600 text-white`}>খুলুন</button>
                  <button type="button" onClick={() => void removeList(l.id)} className={`${btn} border-red-300 bg-white text-red-600`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={fType} onChange={(e) => setFType(e.target.value)} className={selCls} aria-label="ধরন">
              <option value="">সব ধরন</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={fIntent} onChange={(e) => setFIntent(e.target.value)} className={selCls} aria-label="উদ্দেশ্য">
              <option value="">সব উদ্দেশ্য</option>
              {INTENTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={fDiff} onChange={(e) => setFDiff(e.target.value)} className={selCls} aria-label="কঠিনতা">
              <option value="">সব কঠিনতা</option>
              <option value="Low">সহজ</option>
              <option value="Medium">মাঝারি</option>
              <option value="High">কঠিন</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selCls} aria-label="সাজান">
              <option value="score">সুযোগ স্কোর অনুযায়ী</option>
              <option value="volume">বেশি সার্চ আগে</option>
              <option value="easy">সহজ আগে</option>
              <option value="none">আসল ক্রম</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {rows.length} টি দেখানো হচ্ছে{selected.length > 0 && ` · ${selected.length} টি নির্বাচিত`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void copy((selected.length ? selected : rows).map((i) => i.keyword).join(", "), "__all__")}
                className={`${btn} border-slate-300 bg-white`}
              >
                {copied === "__all__" ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                {copied === "__all__" ? "কপি হয়েছে" : selected.length ? "নির্বাচিত কপি" : "সব কমা দিয়ে কপি"}
              </button>
              <button type="button" onClick={() => downloadCsv(selected.length ? selected : rows, topic.trim() || "keywords")} className={`${btn} border-slate-300 bg-white`}>
                <Download size={13} /> CSV
              </button>
              <button type="button" onClick={() => void saveList()} disabled={saving} className={`${btn} border-slate-300 bg-white`}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} তালিকা সংরক্ষণ
              </button>
            </div>
          </div>

          {/* নির্বাচিত কিওয়ার্ডের জন্য অ্যাকশন বার */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /> সব বাছুন
            </label>
            <span className="text-xs text-slate-600">
              {selected.length > 0 ? `${selected.length} টি নির্বাচিত` : "কিছু না বাছলে সেরা ৫টি দিয়ে SEO প্যাক হবে"}
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {canInsert && selected.length > 0 && (
                <button type="button" onClick={insertSelected} className={`${btn} border-blue-600 bg-blue-600 text-white`}>
                  <PlusCircle size={13} /> নির্বাচিত {selected.length} টি CMS-এ যোগ
                </button>
              )}
              <button type="button" onClick={() => void makePack()} disabled={packLoading} className={`${btn} border-purple-600 bg-purple-600 text-white`}>
                {packLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                {packLoading ? "তৈরি হচ্ছে…" : "SEO প্যাক তৈরি করুন"}
              </button>
            </div>
          </div>

          {pack && (
            <section className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-bold"><Sparkles size={15} className="text-purple-600" /> SEO প্যাক</h3>
                {canApply && (
                  <button type="button" onClick={applyAll} className={`${btn} border-purple-600 bg-purple-600 text-white`}>
                    <PlusCircle size={13} /> সব ফর্মে বসান
                  </button>
                )}
              </div>
              {pack.titles.map((t, i) => (
                <PackLine key={`t${i}`} label={`শিরোনামের আইডিয়া ${i + 1}`} value={t} k={`title${i}`} patch={{ title: t }} />
              ))}
              <PackLine label="URL slug" value={pack.slug} k="slug" patch={{ slug: pack.slug }} />
              <PackLine label="Meta title" note={`${pack.metaTitle.length}/60`} value={pack.metaTitle} k="metaTitle" patch={{ metaTitle: pack.metaTitle }} />
              <PackLine label="Meta description" note={`${pack.metaDescription.length}/160`} value={pack.metaDescription} k="metaDescription" patch={{ metaDescription: pack.metaDescription }} />
              <PackLine
                label="হ্যাশট্যাগ"
                value={pack.hashtags.map((h) => `#${h}`).join(" ")}
                k="tags"
                patch={{ tags: pack.hashtags.map((h) => `#${h}`).join(" ") }}
              />
              
              {pack.outline.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                  <p className="text-xs text-slate-500">পোস্টের H2 কাঠামো</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {pack.outline.map((o, i) => <li key={i}>{o}</li>)}
                  </ol>
                  <button type="button" onClick={() => void copy(pack.outline.map((o) => `## ${o}`).join("\n"), "pack-outline")} className={`${btn} mt-1.5 border-slate-300 bg-white`}>
                    {copied === "pack-outline" ? <Check size={13} className="text-green-600" /> : <Copy size={13} />} কপি
                  </button>
                </div>
              )}

              {/* 👇 আর্টিকেল জেনারেটর ও প্রিভিউ বাটন 👇 */}
              {pack.outline.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={articleLoading}
                    onClick={() => void generateArticle()}
                    className={`${btn} border-purple-600 bg-purple-600 text-white`}
                  >
                    {articleLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                    {articleLoading ? "আর্টিকেল লেখা হচ্ছে..." : "সম্পূর্ণ আর্টিকেল তৈরি করুন"}
                  </button>
                </div>
              )}

              {articleText && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                    <p className="text-xs font-semibold text-slate-700">তৈরি হওয়া আর্টিকেল</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void copy(articleText, "generated-article")}
                        className={`${btn} border-slate-300 bg-white py-1`}
                      >
                        {copied === "generated-article" ? <Check size={13} className="text-green-600" /> : <Copy size={13} />} কপি করুন
                      </button>
                      <button
                        type="button"
                        onClick={sendToComposer}
                        className={`${btn} border-green-600 bg-green-600 text-white py-1 hover:bg-green-700`}
                      >
                        <PlusCircle size={13} /> এডিটরে পাঠান
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={articleText}
                    className="w-full h-64 rounded-lg border border-slate-200 p-2 text-sm font-mono text-slate-700 focus:outline-none"
                  />
                </div>
              )}
              {/* 👆 ------------------------------------------------- 👆 */}

              {pack.faqs.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                  <p className="text-xs text-slate-500">FAQ প্রশ্ন (পোস্টের শেষে দিন)</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {pack.faqs.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                  <button type="button" onClick={() => void copy(pack.faqs.join("\n"), "pack-faq")} className={`${btn} mt-1.5 border-slate-300 bg-white`}>
                    {copied === "pack-faq" ? <Check size={13} className="text-green-600" /> : <Copy size={13} />} কপি
                  </button>
                </div>
              )}
            </section>
          )}

          {/* বড় পর্দায় টেবিল */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">কিওয়ার্ড</th>
                  <th className="px-3 py-2">ধরন / উদ্দেশ্য</th>
                  <th className="px-3 py-2">মাসিক সার্চ (আনুমানিক)</th>
                  <th className="px-3 py-2">কঠিনতা</th>
                  <th className="px-3 py-2">সুযোগ</th>
                  <th className="px-3 py-2">কোথায় ব্যবহার করবেন</th>
                  <th className="px-3 py-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((k) => (
                  <tr key={k.keyword} className={`align-top ${sel.has(k.keyword) ? "bg-blue-50/60" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={sel.has(k.keyword)} onChange={() => toggle(k.keyword)} aria-label={`${k.keyword} বাছুন`} />
                    </td>
                    <td className="px-3 py-2 font-medium">{k.keyword}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{k.type}<br />{k.intent}</td>
                    <td className="whitespace-nowrap px-3 py-2">{k.monthlySearchEst}</td>
                    <td className="px-3 py-2"><Diff d={k.difficulty} /></td>
                    <td className="px-3 py-2"><Score n={opportunityScore(k)} /></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{k.usageTip}</td>
                    <td className="px-3 py-2">
                      <RowActions k={k} copied={copied} inserted={inserted.has(k.keyword)} canInsert={canInsert} onCopy={(t, id) => void copy(t, id)} onInsert={insert} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ফোনে কার্ড */}
          <ul className="space-y-3 md:hidden">
            {rows.map((k) => (
              <li key={k.keyword} className={`rounded-xl border p-3 text-sm ${sel.has(k.keyword) ? "border-blue-400 bg-blue-50/60" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={sel.has(k.keyword)} onChange={() => toggle(k.keyword)} aria-label={`${k.keyword} বাছুন`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{k.keyword}</p>
                      <Diff d={k.difficulty} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{k.type} · {k.intent} · মাসিক সার্চ ≈ {k.monthlySearchEst}</p>
                    <div className="mt-1"><Score n={opportunityScore(k)} /></div>
                    {k.usageTip && <p className="mt-1 text-xs text-slate-600">{k.usageTip}</p>}
                    <div className="mt-2">
                      <RowActions k={k} copied={copied} inserted={inserted.has(k.keyword)} canInsert={canInsert} onCopy={(t, id) => void copy(t, id)} onInsert={insert} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {rows.length === 0 && <p className="rounded-lg border p-3 text-sm text-slate-500">এই ফিল্টারে কোনো কিওয়ার্ড নেই।</p>}

          <p className="text-xs text-slate-500">
            মনে রাখবেন: মাসিক সার্চ, কঠিনতা ও সুযোগ স্কোর AI-এর আনুমানিক ধারণা, আসল Google ডেটা নয়। নিশ্চিত হতে Google Keyword Planner বা Search Console দেখুন।
          </p>
        </>
      )}
    </div>
  );
}
