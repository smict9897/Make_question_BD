import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
// ১. এখানে শুধু callGeminiJson এর জায়গায় callDeepSeekJson বসবে
import { callDeepSeekJson } from "@/lib/deepseek"; 
import { normalizeSeoPack } from "@/lib/keyword-research";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const Body = z.object({
  topic: z.string().trim().min(2, "বিষয় লিখুন।").max(200),
  keywords: z.array(z.string().trim().min(1).max(120)).min(1, "অন্তত একটি কিওয়ার্ড দিন।").max(12),
});
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const role = (await auth())?.user?.role;
  if (role !== "ADMIN") return fail("শুধু অ্যাডমিন এটা ব্যবহার করতে পারবেন।", 403);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("অনুরোধ পড়া যায়নি।");
  }
  const p = Body.safeParse(json);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "তথ্য ঠিক নেই।");
  const { topic, keywords } = p.data;

  const prompt = `You are an SEO content strategist for a Bangladeshi education website (students and job seekers).
Blog topic: "${topic}"
Target keywords (the first one is the main focus keyword): ${keywords.map((k) => `"${k}"`).join(", ")}

Create an SEO pack for one blog post. Return ONLY a JSON object with exactly these fields:
- "titles": array of 3 catchy blog post titles that naturally include the main keyword (Bangla or mixed Bangla-English, max 100 characters each)
- "slug": a short English URL slug using lowercase letters, numbers and hyphens only
- "metaTitle": string, maximum 60 characters, includes the main keyword
- "metaDescription": string, maximum 160 characters, includes the main keyword and a reason to click
- "hashtags": array of 5 to 8 hashtags without the # symbol and without spaces
- "outline": array of 6 to 10 H2 headings for the article, in order
- "faqs": array of 4 to 6 question-style FAQ questions students or job seekers would ask`;

  // ২. এখানে শুধু callGeminiJson এর জায়গায় callDeepSeekJson বসবে
  const r = await callDeepSeekJson(prompt, 0.6); 
  
  if (!r.ok) return fail(r.error, r.status);
  
  // নিচের সবকিছু হুবহু আগের মতোই থাকবে
  const pack = normalizeSeoPack(r.data);
  if (!pack) return fail("SEO প্যাক তৈরি হয়নি। আবার চেষ্টা করুন।", 502);
  
  return NextResponse.json({ ok: true, pack });
}
