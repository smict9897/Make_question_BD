"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPremium } from "@/lib/premium";
import { revalidatePath } from "next/cache";

export type SubmitAttemptInput = {
  testId: string;
  studentName: string;
  studentClass: string;
  rollNumber: string;
  institution?: string;
  score: number;
  total: number;
  timeSpent: number;
  warnings: number;
  answers?: Record<number, number>;
};

// পরীক্ষা শেষ হওয়ার পরেও জমা দেওয়ার অতিরিক্ত সময় (মিনিট)
const SUBMIT_GRACE_MINUTES = 5;

export async function submitModelTestAttempt(input: SubmitAttemptInput) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { success: false, error: "লগইন প্রয়োজন।" };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { success: false, error: "ইউজার পাওয়া যায়নি, আবার লগইন করুন।" };
  }

  const test = await db.modelTest.findUnique({ where: { id: input.testId } });
  if (!test) {
    return { success: false, error: "টেস্ট খুঁজে পাওয়া যায়নি।" };
  }

  // আগে জমা দেওয়া থাকলে নতুন করে কিছু চেক না করেই সফল ধরা হবে
  const existing = await db.attempt.findUnique({
    where: { testId_userId: { testId: input.testId, userId: user.id } },
  });

  if (existing) {
    return { success: true, alreadySubmitted: true };
  }

  // ---------- সার্ভার-সাইড সুরক্ষা ----------

  // ১) Draft টেস্টে জমা নেওয়া হবে না
  if (test.status !== "PUBLISHED") {
    return { success: false, error: "এই পরীক্ষা এখনো প্রকাশিত হয়নি।" };
  }

  // ২) সময়ের জানালা
  const now = Date.now();
  if (test.startAt && now < new Date(test.startAt).getTime()) {
    return { success: false, error: "পরীক্ষা এখনো শুরু হয়নি।" };
  }
  if (test.endAt) {
    const hardEnd =
      new Date(test.endAt).getTime() +
      ((test.minutes || 0) + SUBMIT_GRACE_MINUTES) * 60 * 1000;
    if (now > hardEnd) {
      return { success: false, error: "পরীক্ষার সময় শেষ হয়ে গেছে।" };
    }
  }

  // ৩) Paid টেস্টে Premium বাধ্যতামূলক
  if (test.isPaid) {
    const premium = await hasPremium(user.id);
    if (!premium) {
      return {
        success: false,
        error: "এটি Premium পরীক্ষা। অংশ নিতে প্যাকেজ নিন।",
      };
    }
  }

  // ৪) স্কোর সীমার মধ্যে রাখা
  const total = Math.max(0, Math.floor(Number(input.total) || 0));
  const rawScore = Math.floor(Number(input.score) || 0);
  const score = Math.min(Math.max(rawScore, 0), total);

  // উত্তরগুলো { "0": 2, "1": 0, ... } আকারে সেভ হবে (প্রশ্নের ইনডেক্স → অপশনের ইনডেক্স)
  const answersToSave: Record<string, number> = {};
  if (input.answers) {
    for (const [key, value] of Object.entries(input.answers)) {
      if (typeof value === "number") {
        answersToSave[String(key)] = value;
      }
    }
  }

  await db.attempt.create({
    data: {
      testId: input.testId,
      userId: user.id,
      userName: input.studentName || user.name || "পরীক্ষার্থী",
      userImage: user.image || null,
      rollNumber: input.rollNumber || "0",
      studentClass: input.studentClass || "N/A",
      institution: input.institution || null,
      score,
      total,
      timeSpent: input.timeSpent,
      warnings: input.warnings,
      answers: answersToSave,
    },
  });

  revalidatePath(`/model-test/${input.testId}`);
  revalidatePath(`/admin/model-test`);

  return { success: true };
}

// ===== ফাইল শেষ =====
