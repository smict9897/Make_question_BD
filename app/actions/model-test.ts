"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { auth } from "@/auth";

type AiQuestion = {
  type: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

// অপশনের শুরুতে "ক)", "খ.", "A)" ইত্যাদি লেবেল থাকলে সরিয়ে ফেলে
// (শাফল করলে লেবেল উল্টাপাল্টা হয়ে যেত)
function stripOptionLabel(text: string): string {
  return text
    .replace(/^\s*(?:[কখগঘ]|[A-Da-d])\s*[\)\.\:]\s+/, "")
    .trim();
}

// প্রতিটি প্রশ্নের অপশন র‍্যান্ডমভাবে ওলটপালট করে (Fisher-Yates)
// এবং সঠিক উত্তরের নতুন ইনডেক্স হিসাব করে বসায়
function shuffleQuestionOptions(questions: any[]): AiQuestion[] {
  const result: AiQuestion[] = [];

  for (const q of questions) {
    if (!q || typeof q.question !== "string" || !Array.isArray(q.options)) {
      continue;
    }

    const options: string[] = q.options.map((o: unknown) =>
      stripOptionLabel(String(o ?? ""))
    );
    const correctIndex = Number(q.correctAnswer);

    // অপশন কমপক্ষে ২টা না থাকলে বা সঠিক উত্তরের ইনডেক্স ভুল হলে বাদ
    if (
      options.length < 2 ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      continue;
    }

    // [অপশনের লেখা, এটা সঠিক কিনা] জোড়া বানাই
    const pairs = options.map((text, i) => ({
      text,
      isCorrect: i === correctIndex,
    }));

    // Fisher-Yates shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    const newCorrectIndex = pairs.findIndex((p) => p.isCorrect);

    result.push({
      type: q.type || "MCQ",
      question: q.question,
      options: pairs.map((p) => p.text),
      correctAnswer: newCorrectIndex,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
    });
  }

  return result;
}

async function generateMcqQuestions(params: {
  className: string;
  subject: string;
  chapter: string;
  difficulty: string;
  count: number;
  language: string;
}): Promise<AiQuestion[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY সেট করা নেই।");

  const { className, subject, chapter, difficulty, count, language } = params;
  const langLabel = language === "English" ? "English" : "Bengali";

  const prompt = `Generate exactly ${count} MCQ questions in ${langLabel} for Class: ${className}, Subject: ${subject}, Chapter: ${chapter}, Difficulty: ${difficulty}. Return JSON: { "questions": [{ "type": "MCQ", "question": "প্রশ্ন", "options": ["ক", "খ", "গ", "ঘ"], "correctAnswer": 0, "explanation": "ব্যাখ্যা" }] }`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a Bengali exam generator. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek API Error: ${res.status}`);
  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("AI থেকে রেসপন্স পাওয়া যায়নি।");

  let cleaned = String(rawText).trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);
  const questions = parsed.questions || parsed;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("প্রশ্ন তৈরি করা যায়নি, আবার চেষ্টা করুন।");
  }

  // সঠিক উত্তর সবসময় একই জায়গায় থাকা ঠেকাতে অপশন শাফল
  const shuffled = shuffleQuestionOptions(questions);
  if (shuffled.length === 0) {
    throw new Error("প্রশ্নগুলো সঠিক ফরম্যাটে আসেনি, আবার চেষ্টা করুন।");
  }
  return shuffled;
}

const createSchema = z.object({
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

export async function createModelTest(fd: FormData): Promise<void> {
  await staff();
  const session = await auth();
  const createdBy = session?.user?.id ?? null;

  const d = createSchema.parse({
    title: fd.get("title"),
    className: fd.get("className"),
    subject: fd.get("subject"),
    chapter: fd.get("chapter"),
    difficulty: fd.get("difficulty"),
    language: fd.get("language"),
    count: fd.get("count"),
    minutes: fd.get("minutes"),
    startAt: fd.get("startAt"),
    endAt: fd.get("endAt"),
    status: fd.get("status"),
  });
  const isPaid = fd.get("isPaid") === "on";

  const startAt = new Date(d.startAt);
  const endAt = new Date(d.endAt);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
    throw new Error("শুরু/শেষ সময় সঠিক ফরম্যাটে নেই।");
  }
  
