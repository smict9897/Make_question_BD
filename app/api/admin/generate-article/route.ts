import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { callDeepSeekText } from "@/lib/deepseek"; 

export const maxDuration = 60;

const Body = z.object({
  topic: z.string().min(2).max(200),
  outline: z.array(z.string()).min(1),
  keywords: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const role = (await auth())?.user?.role;
  if (role !== "ADMIN") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "Invalid data" }, { status: 400 });

  const { topic, outline, keywords = [] } = p.data;

  // 👇 সম্পূর্ণ নতুন, স্টাইলিশ, কালারফুল এবং ২০০০+ শব্দের জন্য আপডেট করা প্রম্পট 👇
  const prompt = `You are an expert web content writer and a highly experienced, friendly human teacher from Bangladesh.
Topic: "${topic}"
Main Keywords to include: ${keywords.join(", ")}

Write a comprehensive, engaging, and highly professional blog post in Bangla following this exact outline:
${outline.map((h, i) => `<h2>${h}</h2>\n(Write 3-4 detailed paragraphs with real-life examples for this section)`).join("\n\n")}

*** CRITICAL VISUAL & STYLING RULES (TAILWIND CSS) ***
To make the article look beautiful and colorful, you MUST use the following Tailwind CSS classes inside your HTML tags:
1. Subheadings: Use <h2 class="text-2xl font-bold text-slate-800 mt-8 mb-4 border-b pb-2"> and <h3 class="text-xl font-semibold text-royal mt-6 mb-3">.
2. Important Text/Keywords: Use <strong class="text-royal font-bold"> or highlight with <mark class="bg-yellow-200 px-1 rounded text-slate-800">.
3. Important Notes / Warnings / Key Takeaways: Wrap them in this styled box:
   <div class="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded-r-lg text-slate-800">
      <h4 class="font-bold text-blue-800 mb-2">📌 মনে রাখার বিষয়</h4>
      <p>Your text here...</p>
   </div>
4. Tables: Use <div class="overflow-x-auto"><table class="w-full border-collapse border border-slate-300 my-6 text-sm"> with <th class="bg-slate-100 p-3 border border-slate-300 text-left font-bold"> and <td class="p-3 border border-slate-300">.
5. Quotes / Stories: Use <blockquote class="border-l-4 border-emerald-500 bg-emerald-50 p-4 my-4 italic text-slate-700 rounded-r-lg">.
6. Lists: Use <ul class="list-disc pl-6 space-y-2 my-4"> and <li> with <span class="font-semibold text-royal"> for the main point.

*** HUMAN-LIKE WRITING RULES (NO ROBOTIC TONE) ***
- Write in a conversational, empathetic, and friendly Bangla tone as if you are sitting with the student and explaining.
- Use transition words (e.g., "তবে", "অতএব", "উদাহরণস্বরূপ", "মনে করুন", "ধরুন", "খুব সহজভাবে বলতে গেলে")।
- Do NOT just list facts. Tell stories, use real-life analogies, and give examples. Explain deeply.
- Vary your sentence lengths. Mix short and long sentences to make it sound natural.

*** SEO & WORD COUNT RULES ***
1. The main focus keyword MUST be used naturally within the first 100 words of the article.
2. The focus keyword MUST be included in at least one <h2> or <h3> heading.
3. Return ONLY valid HTML code. (No Markdown, NO \`\`\`html blocks).
4. Start directly with the first <h2>. Do not include the main title (H1).
5. Write AT LEAST 2000 words. Do not stop generating until the word count is sufficient.`;

  // max_tokens 8192 রাখা হলো যাতে ২০০০+ শব্দের আর্টিকেল জেনারেট করতে পারে
  const r = await callDeepSeekText(prompt, 0.7, 8192); 
  
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status || 500 });

  // TypeScript এরর ফিক্স ও মার্কডাউন ক্লিনআপ
  let cleanHtml = String(r.data || "");
  
  if (cleanHtml.startsWith("```html")) {
    cleanHtml = cleanHtml.replace(/^```html\n?/, "").replace(/```$/, "");
  } else if (cleanHtml.startsWith("```")) {
    cleanHtml = cleanHtml.replace(/^```\n?/, "").replace(/```$/, "");
  }

  return NextResponse.json({ ok: true, content: cleanHtml });
}
