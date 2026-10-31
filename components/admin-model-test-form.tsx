"use client";

import { useMemo, useState } from "react";
import { NCTB_CLASSES } from "@/lib/nctb-data";
import { createModelTest } from "@/app/actions/model-test";

const f = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const label = "mb-1 block text-sm font-semibold text-slate-700";

export default function AdminModelTestForm() {
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [topicCategory, setTopicCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  const selectedClassData = useMemo(
    () => NCTB_CLASSES.find((c) => c.class === className),
    [className]
  );

  const currentSubjectData = useMemo(
    () => selectedClassData?.subjects.find((s) => s.name === subject),
    [selectedClassData, subject]
  );

  const flatChapters = useMemo(() => currentSubjectData?.chapters ?? [], [currentSubjectData]);
  const groupedTopics = useMemo(() => currentSubjectData?.subCategories ?? [], [currentSubjectData]);
  const hasGroups = groupedTopics.length > 0;

  const topicsInSelectedCategory = useMemo(() => {
    if (!topicCategory) return [];
    return groupedTopics.find((g) => g.category === topicCategory)?.topics ?? [];
  }, [groupedTopics, topicCategory]);

  const finalChapter = hasGroups
    ? topic
      ? `${topicCategory} - ${topic}`
      : ""
    : topic;

  return (
    <form action={createModelTest} className="grid gap-4">
      {/* Hidden fields that carry final resolved values */}
      <input type="hidden" name="className" value={className} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="chapter" value={finalChapter} />

      <div>
        <label className={label}>টেস্টের টাইটেল *</label>
        <input name="title" required className={f} placeholder="যেমন: মডেল টেস্ট - সাধারণ জ্ঞান (প্রথম পর্ব)" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>ক্লাস *</label>
          <select
            className={f}
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              setSubject("");
              setTopicCategory("");
              setTopic("");
            }}
            required
          >
            <option value="">-- ক্লাস নির্বাচন করুন --</option>
            {NCTB_CLASSES.map((c) => (
              <option key={c.class} value={c.class}>{c.class}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>বিষয় *</label>
          <select
            className={f}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setTopicCategory("");
              setTopic("");
            }}
            disabled={!className}
            required
          >
            <option value="">-- বিষয় নির্বাচন করুন --</option>
            {selectedClassData?.subjects.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {hasGroups ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>ইউনিট / ক্যাটাগরি *</label>
            <select
              className={f}
              value={topicCategory}
              onChange={(e) => {
                setTopicCategory(e.target.value);
                setTopic("");
              }}
              disabled={!subject}
              required
            >
              <option value="">-- ক্যাটাগরি নির্বাচন করুন --</option>
              {groupedTopics.map((g) => (
                <option key={g.category} value={g.category}>{g.category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>অধ্যায় / টপিক *</label>
            <select
              className={f}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!topicCategory}
              required
            >
              <option value="">-- টপিক নির্বাচন করুন --</option>
              {topicsInSelectedCategory.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className={label}>অধ্যায় *</label>
          <select
            className={f}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={!subject}
            required
          >
            <option value="">-- অধ্যায় নির্বাচন করুন --</option>
            {flatChapters.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>কঠিনতা *</label>
          <select name="difficulty" className={f} required defaultValue="MEDIUM">
            <option value="EASY">সহজ</option>
            <option value="MEDIUM">মাঝারি</option>
            <option value="HARD">কঠিন</option>
          </select>
        </div>
        <div>
          <label className={label}>ভাষা *</label>
          <select name="language" className={f} required defaultValue="Bengali">
            <option value="Bengali">বাংলা</option>
            <option value="English">English</option>
          </select>
        </div>
        <div>
          <label className={label}>প্রশ্ন সংখ্যা *</label>
          <input name="count" type="number" min={5} max={100} defaultValue={20} className={f} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>সময় (মিনিট) *</label>
          <input name="minutes" type="number" min={1} max={240} defaultValue={30} className={f} required />
        </div>
        <div>
          <label className={label}>শুরুর তারিখ ও সময় *</label>
          <input name="startAt" type="datetime-local" className={f} required />
        </div>
        <div>
          <label className={label}>শেষের তারিখ ও সময় *</label>
          <input name="endAt" type="datetime-local" className={f} required />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
        <input
          type="checkbox"
          id="isPaid"
          name="isPaid"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300"
        />
        <label htmlFor="isPaid" className="text-sm font-semibold text-slate-700 select-none">
          এটি একটি পেইড (Paid) মডেল টেস্ট
        </label>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          name="status"
          value="DRAFT"
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          খসড়া হিসেবে রাখুন
        </button>
        <button
          type="submit"
          name="status"
          value="PUBLISHED"
          className="rounded-xl bg-royal px-5 py-2.5 font-semibold text-white hover:opacity-90"
        >
          প্রকাশ করুন (Publish)
        </button>
      </div>

      <p className="text-xs text-slate-500">
        * প্রশ্ন তৈরি হতে ১০-৩০ সেকেন্ড সময় লাগতে পারে। সাবমিট করার পর পেজ পরিবর্তন না করে অপেক্ষা করুন।
      </p>
    </form>
  );
}
