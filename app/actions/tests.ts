"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";

export async function createTest(fd: FormData): Promise<void> {
  await staff();
  const d = z.object({ title: z.string().min(3), subject: z.string().min(1), count: z.coerce.number().int().min(5).max(100), minutes: z.coerce.number().int().min(1).max(240) }).parse(Object.fromEntries(fd));
  const pool = await db.question.findMany({ where: { approved: true, subject: d.subject }, select: { id: true } });
  if (pool.length < d.count) throw new Error(`Only ${pool.length} approved questions for this subject.`);
  const ids = pool.sort(() => Math.random() - 0.5).slice(0, d.count).map((q) => q.id);
  await db.practiceTest.create({ data: { title: d.title, subject: d.subject, minutes: d.minutes, questionIds: ids } });
  revalidatePath("/tests");
  redirect("/tests");
}

export type Result = { ok: true; score: number; total: number; review: Record<string, { correct: string; explanation: string }> } | { ok: false; error: string };
export async function submitAttempt(testId: string, answers: Record<string, string>): Promise<Result> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Log in to submit your test." };
  const t = await db.practiceTest.findUnique({ where: { id: testId } });
  if (!t) return { ok: false, error: "Test not found." };
  const qs = await db.question.findMany({ where: { id: { in: t.questionIds as string[] } } });
  let score = 0; const review: Record<string, { correct: string; explanation: string }> = {};
  for (const q of qs) { if (answers[q.id] === q.correct) score++; review[q.id] = { correct: q.correct, explanation: q.explanation }; }
  await db.practiceAttempt.create({ data: { testId, userId: s.user.id, userName: s.user.name ?? "Student", score, total: qs.length } });
  revalidatePath(`/tests/${testId}`);
  return { ok: true, score, total: qs.length, review };
}
