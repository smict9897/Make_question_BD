"use client";
import { useState, useEffect } from "react";
import { NCTB_CLASSES } from "@/lib/nctb-data";

function createSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function CategorySelector({
  cats,
  initialCategoryId,
  initialChapter,
}: {
  cats: { id: string; name: string; slug?: string }[];
  initialCategoryId?: string | null;
  initialChapter?: string | null;
}) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [chapter, setChapter] = useState(initialChapter || "");
  const [categoryId, setCategoryId] = useState(initialCategoryId || "");

  useEffect(() => {
    if (initialCategoryId) {
      const cat = cats.find((c) => c.id === initialCategoryId);
      if (cat) {
        for (const cls of NCTB_CLASSES) {
          if (cat.slug?.startsWith(createSlug(cls.class))) {
            setSelectedClass(cls.class);
            setSelectedSubject(cat.name);
            break;
          }
        }
      }
    }
  }, [initialCategoryId, cats]);

  const currentClassData = NCTB_CLASSES.find((c) => c.class === selectedClass);
  const subjects = currentClassData ? currentClassData.subjects : [];
  const currentSubjectData = subjects.find((s) => s.name === selectedSubject);

  // ফ্ল্যাট চ্যাপ্টার লিস্ট
  const flatChapters = currentSubjectData?.chapters ?? [];
  // গ্রুপ করা সাব-ক্যাটাগরি লিস্ট (যেমন: গদ্য, পদ্য ইত্যাদি)
  const groupedChapters = currentSubjectData?.subCategories ?? [];

  const hasChapterOptions = flatChapters.length > 0 || groupedChapters.length > 0;

  const handleSubjectChange = (subName: string) => {
    setSelectedSubject(subName);
    setChapter("");
    const classSlug = createSlug(selectedClass);
    const expectedSlug = `${classSlug}-${createSlug(subName)}`;
    const matchedCat = cats.find((c) => c.slug === expectedSlug || (c.name === subName && c.slug?.startsWith(classSlug)));
    if (matchedCat) setCategoryId(matchedCat.id);
    else setCategoryId("");
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
      <p className="text-sm font-semibold text-slate-800">শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করুন</p>
      
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="chapter" value={chapter} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">১. শ্রেণি (Class)</span>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSubject("");
              setChapter("");
              setCategoryId("");
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-royal focus:outline-none"
          >
            <option value="">-- শ্রেণি বাছুন --</option>
            {NCTB_CLASSES.map((c) => (
              <option key={c.class} value={c.class}>{c.class}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">২. বিষয় (Subject)</span>
          <select
            value={selectedSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            disabled={!selectedClass}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:border-royal focus:outline-none"
          >
            <option value="">-- বিষয় বাছুন --</option>
            {subjects.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">৩. অধ্যায় (Chapter)</span>
          <select
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            disabled={!hasChapterOptions}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:border-royal focus:outline-none"
          >
            <option value="">-- অধ্যায় বাছুন --</option>

            {/* ফ্ল্যাট চ্যাপ্টার থাকলে সরাসরি দেখাবে */}
            {flatChapters.map((ch) => (
              <option key={ch} value={ch}>{ch}</option>
            ))}

            {/* সাব-ক্যাটাগরি (গ্রুপ) থাকলে optgroup আকারে দেখাবে */}
            {groupedChapters.map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.topics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {selectedSubject && !categoryId && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
          ⚠️ ডাটাবেসে "{selectedClass} - {selectedSubject}" এর জন্য কোনো ক্যাটাগরি খুঁজে পাওয়া যায়নি।
        </p>
      )}
    </div>
  );
}
