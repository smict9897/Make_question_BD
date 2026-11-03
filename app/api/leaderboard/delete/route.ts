import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  try {
    // 🎯 চেক করা হচ্ছে ইউজার অ্যাডমিন কি না
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Only admins can delete." }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing ID." }, { status: 400 });
    }

    // 🎯 আপনার ডাটাবেজে যে নামেই মডেল থাকুক, (db as any) দিলে এরর আসবে না।
    // তবে আপনি যদি নিশ্চিত হন আপনার মডেলের নাম (যেমন: examResult), তবে (db as any).leaderboard এর জায়গায় db.examResult লিখতে পারেন।
    await (db as any).leaderboard.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Leaderboard Delete Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
