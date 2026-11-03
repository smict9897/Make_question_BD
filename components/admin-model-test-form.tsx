"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { NCTB_CLASSES } from "@/lib/nctb-data";
import { createModelTest, updateModelTest } from "@/app/actions/model-test";

const f = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const label = "mb-1 block text-sm font-semibold text-slate-700";

type ExistingTest = {
  id: string;
  title: string;
  className: string;
  subject: string;
  chapter: string;
  difficulty: string;
  language: string;
  minutes: number;
  isPaid: boolean;
  status: string;
  startAt: Date | string;
  endAt: Date | string;
  attemptCount: number;
};

function toLocalInputValue(d: Date | string) {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 🎯 datetime-local এর naive string কে সঠিক টাইমজোনসহ ISO তে কনভার্ট করে
function localInputToIso(value: string) {
  if (!value) return value;
  const date = new Date(value); // ব্রাউজার এটাকে ইউজারের লোকাল টাইমজোন ধরেই পার্স করে — এটাই সঠিক
  return date.toISOString();
}

export default function AdminModelTestForm({ existing }: { existing?: ExistingTest }) {
  const isEdit = !!existing;
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const initialParts = existing?.chapter?.includes(" - ")
    ? existing.chapter.split(" - ")
    : [null, existing?.chapter ?? ""];

  const [className, setClassName] = useState(existing?.className ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [topicCategory, setTopicCategory] = useState(initialParts[0] ?? "");
  const [topic, setTopic] = useState(initialParts.length > 1 ? initialParts[1] ?? "" : "");
  const [isPaid, setIsPaid] = useState(existing?.isPaid ?? false);
  const [regenerate, setRegenerate] = useState(false);

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

  const hasAttempts = (existing?.attemptCount ?? 0) > 0;

  const action = isEdit ? updateModelTest : createModelTest;

  function handleSubmitClick(status: "DRAFT" | "PUBLISHED") {
    if (isPending) return;

    if (isEdit && regenerate) {
      const ok = window.confirm(
        hasAttempts
          ? `⚠️ এই টেস্টে ${existing?.attemptCount} জন ইতিমধ্যে অংশ নিয়েছে। নতুন প্রশ্ন জেনারেট করলে তাদের সব ফলাফল স্থায়ীভাবে মুছে যাবে এবং লিডারবোর্ড রিসেট হবে। আপনি কি নিশ্চিতভাবে এগোতে চান?`
          : "নতুন প্রশ্ন জেনারেট করা হবে। এগোতে চান?"
      );
      if (!ok) return;
    }

    if (!formRef.current) return;

    const fd = new FormData(formRef.current);
    fd.set("status", status);

    // 🎯 টাইমজোন ফিক্স — সঠিক ISO (UTC) ফরম্যাটে কনভার্ট করে পাঠানো হচ্ছে
    const startAtRaw = fd.get("startAt") as string;
    const endAtRaw = fd.get("endAt") as string;
    if (startAtRaw) fd.set("startAt", localInputToIso(startAtRaw));
    if (endAtRaw) fd.set("endAt", localInputToIso(endAtRaw));

    startTransition(() => {
      action(fd);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-4"
    >
      {isEdit && <input type="hidden" name="id" value={existing!.id} />}
      <input type="hidden" name="className" value={className} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="chapter" value={finalChapter} />

      <div>
        <label className={label}>টেস্টের টাইটেল *</label>
        <input name="title" required defaultValue={existing?.title} className={f} placeholder="যেমন: মডেল টেস্ট - সাধারণ জ্ঞান (প্রথম পর্ব)" />
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
          <select name="difficulty" className={f} required defaultValue={existing?.difficulty ?? "MEDIUM"}>
            <option value="EASY">সহজ</option>
            <option value="MEDIUM">মাঝারি</option>
            <option value="HARD">কঠিন</option>
          </select>
        </div>
        <div>
          <label className={label}>ভাষা *</label>
          <select name="language" className={f} required defaultValue={existing?.language ?? "Bengali"}>
            <option value="Bengali">বাংলা</option>
            <option value="English">English</option>
          </select>
        </div>
        <div>
          <label className={label}>প্রশ্ন সংখ্যা *</label>
          <input name="count" type="number" min={5} max={100} defaultValue={20} className={f} required />
          {isEdit && (
            <p className="mt-1 text-xs text-amber-600">
              * শুধু &quot;নতুন প্রশ্ন জেনারেট&quot; চালু করলেই এই সংখ্যা কার্যকর হবে।
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>সময় (মিনিট) *</label>
          <input name="minutes" type="number" min={1} max={240} defaultValue={existing?.minutes ?? 30} className={f} required />
        </div>
        <div>
          <label className={label}>শুরুর তারিখ ও সময় *</label>
          <input
            name="startAt"
            type="datetime-local"
            className={f}
            required
            defaultValue={existing ? toLocalInputValue(existing.startAt) : undefined}
          />
        </div>
        <div>
          <label className={label}>শেষের তারিখ ও সময় *</label>
          <input
            name="endAt"
            type="datetime-local"
            className={f}
            required
            defaultValue={existing ? toLocalInputValue(existing.endAt) : undefined}
          />
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

      {isEdit && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <input
            type="checkbox"
            id="regenerate"
            name="regenerate"
            checked={regenerate}
            onChange={(e) => setRegenerate(e.target.checked)}
            className="h-5 w-5 rounded border-amber-400"
          />
          <label htmlFor="regenerate" className="text-sm font-semibold text-amber-800 select-none">
            ⚠️ নতুন প্রশ্ন জেনারেট করুন (এটি করলে আগের সব ফলাফল মুছে যাবে)
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSubmitClick("DRAFT")}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? "অপেক্ষা করুন..." : "খসড়া হিসেবে রাখুন"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSubmitClick("PUBLISHED")}
          className="rounded-xl bg-royal px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "অপেক্ষা করুন..." : isEdit ? "আপডেট ও প্রকাশ করুন" : "প্রকাশ করুন (Publish)"}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        * প্রশ্ন তৈরি হতে ১০-৩০ সেকেন্ড সময় লাগতে পারে। সাবমিট করার পর পেজ পরিবর্তন না করে অপেক্ষা করুন।
      </p>
    </form>
  );
}
