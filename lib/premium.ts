import { db } from "@/lib/db";
import { auth } from "@/auth";

// বর্তমান লগইন করা ইউজারের আইডি (লগইন না থাকলে null)
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string | null } | undefined;
  if (!user) return null;
  if (user.id) return user.id;
  if (user.email) {
    const found = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    return found?.id ?? null;
  }
  return null;
}

export type PremiumStatus = {
  isPremium: boolean;
  expiresAt: Date | null;
  packageTitle: string | null;
};

// মেয়াদ চলা APPROVED প্যাকেজ আছে কিনা
export async function getPremiumStatus(userId: string): Promise<PremiumStatus> {
  const active = await db.packagePurchase.findFirst({
    where: { userId, status: "APPROVED", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    include: { package: { select: { title: true } } },
  });
  return {
    isPremium: !!active,
    expiresAt: active?.expiresAt ?? null,
    packageTitle: active?.package.title ?? null,
  };
}

export async function hasPremium(userId: string): Promise<boolean> {
  const s = await getPremiumStatus(userId);
  return s.isPremium;
}

// ===== ফাইল শেষ =====
