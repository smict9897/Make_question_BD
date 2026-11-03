"use client";

import React, { useState } from "react";
import { Search, CheckSquare, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface QbPickerProps {
  items: any[];
}

export default function QbPicker({ items = [] }: QbPickerProps) {
  const router = useRouter();
  
  // 🎯 ট্যাব ফিল্টার: MCQ, SHORT, CQ
  const [activeTab, setActiveTab] = useState<"MCQ" | "SHORT" | "CQ">("MCQ");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // 🎯 ট্যাব এবং সার্চ অনুযায়ী প্রশ্ন ফিল্টার
  const filteredQuestions = items.filter((q) => {
    const itemType = q.type || (q.correct ? "MCQ" : q.subQuestions ? "CQ" : "SHORT");
    const matchesTab = itemType === activeTab;
    
    const searchString = (q.text || q.stimulus || "").toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    
    return matchesTab && matchesSearch;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0) {
      setSelectedIds([]);
    } else {
      const currentTabIds = filteredQuestions.map((q) => q.id);
      // আগের সিলেক্ট করা প্রশ্নগুলোর সাথে নতুনগুলো যোগ করা
      const newSelected = Array.from(new Set([...selectedIds, ...currentTabIds]));
      setSelectedIds(newSelected);
    }
  };

  const handleProceed = () => {
    if (selectedIds.length === 0) return alert("দয়া করে অন্তত একটি প্রশ্ন নির্বাচন করুন।");
    
    // লোকাল স্টোরেজে সেভ করে পরের পেজে পাঠানো
    localStorage.setItem("qb:selected", JSON.stringify(selectedIds));
    router.push("/question-builder/build"); 
  };

  return (
    <div className="w-full mt-4">
      <div className="space-y-4">
        
        {/* সার্চ বার */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="এখানে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-10 text-sm outline-none focus:border-blue-500"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>
        </div>

        {/* 🎯 ৩টি ট্যাব */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveTab("MCQ"); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === "MCQ" ? "bg-blue-600 text-white shadow-md" : "bg-white border text-slate-700 hover:bg-slate-50"
            }`}
          >
            বহুনির্বাচনি
          </button>
          <button
            onClick={() => { setActiveTab("SHORT"); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === "SHORT" ? "bg-emerald-600 text-white shadow-md" : "bg-white border text-slate-700 hover:bg-slate-50"
            }`}
          >
            সংক্ষিপ্ত
          </button>
          <button
            onClick={() => { setActiveTab("CQ"); }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === "CQ" ? "bg-indigo-600 text-white shadow-md" : "bg-white border text-slate-700 hover:bg-slate-50"
            }`}
          >
            সৃজনশীল
          </button>
        </div>

        {/* কন্ট্রোল বাটন */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={selectAll} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
            {selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
            সব নির্বাচন (এই পাতা)
          </button>
          
          <button onClick={handleProceed} className="rounded-xl bg-amber-400 hover:bg-amber-500 px-5 py-2 text-sm font-bold text-amber-950 shadow-sm transition">
            নির্বাচিত প্রশ্ন দেখুন ({selectedIds.length})
          </button>
          
          <button onClick={() => setSelectedIds([])} className="flex items-center gap-1 rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition">
            <Trash2 size={16} /> সব মুছুন
          </button>
        </div>

        {/* প্রশ্ন লিস্ট */}
        <div className="mt-6 space-y-3">
          {filteredQuestions.length === 0 ? (
            <p className="text-center text-slate-500 py-10 font-medium">কোনো প্রশ্ন পাওয়া যায়নি।</p>
          ) : (
            filteredQuestions.map((q) => (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
                <button onClick={() => toggleSelect(q.id)} className="mt-1 text-blue-600">
                  {selectedIds.includes(q.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{q.text || q.stimulus}</p>
                  {activeTab === "MCQ" && q.options && (
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                      <span>(ক) {q.options.A || q.options["ক"]}</span>
                      <span>(খ) {q.options.B || q.options["খ"]}</span>
                      <span>(গ) {q.options.C || q.options["গ"]}</span>
                      <span>(ঘ) {q.options.D || q.options["ঘ"]}</span>
                    </div>
                  )}
                  {activeTab === "CQ" && q.subQuestions && (
                     <div className="mt-2 text-xs text-slate-600 line-clamp-2">
                        <span className="font-bold">উদ্দীপক:</span> {q.stimulus}
                     </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
