"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Trophy, Clock, RefreshCcw, Trash2 } from "lucide-react";
import MathText from "@/components/MathText";

export const toBn = (n: number | string) => n.toString().replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

export interface ExamQuestion {
  id: number | string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface StudentInfo {
  name: string;
  className: string;
  roll: string;
  institution?: string;
}

export interface AttemptResult {
  studentName: string;
  studentClass: string;
  rollNumber: string;
  institution?: string;
  score: number;
  total: number;
  timeSpent: number;
  warnings: number;
  answers?: Record<number, number>;
}

interface LiveExamProps {
  examTitle?: string;
  questions: ExamQuestion[];
  timeInMinutes?: number;
  studentInfo?: StudentInfo;
  isAdmin?: boolean;
  antiCheat?: boolean;
  leaderboardUrl?: string;
  onSubmit?: (result: AttemptResult) => Promise<void>;
}

export default function LiveExamPlayer({
  examTitle = "অনলাইন মডেল টেস্ট",
  questions = [],
  timeInMinutes = 20,
  studentInfo: initialInfo,
  isAdmin = false,
  antiCheat = false,
  leaderboardUrl,
  onSubmit,
}: LiveExamProps) {
  const [isStarted, setIsStarted] = useState(false);
  const [formData, setFormData] = useState<StudentInfo>({
    name: initialInfo?.name || "",
    className: initialInfo?.className || "",
    roll: initialInfo?.roll || "",
    institution: initialInfo?.institution || "",
  });
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(initialInfo || null);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(timeInMinutes * 60);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [viewState, setViewState] = useState<"EXAM" | "RESULT" | "REVIEW" | "LEADERBOARD">("EXAM");
  const [expandedExplanation, setExpandedExplanation] = useState<Record<number, boolean>>({});

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // 🎯 Anti-cheat state
  const [warningCount, setWarningCount] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const hasSubmittedRef = useRef(false);
  const lastViolationRef = useRef(0);

  // সর্বশেষ উত্তর ও সময় ধরে রাখার জন্য (অটো-সাবমিটে পুরোনো ডেটা যাওয়া ঠেকায়)
  const selectedAnswersRef = useRef<Record<number, number>>({});
  const timeLeftRef = useRef(timeInMinutes * 60);
  selectedAnswersRef.current = selectedAnswers;
  timeLeftRef.current = timeLeft;

  const banglaOptions = ["ক", "খ", "গ", "ঘ"];
  const totalSeconds = timeInMinutes * 60;
  const timeSpent = totalSeconds - timeLeft;

  useEffect(() => {
    if (!isStarted || viewState !== "EXAM") return;
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, viewState, isStarted]);

  // 🎯 অ্যান্টি-চিট মনিটরিং: ট্যাব সুইচ, ফুলস্ক্রিন এক্সিট, কপি/রাইট-ক্লিক
  useEffect(() => {
    if (!antiCheat || !isStarted || viewState !== "EXAM") return;

    function registerViolation() {
      const now = Date.now();
      if (now - lastViolationRef.current < 1500) return;
      lastViolationRef.current = now;

      setWarningCount((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          handleFinalSubmit(next);
        } else {
          setShowCheatWarning(true);
        }
        return next;
      });
    }

    function onVisibilityChange() {
      if (document.hidden) registerViolation();
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) registerViolation();
    }
    function blockEvent(e: Event) {
      e.preventDefault();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("copy", blockEvent);
    document.addEventListener("cut", blockEvent);
    document.addEventListener("contextmenu", blockEvent);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", blockEvent);
      document.removeEventListener("cut", blockEvent);
      document.removeEventListener("contextmenu", blockEvent);
    };
  }, [antiCheat, isStarted, viewState]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
  };

  const handleSelectOption = (qIndex: number, optIndex: number) => {
    if (viewState !== "EXAM") return;
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  function requestFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentInfo(formData);
    setIsStarted(true);
    if (antiCheat) {
      requestFullscreen();
    }
  };

  const handleFinalSubmit = async (finalWarnings?: number) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    setShowWarningModal(false);
    setShowCheatWarning(false);
    setViewState("RESULT");

    // সবসময় সর্বশেষ উত্তর ও সময় ব্যবহার করা হচ্ছে
    const answersNow = selectedAnswersRef.current;
    const spentNow = totalSeconds - timeLeftRef.current;

    let correctNow = 0;
    questions.forEach((q, idx) => {
      const ans = answersNow[idx];
      if (ans !== undefined && ans === q.correctAnswer) correctNow++;
    });

    const finalScore = correctNow;
    const warningsUsed = finalWarnings ?? warningCount;

    try {
      if (onSubmit) {
        await onSubmit({
          studentName: studentInfo?.name || "পরীক্ষার্থী",
          studentClass: studentInfo?.className || "সাধারণ",
          rollNumber: studentInfo?.roll || "১",
          institution: studentInfo?.institution || "",
          score: finalScore,
          total: questions.length,
          timeSpent: Math.max(1, spentNow),
          warnings: warningsUsed,
          answers: answersNow,
        });
      } else {
        await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examTitle,
            studentName: studentInfo?.name || "পরীক্ষার্থী",
            studentClass: studentInfo?.className || "সাধারণ",
            rollNumber: studentInfo?.roll || "১",
            institution: studentInfo?.institution || "",
            score: finalScore,
            totalMarks: questions.length,
            timeSpent: Math.max(1, spentNow),
          }),
        });
      }
    } catch (e) {
      console.error("Submit failed:", e);
    }

    if (antiCheat && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    setViewState("LEADERBOARD");
    try {
      const url = leaderboardUrl || `/api/leaderboard?examTitle=${encodeURIComponent(examTitle)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleDeleteCandidate = async (id: string, name: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${name}" এর রেজাল্ট ডিলিট করতে চান?`)) return;

    try {
      const res = await fetch("/api/leaderboard/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        alert("সফলভাবে ডিলিট করা হয়েছে!");
        fetchLeaderboard();
      } else {
        alert("ডিলিট ব্যর্থ: " + data.error);
      }
    } catch (err) {
      alert("নেটওয়ার্ক এরর!");
    }
  };

  let correct = 0;
  questions.forEach((q, idx) => {
    const ans = selectedAnswers[idx];
    if (ans !== undefined && ans === q.correctAnswer) correct++;
  });

  const obtainedMarks = correct;
  const answeredCount = Object.keys(selectedAnswers).length;

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-indigo-700 mb-1">পরীক্ষার তথ্য দিন</h2>
            <p className="text-xs text-slate-500">পরীক্ষা শুরু করার আগে আপনার সঠিক তথ্য দিন</p>
          </div>
          <form onSubmit={handleStartExam} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">শিক্ষার্থীর নাম *</label>
              <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ক্লাস *</label>
              <input required value={formData.className} onChange={(e) => setFormData({ ...formData, className: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">রোল নম্বর *</label>
              <input required value={formData.roll} onChange={(e) => setFormData({ ...formData, roll: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">প্রতিষ্ঠানের নাম (ঐচ্ছিক)</label>
              <input value={formData.institution} onChange={(e) => setFormData({ ...formData, institution: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white" />
            </div>
            {antiCheat && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                ⚠️ এই পরীক্ষায় ফুলস্ক্রিন মোড চালু হবে, ট্যাব পরিবর্তন করা যাবে না এবং কপি/রাইট-ক্লিক বন্ধ থাকবে। ৩ বার নিয়ম ভঙ্গ করলে পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।
              </div>
            )}
            <button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-sm font-bold text-white shadow-md transition">
              পরীক্ষা শুরু করুন
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">

      {antiCheat && viewState === "EXAM" && studentInfo && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none">
          <div className="grid h-[140%] w-[140%] -rotate-[20deg] grid-cols-3 gap-10 opacity-[0.06] -translate-x-10 -translate-y-10">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="whitespace-nowrap text-center text-[11px] font-bold text-slate-900">
                {studentInfo.name} • রোল {toBn(studentInfo.roll)} • {new Date().toLocaleTimeString("bn-BD")}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewState === "EXAM" && (
        <>
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">
              {studentInfo?.name} (রোল: {toBn(studentInfo?.roll || "১")})
            </div>
            <button onClick={() => setShowWarningModal(true)} className="rounded-full bg-indigo-600 hover:bg-indigo-700 px-6 py-1.5 text-sm font-bold text-white shadow-md active:scale-95 transition">
              জমা দিন
            </button>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Clock size={13} className="text-indigo-600" /> {toBn(formatTime(timeLeft))}
              </div>
              <div className="text-[10px] font-bold text-emerald-600">
                {toBn(answeredCount)} / {toBn(questions.length)}
              </div>
            </div>
          </div>

          <div className="mx-4 mt-3 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-medium text-indigo-900">
            ভুল উত্তরের জন্য কোনো নম্বর কাটা যাবে না। শুধু সঠিক উত্তরের জন্য ১ নম্বর পাবেন।
          </div>

          <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
            {questions.map((q, qIndex) => {
              const selectedOpt = selectedAnswers[qIndex];
              return (
                <div key={qIndex} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 leading-relaxed mb-4">
                    {toBn(qIndex + 1)}) <MathText text={q.question} />
                  </h3>
                  <div className="space-y-2.5">
                    {q.options.map((opt, optIndex) => {
                      const isSelected = selectedOpt === optIndex;
                      return (
                        <div key={optIndex} onClick={() => handleSelectOption(qIndex, optIndex)} className={`flex items-center gap-3 rounded-xl p-2.5 cursor-pointer transition ${isSelected ? "bg-indigo-50/90 border border-indigo-300 font-semibold text-indigo-950" : "hover:bg-slate-50 border border-transparent text-slate-800"}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-indigo-600 text-white shadow" : "bg-slate-100 text-slate-600"}`}>
                            {banglaOptions[optIndex]}
                          </span>
                          <div className="text-sm flex-1"><MathText text={opt} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCheatWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border-4 border-red-500 bg-white p-6 text-center shadow-2xl">
            <h2 className="text-xl font-bold text-red-600">⚠️ সতর্কবার্তা ({toBn(warningCount)}/৩)</h2>
            <p className="mt-3 text-sm text-slate-700">
              আপনি পরীক্ষার স্ক্রিন থেকে সরে গিয়েছিলেন অথবা ফুলস্ক্রিন থেকে বের হয়ে গিয়েছিলেন। এটি পরীক্ষার নিয়ম লঙ্ঘন।
              {warningCount >= 2 ? " পরবর্তী বার করলে পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে!" : " অনুগ্রহ করে এই পেজেই থাকুন।"}
            </p>
            <button
              onClick={() => {
                setShowCheatWarning(false);
                requestFullscreen();
              }}
              className="mt-5 w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white"
            >
              বুঝেছি, চালিয়ে যাচ্ছি
            </button>
          </div>
        </div>
      )}

      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">সতর্কবার্তা</h2>
            <div className="my-5 space-y-1.5 text-sm text-slate-600">
              <p>মোট প্রশ্ন: <span className="font-bold text-slate-800">{toBn(questions.length)}টি</span></p>
              <p>উত্তর দিয়েছেন: <span className="font-bold text-emerald-600">{toBn(answeredCount)}টি</span></p>
              <p className="text-red-500 font-bold">বাকি আছে: {toBn(questions.length - answeredCount)}টি</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowWarningModal(false)} className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-3 text-sm font-bold text-slate-700">না</button>
              <button onClick={() => handleFinalSubmit()} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-bold text-white shadow-md">হ্যাঁ, জমা দিন</button>
            </div>
          </div>
        </div>
      )}

      {viewState === "RESULT" && (
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
          <div className="rounded-2xl bg-indigo-600 p-4 text-center text-white font-bold text-lg shadow-md flex items-center justify-between">
            <span className="text-sm font-normal">পরীক্ষার্থী: {studentInfo?.name}</span>
            <span>ফলাফল</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">রোল: {toBn(studentInfo?.roll || "১")}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <div className="text-xs text-slate-600 font-medium">সঠিক উত্তর</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{toBn(correct)}</div>
            </div>
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-center">
              <div className="text-xs text-slate-600 font-medium">ভুল উত্তর</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{toBn(questions.length - correct)}</div>
            </div>
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center">
              <div className="text-xs text-slate-600 font-medium">সময় লেগেছে</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{toBn(formatTime(timeSpent))} মিনিট</div>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center">
              <div className="text-xs text-slate-600 font-medium">আপনার প্রাপ্ত মার্কস</div>
              <div className="text-2xl font-bold mt-1 text-indigo-600">{toBn(obtainedMarks)}</div>
            </div>
          </div>
          <div className="space-y-2.5 pt-2">
            <button onClick={fetchLeaderboard} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3.5 text-sm font-bold shadow-md transition active:scale-98">
              <Trophy size={18} /> <span>মেরিট লিস্ট / লিডারবোর্ড দেখুন</span>
            </button>
            <button onClick={() => setViewState("REVIEW")} className="w-full rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 py-3 text-sm font-bold text-indigo-900 transition">উত্তরপত্র দেখুন</button>
            {!onSubmit && (
              <button onClick={() => window.location.reload()} className="w-full rounded-2xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-600 transition">নতুন পরীক্ষা দিন</button>
            )}
          </div>
        </div>
      )}

      {viewState === "LEADERBOARD" && (
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-700 p-4 text-white shadow-md flex items-center justify-between">
            <button onClick={() => setViewState("RESULT")} className="p-1 rounded-lg hover:bg-white/10">
              <ArrowLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-base font-bold flex items-center justify-center gap-1.5">
                <Trophy size={18} className="text-amber-300" /> মেরিট লিস্ট
              </h2>
              <p className="text-[11px] text-blue-200 truncate max-w-[200px]">{examTitle}</p>
            </div>
            <button onClick={fetchLeaderboard} className="p-1.5 rounded-lg hover:bg-white/10 text-xs">
              <RefreshCcw size={16} />
            </button>
          </div>

          {loadingLeaderboard ? (
            <div className="text-center py-12 text-sm text-slate-500">লিডারবোর্ড লোড হচ্ছে...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 text-sm text-slate-500">
              এখনো কোনো রেজাল্ট জমা পড়েনি।
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {leaderboard.slice(0, 3).map((u, i) => {
                  const medals = ["🥇 ১ম স্থান", "🥈 ২য় স্থান", "🥉 ৩য় স্থান"];
                  const colors = ["border-amber-300 bg-amber-50/70", "border-slate-300 bg-slate-50/70", "border-orange-300 bg-orange-50/70"];
                  return (
                    <div key={i} className={`rounded-2xl border p-2.5 text-center shadow-xs flex flex-col justify-between ${colors[i]}`}>
                      <span className="text-[11px] font-bold text-slate-700">{medals[i]}</span>
                      <div className="my-1.5">
                        <div className="text-xs font-bold text-slate-900 truncate">{u.studentName}</div>
                        <div className="text-[10px] text-slate-500">রোল: {toBn(u.rollNumber)}</div>
                      </div>
                      <div className="text-sm font-extrabold text-indigo-700">{toBn(u.score)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between">
                  <span>র‍্যাংক ও নাম</span>
                  <span>মার্কস ও সময়</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {leaderboard.map((item, idx) => {
                    const isMe = item.studentName === studentInfo?.name && String(item.rollNumber) === String(studentInfo?.roll);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 text-xs transition ${
                          isMe ? "bg-indigo-50/80 font-semibold border-l-4 border-indigo-600" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-slate-400 text-white" : idx === 2 ? "bg-orange-400 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate flex items-center gap-1">
                              {item.studentName} {isMe && <span className="text-[10px] text-indigo-600 font-bold">(আপনি)</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              রোল: {toBn(item.rollNumber)} {item.institution ? `• ${item.institution}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <div className="font-bold text-indigo-600 text-sm">{toBn(item.score)}</div>
                            <div className="text-[10px] text-slate-400">{toBn(formatTime(item.timeSpent))} মি.</div>
                          </div>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteCandidate(item.id, item.studentName)}
                              className="p-1.5 ml-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                              title="Delete Candidate"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <button onClick={() => setViewState("RESULT")} className="w-full rounded-2xl bg-slate-100 hover:bg-slate-200 py-3 text-xs font-bold text-slate-700 transition">
            ফলাফলে ফিরে যান
          </button>
        </div>
      )}

      {viewState === "REVIEW" && (
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
          <div className="rounded-2xl bg-indigo-600 p-4 text-center text-white font-bold text-lg shadow-md flex items-center justify-between">
            <button onClick={() => setViewState("RESULT")} className="p-1 rounded-lg hover:bg-white/10">
              <ArrowLeft size={20} />
            </button>
            <span>উত্তরপত্র</span>
            <div className="w-5" />
          </div>

          <div className="space-y-4">
            {questions.map((q, qIndex) => {
              const userAns = selectedAnswers[qIndex];
              const isUnanswered = userAns === undefined;
              const isCorrect = userAns === q.correctAnswer;
              const showExp = expandedExplanation[qIndex];

              return (
                <div key={qIndex} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {toBn(qIndex + 1)}) <MathText text={q.question} />
                    </h3>
                    {isUnanswered && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        উত্তর করেননি
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, optIndex) => {
                      const isThisCorrect = optIndex === q.correctAnswer;
                      const isThisUserWrong = !isCorrect && userAns === optIndex;

                      let rowClass = "border-transparent bg-slate-50/50";
                      let badgeClass = "bg-slate-200 text-slate-600";

                      if (isThisCorrect) {
                        rowClass = "bg-amber-100/70 border border-amber-200 font-semibold text-amber-950";
                        badgeClass = "bg-amber-300 text-amber-900";
                      } else if (isThisUserWrong) {
                        rowClass = "bg-rose-100/70 border border-rose-200 text-rose-950 font-semibold";
                        badgeClass = "bg-rose-500 text-white";
                      }

                      return (
                        <div key={optIndex} className={`flex items-center gap-3 rounded-xl p-2.5 border transition ${rowClass}`}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badgeClass}`}>
                            {banglaOptions[optIndex]}
                          </span>
                          <div className="text-sm flex-1">
                            <MathText text={opt} />
                          </div>
                          {isThisUserWrong && <span className="text-[11px] font-bold text-red-600">(আপনার উত্তর)</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setExpandedExplanation((prev) => ({ ...prev, [qIndex]: !prev[qIndex] }))}
                      className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-700 transition"
                    >
                      {showExp ? "ব্যাখ্যা বন্ধ করুন" : "ব্যাখ্যা"}
                    </button>
                    {showExp && (
                      <div className="mt-3 rounded-xl bg-blue-50/80 border border-blue-100 p-3.5 text-xs text-slate-700 leading-relaxed">
                        <span className="font-bold text-blue-900 block mb-1">💡 সঠিক উত্তরের ব্যাখ্যা:</span>
                        <MathText text={q.explanation || "এই প্রশ্নের জন্য কোনো অতিরিক্ত ব্যাখ্যা দেওয়া নেই।"} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
