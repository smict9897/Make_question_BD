import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pending = await db.aiTask.count({ where: { status: "PENDING" } });
    const processing = await db.aiTask.count({ where: { status: "PROCESSING" } });
    const completed = await db.aiTask.count({ where: { status: "COMPLETED" } });
    const failed = await db.aiTask.count({ where: { status: "FAILED" } });

    const recentTasks = await db.aiTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, prompt: true, status: true }
    });

    return NextResponse.json({ success: true, stats: { pending, processing, completed, failed }, recentTasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
