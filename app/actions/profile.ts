"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
  name?: string;
};

export async function updateProfileName(newName: string): Promise<UpdateProfileResult> {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { success: false, error: "লগইন প্রয়োজন।" };
  }

  const name = (newName ?? "").trim().replace(/\s+/g, " ");

  if (name.length < 2) {
    return { success: false, error: "নাম কমপক্ষে ২ অক্ষরের হতে হবে।" };
  }

  if (name.length > 50) {
    return { success: false, error: "নাম ৫০ অক্ষরের বেশি হতে পারবে না।" };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { success: false, error: "ইউজার পাওয়া যায়নি, আবার লগইন করুন।" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { name },
  });

  revalidatePath("/profile");

  return { success: true, name };
}
