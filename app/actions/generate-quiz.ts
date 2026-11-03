"use server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const Input = z.object({
  subject: z.string().min(1), category: z.string().min(1), topic: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]), count: z.coerce.number().int().min(1).max(20),
  lang: z.enum(["Bangla", "English"]),
  type: z.enum(["MCQ", "SHORT", "CQ", "MIXED"]).optional(),
  avoid: z.array(z.string()).max(60).optional(),
});

export type QuizItem = {
  type: "MCQ" | "SHORT" | "CQ";
  text?: string;
  options?: Record<string, string>;
  correct?: string;
  explanation?: string;
  stimulus?: string;
  subQuestions?: Record<string, string>;
};

export async function generateQuiz(raw: unknown): Promise<{ ok: true; items: QuizItem[] } | { ok: false; error: string }> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: "ফর্মের তথ্যে ভুল আছে। আবার চেষ্টা করুন।" };
  const { subject, category, topic, difficulty, count, lang, avoid, type = "MCQ" } = p.data;
  
  const avoidText = avoid && avoid.length
    ? ` Do NOT repeat or closely paraphrase any of these existing questions: ${avoid.join(" ; ")}.`
    : "";

  let prompt = "";
  if (type === "MCQ") {
    prompt = `Create exactly ${count} multiple-choice questions for ${category} ${subject}, topic "${topic}", written in ${lang}.${avoidText} Return ONLY a valid JSON object: { "questions": [{"type": "MCQ", "text": "...", "options": {"A":"...","B":"...","C":"...","D":"..."}, "correct": "A|B|C|D", "explanation": "..."}] }`;
  } else if (type === "SHORT") {
    prompt = `Create exactly ${count} short questions for ${category} ${subject}, topic "${topic}", written in ${lang}.${avoidText} Return ONLY a valid JSON object: { "questions": [{"type": "SHORT", "text": "...", "explanation": "..."}] }`;
  } else if (type === "CQ") {
    prompt = `Create exactly ${count} creative questions (CQ) for ${category} ${subject}, topic "${topic}", written in ${lang}.${avoidText} Return ONLY a valid JSON object: { "questions": [{"type": "CQ", "stimulus": "...", "subQuestions": {"k": "...", "kh": "...", "g": "...", "gh": "..."}}] }`;
  } else {
    prompt = `Create exactly ${count} questions (mix of MCQ, SHORT, and CQ) for ${category} ${subject}, topic "${topic}", written in ${lang}.${avoidText} Return ONLY a valid JSON object: { "questions": [ {"type": "MCQ", "text": "...", "options": {...}, "correct": "...", "explanation": "..."}, {"type": "SHORT", "text": "...", "explanation": "..."}, {"type": "CQ", "stimulus": "...", "subQuestions": {...}} ] }`;
  }

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a Bengali exam generator. You must output ONLY valid JSON. Do not write any other text." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000
      }),
    });

    if (!res.ok) {
        console.error("API Error Status:", res.status);
        return { ok: false, error: "AI সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" };
    }
    
    const data = await res.json();
    let text: string = data.choices?.[0]?.message?.content ?? "";
    
    // 🎯 আল্ট্রা-স্ট্রং JSON ক্লিনার
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // যদি JSON ভেঙে থাকে, তবে Regex দিয়ে { ... } অংশটুকু খোঁজা হবে
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } 
        catch (e2) { return { ok: false, error: "AI এর উত্তর সঠিক ফরম্যাটে নেই। আবার তৈরি করুন।" }; }
      } else {
        return { ok: false, error: "AI কোনো সঠিক উত্তর দেয়নি। আবার তৈরি করুন।" };
      }
    }

    const rawItems = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.items || []);
    const validItems: QuizItem[] = [];

    // 🎯 AI-এর দেওয়া ডেটাকে ফিক্স করা
    for (const item of rawItems) {
      let itemType = item.type;
      if (!itemType) {
        if (item.stimulus || item.subQuestions) itemType = "CQ";
        else if (item.options) itemType = "MCQ";
        else itemType = "SHORT";
      }

      if (itemType === "CQ") {
        validItems.push({
          type: "CQ",
          stimulus: item.stimulus || "উদ্দীপক",
          subQuestions: item.subQuestions || { k: "", kh: "", g: "", gh: "" },
        });
      } else if (itemType === "SHORT") {
        validItems.push({
          type: "SHORT",
          text: item.text || "সংক্ষিপ্ত প্রশ্ন",
          explanation: item.explanation || "",
        });
      } else {
        validItems.push({
          type: "MCQ",
          text: item.text || "প্রশ্ন",
          options: item.options || { A: "", B: "", C: "", D: "" },
          correct: item.correct || "A",
          explanation: item.explanation || "",
        });
      }
    }

    if (validItems.length === 0) return { ok: false, error: "AI কোনো প্রশ্ন তৈরি করতে পারেনি। আবার চেষ্টা করুন।" };
    return { ok: true, items: validItems };

  } catch (err) {
    console.error("Generate Error:", err);
    return { ok: false, error: "Could not read the AI response. Generate again." };
  }
}

const SaveInput = z.object({
  subject: z.string().min(1), category: z.string().min(1), topic: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]), lang: z.enum(["Bangla", "English"]),
  items: z.array(z.any()),
});

export async function saveQuizToBank(
  raw: unknown,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "TEACHER")
    return { ok: false, error: "প্রশ্নপত্র বানাতে অ্যাডমিন বা শিক্ষক হিসেবে লগইন করুন।" };
    
  const p = SaveInput.safeParse(raw);
  if (!p.success || !p.data.items.length)
    return { ok: false, error: "সেভ করার মতো প্রশ্ন পাওয়া যায়নি।" };
    
  const { subject, category, topic, difficulty, lang, items } = p.data;
  const diff = difficulty.toUpperCase() as "EASY" | "MEDIUM" | "HARD";
  
  try {
    const rows = await db.$transaction(
      items.map((q: QuizItem) =>
        db.question.create({
          data: {
            subject, category, topic, difficulty: diff, lang,
            text: q.text || q.stimulus || "", 
            options: q.options || q.subQuestions || {}, 
            correct: q.correct || "", 
            explanation: q.explanation || "",
            approved: true, source: "AI",
          },
          select: { id: true },
        }),
      ),
    );
    return { ok: true, ids: rows.map((r) => r.id) };
  } catch (e) {
    console.error("saveQuizToBank failed:", e);
    return { ok: false, error: "সেভ হয়নি। আবার চেষ্টা করুন।" };
  }
}
