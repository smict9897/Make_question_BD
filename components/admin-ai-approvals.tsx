"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, CheckSquare, Square, Save } from "lucide-react";

export default function AdminAIApprovals() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-approvals");
      const data = await res.json();
      if (data.success) setQuestions(data.questions);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchQuestions(); }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === questions.length) setSelectedIds([]);
    else setSelectedIds(questions.map((q) => q.id));
  };

  const handleApprove = async () => {
    if (selectedIds.length === 0) return alert("অনুগ্রহ করে প্রশ্ন নির্বাচন করুন!");
    setProcessing(true); setMsg("");
    try {
      const res = await fetch("/api/admin/ai-approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", ids: selectedIds }),
      });
      const data = await res.json();
      if (data.success) { setMsg(data.message); setSelectedIds([]); fetchQuestions(); } 
      else { setMsg(data.error); }
    } catch (e) { setMsg("নেটওয়ার্ক এরর!"); } finally { setProcessing(false); }
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/ai-approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...editData }),
      });
      const data = await res.json();
      if (data.success) { setMsg(data.message); setEditingId(null); setEditData(null); fetchQuestions(); } 
      else { setMsg(data.error); }
    } catch (e) { setMsg("নেটওয়ার্ক এরর!"); } finally { setProcessing(false); }
  };

  const startEdit = (q: any) => { setEditingId(q.id); setEditData({ ...q, options: { ...q.options } }); };
  const cleanOpt = (t: string) => t?.replace(/[✓✔☑]/g, "").replace(/\[?(উত্তর|Ans|সঠিক|Correct).*?\]?/gi, "").trim() || "";

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">AI Generated Questions (Pending Approval)</h2>
          <p className="text-xs text-slate-500">এআই-এর তৈরি প্রশ্নগুলো এখানে দেখতে পাবেন। প্রয়োজনে এডিট করে অ্যাপ্রুভ করুন।</p>
        </div>
        <div className="flex gap-2">
          <button onClick={selectAll} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            {selectedIds.length === questions.length && questions.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
            সব সিলেক্ট
          </button>
          <button onClick={handleApprove} disabled={processing || selectedIds.length === 0} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {processing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            অ্যাপ্রুভ করুন ({selectedIds.length})
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700"><AlertCircle size={16} /> {msg}</div>}

      {questions.length === 0 ? (
        <p className="py-8 text-center text-slate-500">কোনো নতুন এআই প্রশ্ন পাওয়া যায়নি।</p>
      ) : (
        <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2">
          {questions.map((q, i) => {
            const isChecked = selectedIds.includes(q.id);
            const isEditing = editingId === q.id;
            return (
              <div key={q.id} className={`rounded-xl border p-4 transition-all ${isChecked ? "border-blue-400 bg-blue-50/30" : "border-slate-200"} ${isEditing ? "ring-2 ring-blue-500 bg-white" : ""}`}>
                <div className="flex items-start gap-3">
                  {!isEditing && (
                    <button onClick={() => toggleSelect(q.id)} className="mt-1 text-blue-600">
                      {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  )}
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea value={editData.text} onChange={(e) => setEditData({ ...editData, text: e.target.value })} className="w-full rounded-lg border p-2 text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none" rows={2} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {["A", "B", "C", "D"].map(key => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="font-bold w-4">{key}:</span>
                              <input value={editData.options[key] || ""} onChange={(e) => setEditData({ ...editData, options: { ...editData.options, [key]: e.target.value } })} className="w-full rounded border p-1.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-xs mt-2 bg-slate-50 p-2 rounded">
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
                        <div className="flex gap-2 mt-2">
                          <button onClick={handleSaveEdit} disabled={processing} className="flex items-center gap-1 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{processing ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} সেভ</button>
                          <button onClick={() => setEditingId(null)} className="rounded bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-700">বাতিল</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-800 whitespace-pre-line">{i + 1}. {q.text}</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                          <div className={q.correct === "A" ? "font-bold text-emerald-600" : ""}>(ক) {cleanOpt(q.options?.A)}</div>
                          <div className={q.correct === "B" ? "font-bold text-emerald-600" : ""}>(খ) {cleanOpt(q.options?.B)}</div>
                          <div className={q.correct === "C" ? "font-bold text-emerald-600" : ""}>(গ) {cleanOpt(q.options?.C)}</div>
                          <div className={q.correct === "D" ? "font-bold text-emerald-600" : ""}>(ঘ) {cleanOpt(q.options?.D)}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">সঠিক: {q.correct}</span>
                          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">{q.category}</span>
                          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{q.subject}</span>
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{q.topic}</span>
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded">{q.difficulty}</span>
                          <button onClick={() => startEdit(q)} className="ml-auto flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-slate-700 hover:bg-slate-200">✏️ এডিট</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
