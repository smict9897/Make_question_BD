import { NextResponse } from "next/server";
import { staff } from "@/lib/guard";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 🎯 JSON ভেঙে গেলে তা অটো-রিপেয়ার করার শক্তিশালী ফাংশন
function repairJson(jsonStr: string) {
  let str = jsonStr.trim();
  if (str.match(/"[^"]*$/)) str += '"';
  let openBrackets = (str.match(/\[/g) || []).length;
  let closeBrackets = (str.match(/\]/g) || []).length;
  let openBraces = (str.match(/\{/g) || []).length;
  let closeBraces = (str.match(/\}/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) str += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) str += "}";
  return str;
}

// 🎯 AI-কে একটি নির্দিষ্ট অংশ পাঠিয়ে প্রশ্ন আনার ফাংশন
async function processChunk(chunkText: string, mode: string, apiKey: string) {
  // 🎯 নতুন আপডেট: বানান ও শব্দের মিল (Context) ঠিক করার কঠোর নির্দেশনা
  const prompt = `
You are an expert Bengali linguistic editor and OCR correction engine. 
The following text is extracted from a PDF and has broken Bengali fonts (e.g., incorrect matras, broken conjuncts, missing 'reph').

YOUR MISSION: Fix the Bengali spelling and words perfectly based on the CONTEXT of the sentence. 

STRICT BENGALI FIXING RULES:
1. **Fix Reversed Matras (কার-চিহ্ন):** In broken PDFs, 'ি' often appears after the letter instead of before. Fix 'কি' to 'কি', 'তিনি' to 'তিনি'.
2. **Fix Broken Conjuncts (যুক্তাক্ষর):** Fix broken letters like 'ব + ্ + ল' to 'বল', 'স + ্ + থ' to 'স্থ'. 
3. **Contextual Spelling (শব্দের মিল):** If a word looks like gibberish but matches a known Bengali word in the context of Science, ICT, or Math, fix it. (e.g., 'ুকোজ' -> 'গ্লুকোজ', 'মাবাইল ফান' -> 'মোবাইল ফোন', 'পদাথ' -> 'পদার্থ').
4. **Complete the Sentences:** If words are jumbled, rearrange them to make a grammatically correct Bengali sentence.
5. **DO NOT change the meaning** of the question. Only fix the spelling and grammar.

EXTRACTION RULES:
1. Extract ONLY the requested mode: "${mode}". If mode is AUTO, extract MCQ, SHORT, and CQ.
2. MCQ Rule: If options (ক, খ, গ, ঘ) are present, it goes to "mcqs".
3. CQ Rule: If there is an উদ্দীপক and sub-questions (ক, খ, গ, ঘ), it goes to "cqs".
4. SHORT Rule: Standalone questions go to "shortQuestions".
5. AUTO-ANSWER: If an MCQ answer is missing, solve it correctly and set "correct" to "A", "B", "C", or "D".

CRITICAL: Return ONLY a valid JSON object. Ensure all brackets and quotes are fully closed.

Format:
{
  "mcqs": [{ "text": "প্রশ্ন", "options": { "A": "ক", "B": "খ", "C": "গ", "D": "ঘ" }, "correct": "A", "flags": [] }],
  "shortQuestions": [{ "text": "প্রশ্ন", "marks": "২" }],
  "cqs": [{ "stimulus": "উদ্দীপক", "subQuestions": { "k": "ক", "kh": "খ", "g": "গ", "gh": "ঘ" } }]
}

Text to Process:
${chunkText}
`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a Bengali digitizer. Output only valid JSON. Categorize questions perfectly." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8192,
      }),
    });

    if (!res.ok) throw new Error("API Error");
    
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content");

    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = JSON.parse(repairJson(cleaned));
    }

    return {
      mcqs: parsed.mcqs || [],
      shortQuestions: parsed.shortQuestions || [],
      cqs: parsed.cqs || [],
    };
  } catch (err) {
    console.error("Chunk Error:", err);
    return { mcqs: [], shortQuestions: [], cqs: [] };
  }
}

export async function POST(req: Request) {
  try {
    await staff();

    const body = await req.json();
    const rawText = String(body.text || "").trim();
    const mode = (body.mode || "AUTO") as "AUTO" | "MCQ" | "SHORT" | "CQ";

    if (!rawText) {
      return NextResponse.json({ ok: false, error: "কোনো টেক্সট পাওয়া যায়নি।" }, { status: 422 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "❌ DEEPSEEK_API_KEY পাওয়া যায়নি!" }, { status: 400 });
    }

    // 🎯 স্মার্ট চাংকিং (প্রতি চাংকে ১০ হাজার ক্যারেক্টার এবং ২০০ ক্যারেক্টার ওভারল্যাপ)
    const CHUNK_SIZE = 10000;
    const OVERLAP = 200; 
    const chunks = [];

    for (let i = 0; i < rawText.length; i += (CHUNK_SIZE - OVERLAP)) {
      const chunk = rawText.slice(i, i + CHUNK_SIZE);
      chunks.push(chunk);
      if (i + CHUNK_SIZE >= rawText.length) break;
    }

    let allMcqs: any[] = [];
    let allShorts: any[] = [];
    let allCqs: any[] = [];

    // 🎯 প্রতিটি ভাগ AI-তে পাঠানো হচ্ছে
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const result = await processChunk(chunk, mode, apiKey);
      allMcqs.push(...result.mcqs);
      allShorts.push(...result.shortQuestions);
      allCqs.push(...result.cqs);
    }

    // 🎯 ডুপ্লিকেট প্রশ্ন রিমুভ করা
    const uniqueMcqs = Array.from(new Map(allMcqs.map(q => [q.text, q])).values());
    const uniqueShorts = Array.from(new Map(allShorts.map(q => [q.text, q])).values());
    const uniqueCqs = Array.from(new Map(allCqs.map(q => [q.stimulus || q.text, q])).values());

    // 🎯 প্রশ্নের নম্বর নতুন করে সেট করা
    const finalMcqs = uniqueMcqs.map((q, i) => ({ ...q, number: i + 1 }));
    const finalShorts = uniqueShorts.map((q, i) => ({ ...q, number: i + 1 }));
    const finalCqs = uniqueCqs.map((q, i) => ({ ...q, number: i + 1 }));

    return NextResponse.json({
      ok: true,
      mcqs: finalMcqs,
      shortQuestions: finalShorts,
      cqs: finalCqs,
    });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "সার্ভার এরর" }, { status: 500 });
  }
}
