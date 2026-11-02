"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { NCTB_CLASSES, type NctbClass } from "@/lib/nctb-data";

type Pair = { category: string; subject: string };
const LOW = ["1", "2", "3", "4", "5", "6", "7", "8"];
const CHIPS = ["SSC", "HSC", "Admission", "Job"];

// ক্লাস কী (6/7/8/SSC/HSC) দিয়ে lib/nctb-data.ts থেকে সঠিক ক্লাস খুঁজে বের করা
function findClassData(key: string): NctbClass | undefined {
  if (!key) return undefined;
  if (LOW.includes(key)) {
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

// 🎯 ক্লাসের সব সম্ভাব্য নাম (যেমন "8" আর "Class 8" দুটোই)
function categoryAliases(key: string): string[] {
  if (!key) return [];
  const set = new Set<string>([key]);

  if (/^[1-9]$|^1[0-2]$/.test(key)) {
    set.add(`Class ${key}`);
  }
  const m = key.match(/^Class\s*(\d+)$/i);
  if (m) {
    set.add(m[1]);
    set.add(`Class ${m[1]}`);
  }
  if (key === "SSC") {
    ["Class 9", "Class 10", "Class 9-10", "9", "10"].forEach((v) => set.add(v));
  }
  if (key === "HSC") {
    ["Class 11-12", "Class 11", "Class 12", "11", "12"].forEach((v) => set.add(v));
  }
  return Array.from(set);
}

export default function QbStart({ pairs }: { pairs: Pair[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [topicCategory, setTopicCategory] = useState(""); // ক্যাটাগরি/ইউনিট
  const [topic, setTopic] = useState(""); // নির্দিষ্ট টপিক

  const selectedClassData = useMemo(() => findClassData(category), [category]);

  const curriculumSubjects = useMemo(
    () => (selectedClassData ? selectedClassData.subjects.map((s) => s.name) : []),
    [selectedClassData]
  );

  const dbSubjects = useMemo(() => {
    const cats = categoryAliases(category);
    return Array.from(
      new Set(
        pairs
          .filter((p) => !category || cats.includes(p.category))
          .map((p) => p.subject)
      )
    );
  }, [pairs, category]);

  const subjects = useMemo(
    () => Array.from(new Set([...curriculumSubjects, ...dbSubjects])),
    [curriculumSubjects, dbSubjects]
  );

  // নির্বাচিত সাবজেক্টের ডেটা (chapters/subCategories সহ)
  const currentSubjectData = useMemo(
    () => selectedClassData?.subjects.find((s) => s.name === subject),
    [selectedClassData, subject]
  );

  const flatTopics = useMemo(() => currentSubjectData?.chapters ?? [], [currentSubjectData]);
  const groupedTopics = useMemo(() => currentSubjectData?.subCategories ?? [], [currentSubjectData]);
  const hasGroups = groupedTopics.length > 0;

  const topicsInSelectedCategory = useMemo(() => {
    if (!topicCategory) return [];
    const grp = groupedTopics.find((g) => g.category === topicCategory);
    return grp?.topics ?? [];
  }, [groupedTopics, topicCategory]);

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-semibold ${
      active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"
    }`;

  function go() {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (subject) p.set("subject", subject);
    if (hasGroups) {
      if (topicCategory) p.set("topicCategory", topicCategory);
      if (topic) p.set("topic", topic);
    } else if (topic) {
      p.set("topic", topic);
    }
    router.push(`/question-builder/create?${p.toString()}`);
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Class 1-8"
          className={chip(LOW.includes(category)) + " pr-8"}
          value={LOW.includes(category) ? category : ""}
          onChange={(e) => {
            setCategory(e.target.value);
            setSubject("");
            setTopicCategory("");
            setTopic("");
          }}
        >
          <option value="">All Class (1–8th)</option>
          {LOW.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className={chip(category === c)}
            onClick={() => {
              setCategory(category === c ? "" : c);
              setSubject("");
              setTopicCategory("");
              setTopic("");
            }}
          >
            {c === "SSC" ? "SSC (নবম-দশম)" : c === "HSC" ? "HSC (একাদশ-দ্বাদশ)" : c}
          </button>
        ))}
      </div>

      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
        value={subject}
        onChange={(e) => {
          setSubject(e.target.value);
          setTopicCategory("");
          setTopic("");
        }}
      >
        <option value="">— Select Subject —</option>
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* 🎯 দুই-ধাপে ক্যাটাগরি/ইউনিট → টপিক সিলেকশন (subCategories থাকলে) */}
      {hasGroups ? (
        <>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
            value={topicCategory}
            onChange={(e) => {
              setTopicCategory(e.target.value);
              setTopic("");
            }}
          >
            <option value="">-- ইউনিট/ক্যাটাগরি বাছুন --</option>
            {groupedTopics.map((g) => (
              <option key={g.category} value={g.category}>
                {g.category}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm disabled:bg-slate-100"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={!topicCategory}
          >
            <option value="">-- নির্দিষ্ট অধ্যায়/টপিক বাছুন --</option>
            {topicsInSelectedCategory.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </>
      ) : (
        flatTopics.length > 0 && (
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">-- অধ্যায়/টপিক বাছুন (ঐচ্ছিক) --</option>
            {flatTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )
      )}

      <button
        type="button"
        disabled={!subject}
        onClick={go}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        প্রশ্ন তৈরী করুন <ArrowRight size={18} />
      </button>
      {!pairs.length && !curriculumSubjects.length && (
        <p className="text-center text-xs text-slate-500">
          এখনও কোনো প্রশ্ন নেই। আগে /admin/questions থেকে প্রশ্ন যোগ করুন।
        </p>
      )}
    </div>
  );
}
// ===== ফাইল শেষ =====
