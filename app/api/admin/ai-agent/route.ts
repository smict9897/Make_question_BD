import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// প্রতি অংশে কয়টি প্রশ্ন (ai-worker ফাইলের সংখ্যার সাথে হুবহু মিলতে হবে)
const PER_PART: Record<string, number> = { MCQ: 10, SQ: 10, CQ: 3 };
const ALLOWED_TYPES = ["BLOG", "MCQ", "CQ", "SQ"];

export async function POST(req: Request) {
  try {
    const { prompt, type, category, subject, topics, mcqCount } = await req.json();
    
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ success: false, error: "কোনো অধ্যায় সিলেক্ট করা হয়নি।" }, { status: 400 });
    }

    const tasksData: any[] = [];

    // ধরন ঠিক করা: অচেনা কিছু এলে আগের মতোই MCQ ধরা হবে
    const rawType = String(type || "BLOG").toUpperCase();
    const taskType = ALLOWED_TYPES.includes(rawType) ? rawType : "MCQ";

    topics.forEach((topic: string) => {
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      if (taskType === "BLOG") {
        // 🎯 আর্টিকেল: ৩ পার্টে ভাগ হবে
        for (let p = 1; p <= 3; p++) {
          tasksData.push({
            prompt: prompt || `ক্লাস: ${category}, বিষয়: ${subject}, অধ্যায়: ${topic}`,
            type: taskType, category: category || null, subject: subject || null, topic: topic || null,
            status: "PENDING", part: p, totalParts: 3, batchId: batchId
          });
        }
      } else {
        // 🎯 MCQ / SQ: ১০টি করে, CQ: ৩টি করে অংশে ভাগ হবে
        const perPart = PER_PART[taskType] ?? 10;
        const totalQuestions = Number(mcqCount) || 10;
        const parts = Math.max(1, Math.ceil(totalQuestions / perPart));
        
        for (let p = 1; p <= parts; p++) {
          tasksData.push({
            prompt: prompt || `ক্লাস: ${category}, বিষয়: ${subject}, অধ্যায়: ${topic}`,
            type: taskType, category: category || null, subject: subject || null, topic: topic || null,
            status: "PENDING", part: p, totalParts: parts, batchId: batchId
          });
        }
      }
    });

    await db.aiTask.createMany({ data: tasksData });
    return NextResponse.json({ success: true, message: `${tasksData.length} টি কাজ লাইনে যোগ হয়েছে!` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ===== ফাইল শেষ =====
