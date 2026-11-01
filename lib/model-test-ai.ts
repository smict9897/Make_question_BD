export type AiQuestion = {
  type: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

// অপশনের শুরুতে "ক)", "খ.", "A)" ইত্যাদি লেবেল থাকলে সরিয়ে ফেলে
function stripOptionLabel(text: string): string {
  return text
    .replace(/^\s*(?:[কখগঘ]|[A-Da-d])\s*[\)\.\:]\s+/, "")
    .trim();
}

// প্রতিটি প্রশ্নের অপশন এলোমেলো করে (Fisher-Yates)
// এবং সঠিক উত্তরের নতুন ইনডেক্স বসায়
export function shuffleQuestionOptions(questions: any[]): AiQuestion[] {
  const result: AiQuestion[] = [];

  for (const q of questions) {
    if (!q || typeof q.question !== "string" || !Array.isArray(q.options)) {
      continue;
    }

    const options: string[] = q.options.map((o: unknown) =>
      stripOptionLabel(String(o ?? ""))
    );
    const correctIndex = Number(q.correctAnswer);

    if (
      options.length < 2 ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      continue;
    }

    const pairs = options.map((text, i) => ({
      text,
      isCorrect: i === correctIndex,
    }));

    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    result.push({
      type: q.type || "MCQ",
      question: q.question,
      options: pairs.map((p) => p.text),
      correctAnswer: pairs.findIndex((p) => p.isCorrect),
      explanation: typeof q.explanation === "string" ? q.explanation : "",
    });
  }

  return result;
}

export async function generateMcqQuestions(params: {
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a Bengali exam generator. Output only valid JSON.",
        },
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
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  const parsed = JSON.parse(cleaned);
  const questions = parsed.questions || parsed;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("প্রশ্ন তৈরি করা যায়নি, আবার চেষ্টা করুন।");
  }

  const shuffled = shuffleQuestionOptions(questions);
  if (shuffled.length === 0) {
    throw new Error("প্রশ্নগুলো সঠিক ফরম্যাটে আসেনি, আবার চেষ্টা করুন।");
  }
  return shuffled;
}
