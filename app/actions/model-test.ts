"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { auth } from "@/auth";
import { generateMcqQuestions } from "@/lib/model-test-ai";
import type { AiQuestion } from "@/lib/model-test-ai";
import { NCTB_CLASSES } from "@/lib/nctb-data";

const baseSchema = z.object({
  title: z.string().min(3, "টাইটেল কমপক্ষে ৩ অক্ষর হতে হবে"),
  className: z.string().min(1, "ক্লাস নির্বাচন করুন"),
  subject: z.string().min(1, "বিষয় নির্বাচন করুন"),
  chapter: z.string().min(1, "অধ্যায়/টপিক নির্বাচন করুন"),
  difficulty: z.string().min(1),
  language: z.string().min(1),
  count: z.coerce.number().int().min(5).max(100),
  minutes: z.coerce.number().int().min(1).max(240),
  startAt: z.string().min(1, "শুরুর সময় দিন"),
  endAt: z.string().min(1, "শেষ সময় দিন"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

const FIELDS = [
  "title",
  "className",
  "subject",
  "chapter",
  "difficulty",
  "language",
  "count",
  "minutes",
  "startAt",
  "endAt",
  "status",
] as const;

function readForm(fd: FormData) {
  const obj: Record<string, FormDataEntryValue | null> = {};
  for (const key of FIELDS) {
    obj[key] = fd.get(key);
  }
  return obj;
}

function parseTimes(startStr: string, endStr: string) {
  const startAt = new Date(startStr);
  const endAt = new Date(endStr);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
    throw new Error("শুরু/শেষ সময় সঠিক ফরম্যাটে নেই।");
  }
  if (endAt <= startAt) {
    throw new Error("শেষ সময় অবশ্যই শুরুর সময়ের পরে হতে হবে।");
  }
  return { startAt, endAt };
}

// ==================== প্রশ্নব্যাংকে সংরক্ষণ ====================

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// "ক্যাটাগরি - টপিক" হলে শুধু টপিকের নাম বের করে (প্রশ্নব্যাংকের নামের সাথে মেলানোর জন্য)
function topicNameFor(className: string, subject: string, chapter: string): string {
  const cls = NCTB_CLASSES.find((c) => c.class === className);
  const sub = cls?.subjects.find((s) => s.name === subject);
  const groups = sub?.subCategories ?? [];
  for (const g of groups) {
    const prefix = `${g.category} - `;
    if (chapter.startsWith(prefix)) {
      const rest = chapter.slice(prefix.length).trim();
      if (rest) return rest;
    }
  }
  return chapter.trim() || "সাধারণ";
}

function normDifficulty(v: string): "EASY" | "MEDIUM" | "HARD" {
  const u = String(v || "").toUpperCase();
  if (u === "EASY") return "EASY";
  if (u === "HARD") return "HARD";
  return "MEDIUM";
}

// মডেল টেস্টের প্রশ্নগুলো প্রশ্নব্যাংকে (approved: false) রাখে।
// এখানে কোনো সমস্যা হলে মডেল টেস্ট তৈরি আটকাবে না।
async function saveToQuestionBank(params: {
  className: string;
  subject: string;
  chapter: string;
  difficulty: string;
  language: string;
  questions: AiQuestion[];
}): Promise<void> {
  try {
    const { className, subject, chapter, difficulty, language, questions } = params;

    const topic = topicNameFor(className, subject, chapter);
    const lang = language === "English" ? "English" : "Bangla";
    const diff = normDifficulty(difficulty);

    const rows: {
      text: string;
      options: Record<string, string>;
      correct: string;
      explanation: string;
    }[] = [];

    const seen = new Set<string>();
    for (const q of questions) {
      const text = String(q.question || "").trim();
      if (!text || seen.has(text)) continue;
      if (!Array.isArray(q.options) || q.options.length < 2) continue;
      if (q.correctAnswer < 0 || q.correctAnswer >= LETTERS.length) continue;

      const options: Record<string, string> = {};
      q.options.slice(0, LETTERS.length).forEach((o, i) => {
        options[LETTERS[i]] = String(o ?? "").trim();
      });
      const correct = LETTERS[q.correctAnswer];
      if (!options[correct]) continue;

      seen.add(text);
      rows.push({
        text,
        options,
        correct,
        explanation: String(q.explanation || "").trim(),
      });
    }

    if (rows.length === 0) return;

    // আগে থেকে থাকা একই প্রশ্ন বাদ দেওয়া
    const existing = await db.question.findMany({
      where: {
        category: className,
        subject,
        text: { in: rows.map((r) => r.text) },
      },
      select: { text: true },
    });
    const have = new Set(existing.map((e) => e.text));
    const fresh = rows.filter((r) => !have.has(r.text));
    if (fresh.length === 0) return;

    await db.question.createMany({
      data: fresh.map((r) => ({
        subject,
        category: className,
        topic,
        difficulty: diff,
        lang,
        text: r.text,
        options: r.options,
        correct: r.correct,
        explanation: r.explanation,
        approved: false,
        source: "MODEL_TEST",
      })),
    });
  } catch (e) {
    console.error("প্রশ্নব্যাংকে সেভ করা যায়নি:", e);
  }
}

// ==================== মডেল টেস্ট অ্যাকশন ====================

export async function createModelTest(fd: FormData): Promise<void> {
  await staff();
  const session = await auth();
  const createdBy = session?.user?.id ?? null;

  const d = baseSchema.parse(readForm(fd));
  const isPaid = fd.get("isPaid") === "on";
  const { startAt, endAt } = parseTimes(d.startAt, d.endAt);

  const questions = await generateMcqQuestions({
    className: d.className,
    subject: d.subject,
    chapter: d.chapter,
    difficulty: d.difficulty,
    count: d.count,
    language: d.language,
  });

  await db.modelTest.create({
    data: {
      title: d.title,
      className: d.className,
      subject: d.subject,
      chapter: d.chapter,
      difficulty: d.difficulty,
      language: d.language,
      minutes: d.minutes,
      questions: questions,
      status: d.status,
      isPaid,
      startAt,
      endAt,
      createdBy,
    },
  });

  // 🎯 একই প্রশ্ন প্রশ্নব্যাংকেও রাখা (অনুমোদনের অপেক্ষায়)
  await saveToQuestionBank({
    className: d.className,
    subject: d.subject,
    chapter: d.chapter,
    difficulty: d.difficulty,
    language: d.language,
    questions,
  });

  revalidatePath("/admin/model-test");
  redirect("/admin/model-test");
}

export async function updateModelTest(fd: FormData): Promise<void> {
  await staff();

  const id = z.string().min(1).parse(fd.get("id"));
  const d = baseSchema.parse(readForm(fd));
  const isPaid = fd.get("isPaid") === "on";
  const regenerate = fd.get("regenerate") === "on";
  const { startAt, endAt } = parseTimes(d.startAt, d.endAt);

  const existing = await db.modelTest.findUnique({ where: { id } });
  if (!existing) throw new Error("টেস্ট খুঁজে পাওয়া যায়নি।");

  const common = {
    title: d.title,
    className: d.className,
    subject: d.subject,
    chapter: d.chapter,
    difficulty: d.difficulty,
    language: d.language,
    minutes: d.minutes,
    status: d.status,
    isPaid,
    startAt,
    endAt,
  };

  if (regenerate) {
    const questions = await generateMcqQuestions({
      className: d.className,
      subject: d.subject,
      chapter: d.chapter,
      difficulty: d.difficulty,
      count: d.count,
      language: d.language,
    });

    await db.$transaction([
      db.attempt.deleteMany({ where: { testId: id } }),
      db.modelTest.update({
        where: { id },
        data: { ...common, questions: questions },
      }),
    ]);

    // 🎯 নতুন প্রশ্নগুলোও প্রশ্নব্যাংকে রাখা (অনুমোদনের অপেক্ষায়)
    await saveToQuestionBank({
      className: d.className,
      subject: d.subject,
      chapter: d.chapter,
      difficulty: d.difficulty,
      language: d.language,
      questions,
    });
  } else {
    await db.modelTest.update({
      where: { id },
      data: common,
    });
  }

  revalidatePath("/admin/model-test");
  redirect("/admin/model-test");
}

export async function deleteModelTest(id: string): Promise<void> {
  await staff();
  await db.$transaction([
    db.attempt.deleteMany({ where: { testId: id } }),
    db.modelTest.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/model-test");
}

// ===== ফাইল শেষ =====
