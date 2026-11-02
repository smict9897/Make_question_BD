"use client";

import { useState, useMemo, useEffect } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Clock, CheckCheck, XCircle, ListTodo, Check, Save, Edit3, CheckSquare, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { NCTB_CLASSES } from "@/lib/nctb-data";

type GenType = "BLOG" | "MCQ" | "CQ" | "SQ";
type QKind = "MCQ" | "CQ" | "SQ";

// সৃজনশীল প্রশ্নের ক/খ/গ/ঘ (৪ অংশ)
const CQ4: [string, string][] = [
  ["ক", "জ্ঞানমূলক · ১"],
  ["খ", "অনুধাবনমূলক · ২"],
  ["গ", "প্রয়োগমূলক · ৩"],
  ["ঘ", "উচ্চতর দক্ষতা · ৪"],
];

// গণিতের সৃজনশীল (৩ অংশ: ক-২, খ-৪, গ-৪)
const CQ3: [string, string][] = [
  ["ক", "২ নম্বর"],
  ["খ", "৪ নম্বর"],
  ["গ", "৪ নম্বর"],
];

// প্রশ্নে ঘ থাকলে ৪ অংশ, না থাকলে ৩ অংশ
function cqKeysOf(o: any): [string, string][] {
  const has4 = o && typeof o["ঘ"] === "string" && o["ঘ"].trim().length > 0;
  return has4 ? CQ4 : CQ3;
}

// প্রশ্ন কোন ধরনের তা বের করা
function kindOf(q: any): QKind {
  if (q?.correct && String(q.correct).trim()) return "MCQ";
  const o = q?.options && typeof q.options === "object" ? q.options : {};
  if (o.stimulus || o["ক"] || o["খ"]) return "CQ";
  return "SQ";
}

export default function AdminAIGenerator() {
  const router = useRouter();
  
  // জেনারেটরের স্টেট
  const [category, setCategory] = useState(NCTB_CLASSES[0]?.class || "Class 9-10");
  const [subject, setSubject] = useState("");
  const [topicCategory, setTopicCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [isAllTopics, setIsAllTopics] = useState(false);
  const [type, setType] = useState<GenType>("BLOG");
  const [prompt, setPrompt] = useState("");
  const [mcqCount, setMcqCount] = useState(10);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // অ্যাপ্রুভালের স্টেট
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [approvalMsg, setApprovalMsg] = useState("");
  const [approvalErr, setApprovalErr] = useState("");

  const availableSubjects = useMemo(() => {
    const foundClass = NCTB_CLASSES.find((c) => c.class === category);
    return foundClass ? foundClass.subjects : [];
  }, [category]);

  const currentSubjectData = useMemo(() => {
    return availableSubjects.find((s) => s.name === subject);
  }, [availableSubjects, subject]);

  // ফ্ল্যাট চ্যাপ্টার লিস্ট (যে বিষয়গুলোতে গ্রুপ নেই)
  const flatTopics = useMemo(() => currentSubjectData?.chapters ?? [], [currentSubjectData]);
  // গ্রুপ করা সাব-ক্যাটাগরি লিস্ট (যেমন: Unit, গদ্য, পদ্য ইত্যাদি)
  const groupedTopics = useMemo(() => currentSubjectData?.subCategories ?? [], [currentSubjectData]);

  const hasGroups = groupedTopics.length > 0;

  // নির্বাচিত ক্যাটাগরির মধ্যকার টপিকগুলো
  const topicsInSelectedCategory = useMemo(() => {
    if (!topicCategory) return [];
    const grp = groupedTopics.find((g) => g.category === topicCategory);
    return grp?.topics ?? [];
  }, [groupedTopics, topicCategory]);

  // সবগুলো টপিক এক জায়গায়
  const availableTopics = useMemo(() => {
    if (flatTopics.length > 0) return flatTopics;
    return groupedTopics.flatMap((g) => g.topics);
  }, [flatTopics, groupedTopics]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/ai-status");
      const data = await res.json();
      if (data.success) { setStats(data.stats); setRecentTasks(data.recentTasks); }
    } catch (e) {} finally { setIsInitialLoad(false); }
  };

  // 🎯 শুধু যেগুলো এখনো অ্যাপ্রুভ হয়নি
  const fetchPendingQuestions = async () => {
    try {
      const res = await fetch("/api/admin/ai-approvals?pending=1");
      const data = await res.json();
      if (data.success) setPendingQuestions(data.questions);
    } catch (e) {}
  };

  useEffect(() => {
    fetchStats();
    fetchPendingQuestions();
    const interval = setInterval(() => { fetchStats(); fetchPendingQuestions(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const pickType = (t: GenType) => {
    setType(t);
    setMcqCount(t === "CQ" ? 3 : 10);
  };

  const handleGenerate = async () => {
    if (!subject) return setStatus({ type: "error", msg: "অনুগ্রহ করে বিষয় নির্বাচন করুন।" });

    let finalTopics: string[] = [];
    if (isAllTopics) finalTopics = availableTopics; 
    else if (topic) finalTopics = [topic]; 
    else finalTopics = ["সকল অধ্যায়"]; 

    setLoading(true);
    setStatus({ type: "info", msg: "কাজ লাইনে যোগ করা হচ্ছে..." });

    try {
      const res = await fetch("/api/admin/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type, category, subject, topics: finalTopics, mcqCount }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: "info", msg: "কাজ সফলভাবে জমা হয়েছে। এআই একের পর এক অংশ তৈরি করছে... (দয়া করে অপেক্ষা করুন)" });
        setPrompt(""); setTopic(""); setIsAllTopics(false);
        fetchStats(); 

        let hasMoreTasks = true;
        while (hasMoreTasks) {
          try {
            const workerRes = await fetch("/api/admin/ai-worker");
            const workerText = await workerRes.text();

            if (workerText.includes("No Task")) {
              hasMoreTasks = false; 
              setStatus({ type: "success", msg: "🎉 আপনার সব কাজ সফলভাবে সম্পন্ন হয়েছে এবং ড্রাফটে সেভ হয়েছে!" });
              fetchPendingQuestions();
            } else if (workerText.includes("Error") || !workerRes.ok) {
              hasMoreTasks = false; 
              setStatus({ type: "error", msg: `সমস্যা হয়েছে: ${workerText.slice(0, 300)}` });
            } else {
              fetchStats();
              fetchPendingQuestions();
              setStatus({ type: "info", msg: "একটি অংশ তৈরি হলো, পরের অংশ তৈরি হচ্ছে..." });
            }
          } catch (err) {
            hasMoreTasks = false;
            setStatus({ type: "error", msg: "ইন্টারনেট বা সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" });
          }
        }
        router.refresh();
      } else {
        setStatus({ type: "error", msg: data.error || "কিছু ভুল হয়েছে।" });
      }
    } catch (error: any) {
      setStatus({ type: "error", msg: "সার্ভারে সমস্যা হয়েছে।" });
    } finally { setLoading(false); }
  };

  // 🎯 অ্যাপ্রুভ/এডিটের সাধারণ কল (ত্রুটি হলে পেজে দেখাবে)
  const postApproval = async (body: any) => {
    setApprovalMsg("");
    setApprovalErr("");
    try {
      const res = await fetch("/api/admin/ai-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (!res.ok || !data?.success) {
        setApprovalErr(data?.error || "কাজটি হয়নি। আবার চেষ্টা করুন।");
        return null;
      }
      return data;
    } catch (e) {
      setApprovalErr("সার্ভারে সমস্যা হয়েছে। ইন্টারনেট চেক করে আবার চেষ্টা করুন।");
      return null;
    }
  };

  const handleApproveOne = async (id: string) => {
    setIsApproving(true);
    const data = await postApproval({ action: "approve", ids: [id] });
    if (data) {
      setApprovalMsg(data.message);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      fetchPendingQuestions();
      fetchStats();
    }
    setIsApproving(false);
  };

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return;
    setIsApproving(true);
    const data = await postApproval({ action: "approve", ids: selectedIds });
    if (data) {
      setApprovalMsg(data.message);
      setSelectedIds([]);
      fetchPendingQuestions();
      fetchStats();
    }
    setIsApproving(false);
  };

  const handleApproveAll = async () => {
    if (!window.confirm("আপনি কি সব প্রশ্ন অ্যাপ্রুভ করতে চান?")) return;
    setIsApproving(true);
    const data = await postApproval({ action: "approve-all" });
    if (data) {
      setApprovalMsg(data.message);
      setSelectedIds([]);
      fetchPendingQuestions();
      fetchStats();
    }
    setIsApproving(false);
  };

  // এডিট শুরু
  const startEdit = (q: any) => {
    const k = kindOf(q);
    const opts = q.options && typeof q.options === "object" ? q.options : {};
    setEditingId(q.id);
    if (k === "MCQ") {
      setEditData({ id: q.id, kind: k, text: q.text || "", options: { ...opts }, correct: q.correct || "A", explanation: q.explanation || "", topic: q.topic || "" });
    } else if (k === "CQ") {
      const three = cqKeysOf(opts).length === 3;
      setEditData({
        id: q.id, kind: k, three, text: q.text || "",
        options: { ...opts, stimulus: opts.stimulus || q.text || "", ans: { ...(opts.ans || {}) } },
        correct: "", explanation: "", topic: q.topic || "",
      });
    } else {
      setEditData({ id: q.id, kind: k, text: q.text || "", options: { ...opts, answer: opts.answer || q.explanation || "" }, correct: "", explanation: q.explanation || "", topic: q.topic || "" });
    }
  };

  const cancelEdit = () => { setEditingId(null); setEditData(null); };

  const handleSaveEdit = async () => {
    if (!editData) return;
    setIsApproving(true);

    let payload: any;
    if (editData.kind === "MCQ") {
      payload = {
        action: "update", id: editData.id, text: editData.text,
        options: editData.options, correct: editData.correct,
        explanation: editData.explanation, topic: editData.topic,
      };
    } else if (editData.kind === "CQ") {
      // ৩ অংশের প্রশ্নে ঘ সেভ হবে না
      const opts: any = { ...editData.options, ans: { ...(editData.options.ans || {}) } };
      if (editData.three) {
        delete opts["ঘ"];
        delete opts.ans["ঘ"];
      }
      payload = {
        action: "update", id: editData.id,
        text: opts.stimulus || editData.text,
        options: opts, topic: editData.topic,
      };
    } else {
      payload = {
        action: "update", id: editData.id, text: editData.text,
        options: { answer: editData.options.answer || "" },
        explanation: editData.options.answer || "", topic: editData.topic,
      };
    }

    const data = await postApproval(payload);
    if (data) {
      setApprovalMsg(data.message);
      cancelEdit();
      fetchPendingQuestions();
    }
    setIsApproving(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const setOpt = (key: string, val: string) =>
    setEditData((d: any) => ({ ...d, options: { ...d.options, [key]: val } }));
  const setAns = (key: string, val: string) =>
    setEditData((d: any) => ({ ...d, options: { ...d.options, ans: { ...(d.options.ans || {}), [key]: val } } }));

  const cleanOpt = (t: string) => t?.replace(/[✓✔☑]/g, "").replace(/\[?(উত্তর|Ans|সঠিক|Correct).*?\]?/gi, "").trim() || "";
  const noTask = !isInitialLoad && stats.pending === 0 && stats.processing === 0 && stats.completed === 0 && stats.failed === 0;
  const allTasksCompleted = !isInitialLoad && stats.pending === 0 && stats.processing === 0 && (stats.completed > 0 || stats.failed > 0);

  const typeBtn = (t: GenType, label: string) => (
    <button
      key={t}
      onClick={() => pickType(t)}
      className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold border transition ${type === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300"}`}
    >
      {label}
    </button>
  );

  const countStep = type === "CQ" ? 3 : 10;
  const countMin = type === "CQ" ? 3 : 10;

  return (
    <div className="space-y-6 mb-6">
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-blue-900">
          <Sparkles size={20} className="text-blue-600" />
          <h2 className="text-lg font-bold">AI অটো-জেনারেটর (এক ক্লিকে সম্পূর্ণ)</h2>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700">কী তৈরি করতে চান?</label>
            <div className="grid grid-cols-2 sm:flex gap-2 mt-1">
              {typeBtn("BLOG", "📝 ব্লগ পোস্ট")}
              {typeBtn("MCQ", "🎯 MCQ")}
              {typeBtn("CQ", "🧠 সৃজনশীল (CQ)")}
              {typeBtn("SQ", "✏️ সংক্ষিপ্ত (SQ)")}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">ক্লাস</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setSubject(""); setTopicCategory(""); setTopic(""); }} className="w-full rounded-lg border border-blue-200 p-2 text-sm mt-1 bg-white">
              {NCTB_CLASSES.map((c) => <option key={c.class} value={c.class}>{c.class}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">বিষয়</label>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setTopicCategory("");
                setTopic("");
                setIsAllTopics(false);
              }}
              className="w-full rounded-lg border border-blue-200 p-2 text-sm mt-1 bg-white"
            >
              <option value="">-- বিষয় বাছুন --</option>
              {availableSubjects.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {type !== "BLOG" && (
            <div>
              <label className="text-xs font-bold text-slate-700">
                প্রশ্নের সংখ্যা {type === "CQ" ? "(প্রতি অংশে ৩টি করে)" : "(১০টি করে বাড়ে)"}
              </label>
              <input type="number" value={mcqCount} onChange={(e) => setMcqCount(Number(e.target.value))} className="w-full rounded-lg border border-blue-200 p-2 text-sm mt-1 bg-white" min={countMin} step={countStep} />
              {type === "CQ" && /গণিত/.test(subject) && (
                <p className="mt-1 text-[11px] font-bold text-emerald-700">গণিতের সৃজনশীলে ৩ অংশ (ক-২, খ-৪, গ-৪) হবে।</p>
              )}
            </div>
          )}

          <div className={`bg-blue-100/50 p-3 rounded-xl border border-blue-200 ${type === "BLOG" ? "sm:col-span-2" : ""}`}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={isAllTopics} onChange={(e) => setIsAllTopics(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" disabled={!subject || availableTopics.length === 0} />
              <span className="text-sm font-bold text-blue-900">সবগুলো অধ্যায়ের জন্য কাজ দিন</span>
            </label>

            {!isAllTopics && (
              <>
                {hasGroups ? (
                  <div className="space-y-2">
                    <select
                      value={topicCategory}
                      onChange={(e) => { setTopicCategory(e.target.value); setTopic(""); }}
                      className="w-full rounded-lg border border-blue-200 p-2 text-sm bg-white"
                      disabled={!subject}
                    >
                      <option value="">-- ইউনিট/ক্যাটাগরি বাছুন --</option>
                      {groupedTopics.map((group) => (
                        <option key={group.category} value={group.category}>{group.category}</option>
                      ))}
                    </select>

                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full rounded-lg border border-blue-200 p-2 text-sm bg-white"
                      disabled={!topicCategory || topicsInSelectedCategory.length === 0}
                    >
                      <option value="">-- নির্দিষ্ট অধ্যায়/টপিক বাছুন --</option>
                      {topicsInSelectedCategory.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-lg border border-blue-200 p-2 text-sm bg-white" disabled={!subject || availableTopics.length === 0}>
                    <option value="">-- নির্দিষ্ট অধ্যায় বাছুন --</option>
                    {flatTopics.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="বাড়তি কোনো নির্দেশনা (যেমন: সব প্রশ্ন গাণিতিক সমস্যাভিত্তিক হবে)..." rows={3} className="w-full rounded-xl border border-blue-200 bg-white p-3 text-sm outline-none focus:border-blue-500" disabled={loading} />
          
          <button onClick={handleGenerate} disabled={loading || !subject} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? "এআই কাজ করছে (বন্ধ করবেন না)..." : "এক ক্লিকে সম্পূর্ণ তৈরি করুন"}
          </button>
        </div>

        {status && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm font-semibold ${
            status.type === "success" ? "bg-green-100 text-green-800" : status.type === "error" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
          }`}>
            {status.type === "success" ? <CheckCircle2 size={18} /> : status.type === "error" ? <AlertCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
            <span>{status.msg}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
          <span>কাজের বর্তমান অবস্থা</span>
          <span className="text-[10px] text-slate-400 font-normal">(প্রতি ১০ সেকেন্ডে আপডেট হয়)</span>
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 flex items-center gap-3"><Clock size={20} className="text-orange-500" /><div><p className="text-xs text-slate-500">Pending</p><p className="text-lg font-bold text-orange-600">{stats.pending}</p></div></div>
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex items-center gap-3"><Loader2 size={20} className="text-blue-500" /><div><p className="text-xs text-slate-500">Processing</p><p className="text-lg font-bold text-blue-600">{stats.processing}</p></div></div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-100 flex items-center gap-3"><CheckCheck size={20} className="text-green-500" /><div><p className="text-xs text-slate-500">Completed</p><p className="text-lg font-bold text-green-600">{stats.completed}</p></div></div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex items-center gap-3"><XCircle size={20} className="text-red-500" /><div><p className="text-xs text-slate-500">Failed</p><p className="text-lg font-bold text-red-600">{stats.failed}</p></div></div>
        </div>

        {noTask && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm font-bold text-slate-600">
            <ListTodo size={18} className="text-slate-500" />
            <span>No Task (এখন কোনো কাজ অপেক্ষায় বা চলমান নেই)</span>
          </div>
        )}

        {allTasksCompleted && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-sm font-bold text-green-700 shadow-sm">
            <CheckCircle2 size={18} className="text-green-600" />
            <span>🎉 Your all task is completed! (আপনার সব কাজ সফলভাবে সম্পন্ন হয়েছে)</span>
          </div>
        )}
      </div>

      {pendingQuestions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={20} />
                অ্যাপ্রুভালের অপেক্ষায় ({pendingQuestions.length})
              </h2>
              <p className="text-xs text-slate-500 mt-1">এআই-এর তৈরি প্রশ্নগুলো চেক করে অ্যাপ্রুভ করুন।</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (selectedIds.length === pendingQuestions.length) setSelectedIds([]);
                  else setSelectedIds(pendingQuestions.map(q => q.id));
                }} 
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {selectedIds.length === pendingQuestions.length ? <CheckSquare size={14} /> : <Square size={14} />}
                সব সিলেক্ট
              </button>
              <button 
                onClick={handleApproveAll} 
                disabled={isApproving} 
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60 shadow-sm"
              >
                {isApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                Approve All
              </button>
            </div>
          </div>

          {approvalMsg && <div className="mb-3 text-xs font-bold text-green-600 bg-green-50 p-2 rounded">{approvalMsg}</div>}
          {approvalErr && <div className="mb-3 text-xs font-bold text-red-600 bg-red-50 p-2 rounded">{approvalErr}</div>}

          <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2">
            {pendingQuestions.map((q, i) => {
              const isEditing = editingId === q.id && !!editData;
              const k = kindOf(q);
              const o = q.options && typeof q.options === "object" ? q.options : {};
              const cqKeys = cqKeysOf(o);
              return (
                <div key={q.id} className={`rounded-xl border p-4 transition-all ${isEditing ? "border-blue-500 bg-white ring-1 ring-blue-500" : "border-slate-200 bg-slate-50/30"}`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleSelect(q.id)} className="mt-1 text-blue-600">
                      {selectedIds.includes(q.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-3">
                          {/* ===== MCQ এডিট ===== */}
                          {editData.kind === "MCQ" && (
                            <>
                              <textarea value={editData.text} onChange={(e) => setEditData({ ...editData, text: e.target.value })} className="w-full rounded-lg border p-2 text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none" rows={3} />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {["A", "B", "C", "D"].map(key => (
                                  <div key={key} className="flex items-center gap-2">
                                    <span className="font-bold w-4">{key}:</span>
                                    <input value={editData.options[key] || ""} onChange={(e) => setOpt(key, e.target.value)} className="w-full rounded border p-1.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-xs mt-2 bg-slate-100 p-2 rounded">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold">সঠিক:</span>
                                  <select value={editData.correct} onChange={(e) => setEditData({ ...editData, correct: e.target.value })} className="rounded border p-1 outline-none">
                                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                  </select>
                                </div>
                                <div className="flex-1">
                                  <input placeholder="ব্যাখ্যা..." value={editData.explanation || ""} onChange={(e) => setEditData({ ...editData, explanation: e.target.value })} className="w-full rounded border p-1.5 outline-none" />
                                </div>
                              </div>
                            </>
                          )}

                          {/* ===== CQ এডিট ===== */}
                          {editData.kind === "CQ" && (
                            <>
                              <div>
                                <p className="text-xs font-bold text-slate-600 mb-1">উদ্দীপক</p>
                                <textarea value={editData.options.stimulus || ""} onChange={(e) => setOpt("stimulus", e.target.value)} className="w-full rounded-lg border p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" rows={4} />
                              </div>
                              {(editData.three ? CQ3 : CQ4).map(([key, label]) => (
                                <div key={key} className="rounded-lg bg-slate-100 p-2 space-y-1">
                                  <p className="text-xs font-bold text-slate-600">({key}) {label}</p>
                                  <textarea value={editData.options[key] || ""} onChange={(e) => setOpt(key, e.target.value)} className="w-full rounded border p-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500" rows={2} placeholder="প্রশ্ন" />
                                  <textarea value={editData.options.ans?.[key] || ""} onChange={(e) => setAns(key, e.target.value)} className="w-full rounded border p-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500" rows={3} placeholder="নমুনা উত্তর" />
                                </div>
                              ))}
                            </>
                          )}

                          {/* ===== SQ এডিট ===== */}
                          {editData.kind === "SQ" && (
                            <>
                              <div>
                                <p className="text-xs font-bold text-slate-600 mb-1">প্রশ্ন</p>
                                <textarea value={editData.text} onChange={(e) => setEditData({ ...editData, text: e.target.value })} className="w-full rounded-lg border p-2 text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none" rows={2} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-600 mb-1">নমুনা উত্তর</p>
                                <textarea value={editData.options.answer || ""} onChange={(e) => setOpt("answer", e.target.value)} className="w-full rounded-lg border p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" rows={3} />
                              </div>
                            </>
                          )}

                          {/* অধ্যায়ের নাম (সব ধরনে) */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold shrink-0">অধ্যায়:</span>
                            <input value={editData.topic || ""} onChange={(e) => setEditData({ ...editData, topic: e.target.value })} className="w-full rounded border p-1.5 outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>

                          <div className="flex gap-2 mt-2">
                            <button onClick={handleSaveEdit} disabled={isApproving} className="flex items-center gap-1 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Save size={12} /> সেভ</button>
                            <button onClick={cancelEdit} className="rounded bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-700">বাতিল</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* ===== MCQ কার্ড ===== */}
                          {k === "MCQ" && (
                            <>
                              <p className="text-sm font-bold text-slate-800 whitespace-pre-line">{i + 1}. {q.text}</p>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                                <div className={q.correct === "A" ? "font-bold text-emerald-600" : ""}>(ক) {cleanOpt(o.A)}</div>
                                <div className={q.correct === "B" ? "font-bold text-emerald-600" : ""}>(খ) {cleanOpt(o.B)}</div>
                                <div className={q.correct === "C" ? "font-bold text-emerald-600" : ""}>(গ) {cleanOpt(o.C)}</div>
                                <div className={q.correct === "D" ? "font-bold text-emerald-600" : ""}>(ঘ) {cleanOpt(o.D)}</div>
                              </div>
                            </>
                          )}

                          {/* ===== CQ কার্ড ===== */}
                          {k === "CQ" && (
                            <>
                              <p className="text-sm font-bold text-slate-800 whitespace-pre-line">{i + 1}. {o.stimulus || q.text}</p>
                              <div className="mt-2 space-y-2 text-xs text-slate-700">
                                {cqKeys.map(([key, label]) => (
                                  <div key={key} className="rounded-lg bg-white border border-slate-200 p-2">
                                    <p className="font-bold whitespace-pre-line">({key}) {o[key]} <span className="text-[10px] font-normal text-slate-400">[{label}]</span></p>
                                    {o.ans?.[key] && <p className="mt-1 text-emerald-700 whitespace-pre-line">উত্তর: {o.ans[key]}</p>}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          {/* ===== SQ কার্ড ===== */}
                          {k === "SQ" && (
                            <>
                              <p className="text-sm font-bold text-slate-800 whitespace-pre-line">{i + 1}. {q.text}</p>
                              {(o.answer || q.explanation) && (
                                <p className="mt-2 text-xs text-emerald-700 whitespace-pre-line">উত্তর: {o.answer || q.explanation}</p>
                              )}
                            </>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                            <span className="bg-slate-800 text-white px-2 py-0.5 rounded">{k === "MCQ" ? "MCQ" : k === "CQ" ? "সৃজনশীল" : "সংক্ষিপ্ত"}</span>
                            {k === "MCQ" && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">সঠিক: {q.correct}</span>}
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{q.category}</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{q.subject}</span>
                            {q.topic && <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{q.topic}</span>}
                            
                            <button onClick={() => startEdit(q)} className="ml-auto flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-slate-700 hover:bg-slate-200 border border-slate-200">
                              <Edit3 size={12} /> এডিট
                            </button>
                            <button onClick={() => handleApproveOne(q.id)} disabled={isApproving} className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-60">
                              <Check size={12} /> Approve
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {selectedIds.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
              <button onClick={handleApproveSelected} disabled={isApproving} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm">
                {isApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                নির্বাচিত {selectedIds.length} টি অ্যাপ্রুভ করুন
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== ফাইল শেষ =====
