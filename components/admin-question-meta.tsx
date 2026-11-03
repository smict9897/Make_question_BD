"use client";
import { useMemo, useState } from "react";
import { NCTB_CLASSES, type NctbClass } from "../lib/nctb-data";

const CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "SSC", "HSC", "Admission", "Job"];
const OTHER = "__other__";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700";

const LOW = ["1", "2", "3", "4", "5", "6", "7", "8"];

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

export default function AdminQuestionMeta() {
  const [category, setCategory] = useState("SSC");
  const [subjSel, setSubjSel] = useState("");
  const [subjOther, setSubjOther] = useState("");

  // টপিক সিলেকশনের জন্য state (ক্যাটাগরি/ইউনিট + নির্দিষ্ট টপিক)
  const [topCatSel, setTopCatSel] = useState(""); // subCategories থাকলে ইউনিট/ক্যাটাগরি
  const [topSel, setTopSel] = useState("");
  const [topOther, setTopOther] = useState("");

  const selectedClassData = useMemo(() => findClassData(category), [category]);

  const subjects = useMemo(
    () => (selectedClassData ? selectedClassData.subjects.map((s) => s.name) : []),
    [selectedClassData]
  );

  const subjIsOther = subjSel === OTHER || subjects.length === 0;
  const subject = subjIsOther ? subjOther.trim() : subjSel;

  const currentSubjectData = useMemo(
    () => selectedClassData?.subjects.find((s) => s.name === subjSel),
    [selectedClassData, subjSel]
  );

  const flatChapters = useMemo(() => currentSubjectData?.chapters ?? [], [currentSubjectData]);
  const groupedTopics = useMemo(() => currentSubjectData?.subCategories ?? [], [currentSubjectData]);
  const hasGroups = groupedTopics.length > 0;

  const topicsInSelectedCategory = useMemo(() => {
    if (!topCatSel) return [];
    const grp = groupedTopics.find((g) => g.category === topCatSel);
    return grp?.topics ?? [];
  }, [groupedTopics, topCatSel]);

  // hasGroups হলে topicsInSelectedCategory থেকে, নাহলে flatChapters থেকে অপশন আসবে
  const chapterOptions = hasGroups ? topicsInSelectedCategory : flatChapters;

  const topIsOther =
    topSel === OTHER || (subject !== "" && chapterOptions.length === 0 && (!hasGroups || !!topCatSel));
  const topic = topIsOther ? topOther.trim() : topSel;

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        name="category"
        className={input}
        required
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          setSubjSel("");
          setSubjOther("");
          setTopCatSel("");
          setTopSel("");
          setTopOther("");
        }}
      >
        {CLASSES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Subject */}
      {subjects.length > 0 ? (
        <select
          className={input}
          value={subjSel}
          onChange={(e) => {
            setSubjSel(e.target.value);
            setSubjOther("");
            setTopCatSel("");
            setTopSel("");
            setTopOther("");
          }}
        >
          <option value="">বিষয় বাছুন</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={OTHER}>অন্য (নিজে লিখুন)</option>
        </select>
      ) : (
        <input
          name="subject"
          placeholder="বিষয় (যেমন: গণিত)"
          className={input}
          required
          value={subjOther}
          onChange={(e) => setSubjOther(e.target.value)}
        />
      )}

      {subjIsOther && subjects.length > 0 && (
        <input
          className={input + " col-span-2"}
          placeholder="বিষয়ের নাম লিখুন"
          value={subjOther}
          onChange={(e) => setSubjOther(e.target.value)}
          required
        />
      )}

      {/* 🎯 ইউনিট/ক্যাটাগরি (শুধু subCategories থাকলে দেখাবে) */}
      {hasGroups && (
        <select
          className={input}
          value={topCatSel}
          onChange={(e) => {
            setTopCatSel(e.target.value);
            setTopSel("");
            setTopOther("");
          }}
        >
          <option value="">ইউনিট/ক্যাটাগরি বাছুন</option>
          {groupedTopics.map((g) => (
            <option key={g.category} value={g.category}>
              {g.category}
            </option>
          ))}
        </select>
      )}

      {/* Chapter / Topic */}
      {chapterOptions.length > 0 ? (
        <select
          className={input}
          value={topSel}
          onChange={(e) => {
            setTopSel(e.target.value);
            setTopOther("");
          }}
          disabled={hasGroups && !topCatSel}
        >
          <option value="">অধ্যায় বাছুন</option>
          {chapterOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={OTHER}>অন্য (নিজে লিখুন)</option>
        </select>
      ) : (
        !hasGroups && (
          <input
            name="topic"
            placeholder="অধ্যায়"
            className={input}
            value={topOther}
            onChange={(e) => setTopOther(e.target.value)}
          />
        )
      )}

      {topIsOther && chapterOptions.length > 0 && (
        <input
          className={input}
          placeholder="অধ্যায়ের নাম লিখুন"
          value={topOther}
          onChange={(e) => setTopOther(e.target.value)}
        />
      )}

      <input name="source" placeholder="বোর্ড-সাল (যেমন: ঢাকা বোর্ড ২০২৬)" className={input} />
      <select name="difficulty" className={input} defaultValue="MEDIUM">
        <option value="EASY">Easy</option>
        <option value="MEDIUM">Medium</option>
        <option value="HARD">Hard</option>
      </select>
      <select name="lang" className={input}>
        <option value="Bangla">Bangla</option>
        <option value="English">English</option>
      </select>

      {/* final values for the form */}
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="topic" value={topic} />
    </div>
  );
}
