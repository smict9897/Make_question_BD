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

  // ডুপ্লিকেট চেক — আগে থেকে জমা থাকলে চুপচাপ ignore করে পুরনোটাই রাখবে
  const existing = await db.attempt.findUnique({
    where: { testId_userId: { testId: input.testId, userId: user.id } },
  });

  if (existing) {
    return { success: true, alreadySubmitted: true };
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
    },
  });

  revalidatePath(`/model-test/${input.testId}`);
  revalidatePath(`/admin/model-test`);

  return { success: true };
}
