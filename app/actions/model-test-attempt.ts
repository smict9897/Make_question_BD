"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
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

  const existing = await db.attempt.findUnique({
    where: { testId_userId: { testId: input.testId, userId: user.id } },
  });

  if (existing) {
    return { success: true, alreadySubmitted: true };
  }

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
      score: input.score,
      total: input.total,
      timeSpent: input.timeSpent,
      warnings: input.warnings,
      answers: answersToSave,
    },
  });

  revalidatePath(`/model-test/${input.testId}`);
  revalidatePath(`/admin/model-test`);

  return { success: true };
}
