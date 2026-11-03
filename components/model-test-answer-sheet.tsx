"use client";

import { useState } from "react";
import MathText from "@/components/MathText";
import type { ExamQuestion } from "@/components/LiveExamPlayer";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function bn(n: number | string) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

const OPTION_LABELS = ["ক", "খ", "গ", "ঘ"];

type Filter = "ALL" | "CORRECT" | "WRONG" | "SKIPPED";

type Props = {
  questions: ExamQuestion[];
  answers: Record<string, number>;
};

export default function ModelTestAnswerSheet({ questions, answers }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openExp, setOpenExp] = useState<Record<number, boolean>>({});

  const items = questions.map((q, i) => {
    const userAns = answers[String(i)];
    const status: "CORRECT" | "WRONG" | "SKIPPED" =
      userAns === undefined
        ? "SKIPPED"
        : userAns === q.correctAnswer
        ? "CORRECT"
        : "WRONG";
    return { q, i, userAns, status };
  });

  const correctCount = items.filter((x) => x.status === "CORRECT").length;
  const wrongCount = items.filter((x) => x.status === "WRONG").length;
  const skippedCount = items.filter((x) => x.status === "SKIPPED").length;

  const visible = items.filter((x) => filter === "ALL" || x.status === filter);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "ALL", label: "সব", count: items.length },
    { key: "CORRECT", label: "সঠিক", count: correctCount },
    { key: "WRONG", label: "ভুল", count: wrongCount },
    { key: "SKIPPED", label: "বাদ", count: skippedCount },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
          <div className="text-xs text-slate-500">সঠিক</div>
          <div className="text-xl font-bold text-emerald-600">{bn(correctCount)}</div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-center">
          <div className="text-xs text-slate-500">ভুল</div>
          <div className="text-xl font-bold text-rose-600">{bn(wrongCount)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <div className="text-xs text-slate-500">উত্তর করেননি</div>
          <div className="text-xl font-bold text-slate-600">{bn(skippedCount)}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold ${
              filter === t.key
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {t.label} ({bn(t.count)})
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            এই ক্যাটাগরিতে কোনো প্রশ্ন নেই।
          </div>
        )}

        {visible.map(({ q, i, userAns, status }) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-base font-bold leading-snug text-slate-900">
                {bn(i + 1)}) <MathText text={q.question} />
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  status === "CORRECT"
                    ? "bg-emerald-100 text-emerald-700"
                    : status === "WRONG"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {status === "CORRECT" ? "✓ সঠিক" : status === "WRONG" ? "✗ ভুল" : "উত্তর করেননি"}
              </span>
            </div>

            <div className="space-y-2">
              {q.options.map((opt, optIndex) => {
                const isCorrectOpt = optIndex === q.correctAnswer;
                const isMyWrong = status === "WRONG" && userAns === optIndex;

                let row = "border-transparent bg-slate-50/60";
                let badge = "bg-slate-200 text-slate-600";

                if (isCorrectOpt) {
                  row = "border-emerald-200 bg-emerald-50 font-semibold text-emerald-900";
                  badge = "bg-emerald-500 text-white";
                } else if (isMyWrong) {
                  row = "border-rose-200 bg-rose-50 font-semibold text-rose-900";
                  badge = "bg-rose-500 text-white";
                }

                return (
                  <div
                    key={optIndex}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 ${row}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}
                    >
                      {OPTION_LABELS[optIndex]}
                    </span>
                    <div className="flex-1 text-sm">
                      <MathText text={opt} />
                    </div>
                    {isCorrectOpt && (
                      <span className="text-[11px] font-bold text-emerald-600">
                        {status === "CORRECT" ? "(আপনার উত্তর ✓)" : "(সঠিক উত্তর)"}
                      </span>
                    )}
                    {isMyWrong && (
                      <span className="text-[11px] font-bold text-rose-600">(আপনার উত্তর)</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setOpenExp((prev) => ({ ...prev, [i]: !prev[i] }))}
                className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {openExp[i] ? "ব্যাখ্যা বন্ধ করুন" : "ব্যাখ্যা"}
              </button>
              {openExp[i] && (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/80 p-3.5 text-xs leading-relaxed text-slate-700">
                  <span className="mb-1 block font-bold text-blue-900">💡 সঠিক উত্তরের ব্যাখ্যা:</span>
                  <MathText text={q.explanation || "এই প্রশ্নের জন্য কোনো অতিরিক্ত ব্যাখ্যা দেওয়া নেই।"} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
