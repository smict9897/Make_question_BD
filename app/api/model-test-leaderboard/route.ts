import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const testId = req.nextUrl.searchParams.get("testId");

  if (!testId) {
    return NextResponse.json({ success: false, error: "testId প্রয়োজন।" }, { status: 400 });
  }

  const attempts = await db.attempt.findMany({
    where: { testId },
    orderBy: [{ score: "desc" }, { timeSpent: "asc" }],
    take: 200,
  });

  const leaderboard = attempts.map((a) => ({
    id: a.id,
    studentName: a.userName,
    rollNumber: a.rollNumber,
    institution: a.institution || "",
    score: a.score,
    timeSpent: a.timeSpent,
  }));

  return NextResponse.json({ success: true, leaderboard });
}
