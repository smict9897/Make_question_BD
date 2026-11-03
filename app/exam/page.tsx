"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, Zap, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import LiveExamPlayer, { ExamQuestion } from "@/components/LiveExamPlayer";
import { NCTB_CLASSES } from "@/lib/nctb-data";

const classLabelMap: Record<string, string> = {
  "Class 6": "৬ষ্ঠ শ্রেণি (Class 6)",
  "Class 7": "৭ম শ্রেণি (Class 7)",
  "Class 8": "৮ম শ্রেণি (Class 8)",
  "Class 9": "এসএসসি (Class 9-10)",
  "Class 9-10": "এসএসসি (Class 9-10)",
  "Class 11-12": "এইচএসসি (Class 11-12)",
};

function getClassLabel(c: string) {
  if (classLabelMap[c]) return classLabelMap[c];
  if (/9|10/.test(c)) return `এসএসসি (${c})`;
  if (/11|12/.test(c)) return `এইচএসসি (${c})`;
  return c;
}

export default function ExamPage() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopicCategory, setSelectedTopicCategory] = useState(""); // 🎯 ইউনিট/ক্যাটাগরি
  const [selectedChapter, setSelectedChapter] = useState("");
  const [customChapter, setCustomChapter] = useState("");
  const [difficulty, setDifficulty] = useState("মাঝারি");
  const [count, setCount] = useState("20");
  const [language, setLanguage] = useState("বাংলা");

  const [loading, setLoading] = useState(false);
  const [examReady, setExamReady] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const availableSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const foundClass = NCTB_CLASSES.find((c) => c.class === selectedClass);
    return foundClass ? foundClass.subjects : [];
  }, [selectedClass]);

  const currentSubjectData = useMemo(() => {
    return availableSubjects.find((s) => s.name === selectedSubject);
  }, [availableSubjects, selectedSubject]);

  const flatChapters = useMemo(() => currentSubjectData?.chapters ?? [], [currentSubjectData]);
  const groupedTopics = useMemo(() => currentSubjectData?.subCategories ?? [], [currentSubjectData]);
  const hasGroups = groupedTopics.length > 0;

  const topicsInSelectedCategory = useMemo(() => {
    if (!selectedTopicCategory) return [];
    const grp = groupedTopics.find((g) => g.category === selectedTopicCategory);
    return grp?.topics ?? [];
  }, [groupedTopics, selectedTopicCategory]);

  // 🎯 ড্রপডাউনে দেখানোর জন্য চূড়ান্ত তালিকা
  const availableChapters = hasGroups ? topicsInSelectedCategory : flatChapters;

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject) {
      setErrorMsg("দয়া করে ক্লাস এবং বিষয় নির্বাচন করুন।");
      return;
    }

    let finalChapter: string;
    if (selectedChapter === "custom") {
      finalChapter = customChapter;
    } else if (hasGroups) {
      finalChapter = selectedChapter
        ? (selectedTopicCategory ? `${selectedTopicCategory} - ${selectedChapter}` : selectedChapter)
        : "সম্পূর্ণ বই / সিলেবাস";
    } else {
      finalChapter = selectedChapter || customChapter || "সম্পূর্ণ বই / সিলেবাস";
    }

    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          className: selectedClass,
          subject: selectedSubject,
          chapter: finalChapter,
          difficulty,
          count: parseInt(count),
          language,
        }),
      });

      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setExamReady(true);
      } else {
        setErrorMsg("প্রশ্ন তৈরি করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
      }
    } catch (err) {
      setErrorMsg("সার্ভারে সমস্যা হয়েছে। ইন্টারনেট কানেকশন চেক করুন।");
    } finally {
      setLoading(false);
    }
  };

  if (examReady && questions.length > 0) {
    const finalChapterText =
      selectedChapter === "custom"
        ? customChapter
        : hasGroups
        ? [selectedTopicCategory, selectedChapter].filter(Boolean).join(" - ")
        : selectedChapter;
    return (
      <LiveExamPlayer
        examTitle={`${selectedClass} • ${selectedSubject} ${finalChapterText ? `(${finalChapterText})` : ""}`}
        questions={questions}
        timeInMinutes={parseInt(count)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <Zap size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">এক ক্লিকে প্রশ্ন তৈরি করুন</h2>
              <p className="text-xs text-emerald-100">ক্লাস, বিষয় ও অধ্যায় দিন, AI প্রশ্ন বানিয়ে দেবে</p>
            </div>
          </div>
          <ArrowRight size={20} className="text-emerald-200" />
        </div>

        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-sm">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
            এক ক্লিকে প্রশ্ন তৈরি করুন <span className="text-blue-600">(AI)</span>
          </h1>

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleStartExam} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ক্লাস</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSubject("");
                  setSelectedTopicCategory("");
                  setSelectedChapter("");
                  setCustomChapter("");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 shadow-xs"
              >
                <option value="">ক্লাস বাছুন</option>
                {NCTB_CLASSES.map((c) => (
                  <option key={c.class} value={c.class}>
                    {getClassLabel(c.class)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">বিষয়</label>
              <select
                disabled={!selectedClass}
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedTopicCategory("");
                  setSelectedChapter("");
                  setCustomChapter("");
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none shadow-xs ${
                  !selectedClass ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white text-slate-800 border-slate-200 focus:border-blue-500"
                }`}
              >
                <option value="">{selectedClass ? "বিষয় নির্বাচন করুন" : "আগে ক্লাস বাছুন"}</option>
                {availableSubjects.map((sub) => (
                  <option key={sub.name} value={sub.name}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* 🎯 ইউনিট/ক্যাটাগরি (শুধু subCategories থাকলে দেখাবে) */}
            {selectedSubject && hasGroups && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ইউনিট/ক্যাটাগরি</label>
                <select
                  value={selectedTopicCategory}
                  onChange={(e) => {
                    setSelectedTopicCategory(e.target.value);
                    setSelectedChapter("");
                    setCustomChapter("");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 shadow-xs"
                >
                  <option value="">ইউনিট/ক্যাটাগরি বাছুন</option>
                  {groupedTopics.map((g) => (
                    <option key={g.category} value={g.category}>{g.category}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">অধ্যায়</label>
              {hasGroups && !selectedTopicCategory ? (
                <select disabled className="w-full rounded-2xl border px-4 py-3 text-sm bg-slate-50 text-slate-400 border-slate-200">
                  <option>আগে ইউনিট/ক্যাটাগরি বাছুন</option>
                </select>
              ) : availableChapters.length > 0 ? (
                <select
                  disabled={!selectedSubject}
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none shadow-xs ${
                    !selectedSubject ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white text-slate-800 border-slate-200 focus:border-blue-500"
                  }`}
                >
                  <option value="">সম্পূর্ণ বই / সকল অধ্যায়</option>
                  {availableChapters.map((chap) => (
                    <option key={chap} value={chap}>{chap}</option>
                  ))}
                  <option value="custom">✏️ নিজের মতো টপিক লিখুন...</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={selectedSubject ? "অধ্যায় বা টপিকের নাম লিখুন (ঐচ্ছিক)" : "আগে বিষয় দিন"}
                  disabled={!selectedSubject}
                  value={customChapter}
                  onChange={(e) => setCustomChapter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              )}

              {selectedChapter === "custom" && (
                <input
                  type="text"
                  placeholder="নির্দিষ্ট কোনো টপিক বা অধ্যায়ের নাম লিখুন..."
                  value={customChapter}
                  onChange={(e) => setCustomChapter(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-blue-300 bg-blue-50/30 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500"
                  autoFocus
                />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">কঠিনতা</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="সহজ">সহজ</option>
                  <option value="মাঝারি">মাঝারি</option>
                  <option value="কঠিন">কঠিন</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">প্রশ্ন সংখ্যা</label>
                <select
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                  <option value="25">25</option>
                  <option value="30">30</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ভাষা</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="বাংলা">বাংলা</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>জেমিনি AI দিয়ে প্রশ্ন তৈরি হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>এক ক্লিকে প্রশ্ন তৈরি ও পরীক্ষা শুরু করুন</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
