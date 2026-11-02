import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// 🎯 ১. AI-র প্রশ্নগুলো ফেচ করা
// ?pending=1 দিলে শুধু যেগুলো এখনো অ্যাপ্রুভ হয়নি সেগুলো আসবে (সর্বোচ্চ ১০০টি)
// ?pending=1 না দিলে আগের মতোই সব AI প্রশ্ন (সর্বশেষ ৫০টি)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pendingOnly = searchParams.get("pending") === "1";

    const questions = await db.question.findMany({
      where: pendingOnly
        ? { source: "AI_GENERATOR", approved: false }
        : { source: "AI_GENERATOR" },
      orderBy: { createdAt: "desc" },
      take: pendingOnly ? 100 : 50,
    });
    return NextResponse.json({ success: true, questions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 🎯 ২. অ্যাপ্রুভ / এডিট করা
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // সবগুলো অ্যাপ্রুভ করা ("approveAll" ও "approve-all" দুটোই চলবে)
    if (body.action === "approveAll" || body.action === "approve-all") {
      const r = await db.question.updateMany({
        where: { approved: false, source: "AI_GENERATOR" },
        data: { approved: true },
      });
      return NextResponse.json({
        success: true,
        count: r.count,
        message: r.count > 0 ? `${r.count} টি প্রশ্ন অ্যাপ্রুভ হয়েছে!` : "অ্যাপ্রুভ করার মতো কোনো প্রশ্ন নেই।",
      });
    }

    // নির্দিষ্ট প্রশ্ন অ্যাপ্রুভ করা (একটি `id` বা `ids` তালিকা, দুটোই চলবে)
    if (body.action === "approve") {
      const ids: string[] = Array.isArray(body.ids)
        ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 500)
        : typeof body.id === "string" && body.id
          ? [body.id]
          : [];

      if (ids.length === 0) {
        return NextResponse.json({ success: false, error: "কোনো প্রশ্ন বাছা হয়নি।" }, { status: 400 });
      }

      const r = await db.question.updateMany({
        where: { id: { in: ids } },
        data: { approved: true },
      });
      return NextResponse.json({
        success: true,
        count: r.count,
        message: r.count === 1 ? "প্রশ্নটি অ্যাপ্রুভ হয়েছে!" : `${r.count} টি প্রশ্ন অ্যাপ্রুভ হয়েছে!`,
      });
    }

    // এডিট এবং সেভ করা (যে ঘর পাঠানো হবে শুধু সেটাই বদলাবে)
    if (body.action === "update" && body.id) {
      const data: Record<string, any> = {};
      if (typeof body.text === "string") data.text = body.text;
      if (typeof body.correct === "string") data.correct = body.correct;
      if (typeof body.explanation === "string") data.explanation = body.explanation;
      if (typeof body.topic === "string" && body.topic.trim()) data.topic = body.topic.trim();
      if (body.options && typeof body.options === "object" && !Array.isArray(body.options)) {
        data.options = body.options;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ success: false, error: "বদলানোর মতো কোনো তথ্য পাঠানো হয়নি।" }, { status: 400 });
      }

      await db.question.update({
        where: { id: body.id },
        data,
      });
      return NextResponse.json({ success: true, message: "প্রশ্নটি আপডেট হয়েছে!" });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ===== ফাইল শেষ =====
