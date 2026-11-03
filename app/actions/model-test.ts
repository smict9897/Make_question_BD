"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { auth } from "@/auth";
import { generateMcqQuestions } from "@/lib/model-test-ai";

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
