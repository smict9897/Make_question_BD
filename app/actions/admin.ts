"use server";
import { del } from "@vercel/blob";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { admin, staff } from "@/lib/guard";
import { social } from "@/lib/social";

const done = () => {
  revalidatePath("/admin");
  revalidatePath("/", "layout");
};
const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v : ""; };
const link = z.string().trim().refine((s) => s === "" || /^https:\/\/\S+$/.test(s), "Links must start with https://");

export async function saveSettings(fd: FormData): Promise<void> {
  await admin();
  const entries: [string, string][] = social.map((s) => [`social.${s.name}`, link.parse(str(fd, `social.${s.name}`))]);
  entries.push(
    ["contact.email", z.string().trim().max(120).refine((s) => s === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "Invalid email").parse(str(fd, "contact.email"))],
    ["contact.phone", z.string().trim().max(30).parse(str(fd, "contact.phone"))],
    ["hero.badge", z.string().trim().max(60).parse(str(fd, "hero.badge"))],
    ["hero.title", z.string().trim().max(160).parse(str(fd, "hero.title"))],
    ["hero.subtitle", z.string().trim().max(300).parse(str(fd, "hero.subtitle"))],
    ["footer.text", z.string().trim().max(400).parse(str(fd, "footer.text"))],
    ["meta.description", z.string().trim().max(170).parse(str(fd, "meta.description"))],
  );
  await db.$transaction(entries.map(([key, value]) => db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })));
  done();
}

export async function setNotice(id: string, active: boolean): Promise<void> {
  await staff();
  await db.notice.update({ where: { id }, data: { active } });
  done();
}
export async function deleteNotice(id: string): Promise<void> {
  await staff();
  await db.notice.delete({ where: { id } });
  done();
}

// 🎯 ১. রোল পরিবর্তন (smict9897 এর জন্য সম্পূর্ণ লক)
export async function setRole(id: string, fd: FormData): Promise<void> {
  const me = await admin();
  
  const targetId = id || String(fd.get("id") || fd.get("userId") || "");
  const rawRole = String(fd.get("role") || "").trim();
  const role = z.enum(["ADMIN", "TEACHER", "STUDENT"]).parse(rawRole);

  if (!targetId) throw new Error("User ID পাওয়া যায়নি।");

  // 🔒 মাস্টার সুপার অ্যাডমিন প্রোটেকশন (smict9897)
  const targetUser = await db.user.findUnique({ where: { id: targetId } });
  if (targetUser?.email?.toLowerCase().includes("smict9897")) {
    throw new Error("নিরাপত্তা সতর্কতা: smict9897 হলো মূল সুপার অ্যাডমিন অ্যাকাউন্ট। এর রোল কখনো পরিবর্তন করা যাবে না।");
  }

  if (me?.id && targetId === me.id) throw new Error("আপনি নিজের রোল পরিবর্তন করতে পারবেন না।");

  await db.user.update({
    where: { id: targetId },
    data: { role },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
}

// 🎯 ২. ইউজার ডিলিট (smict9897 কখনোই ডিলিট করা যাবে না)
export async function deleteUser(id: string, fd?: FormData): Promise<void> {
  const me = await admin();
  const targetId = id || String(fd?.get("id") || fd?.get("userId") || "");

  // 🔒 মাস্টার সুপার অ্যাডমিন প্রোটেকশন (smict9897)
  const targetUser = await db.user.findUnique({ where: { id: targetId } });
  if (targetUser?.email?.toLowerCase().includes("smict9897")) {
    throw new Error("নিরাপত্তা সতর্কতা: smict9897 হলো মূল সুপার অ্যাডমিন অ্যাকাউন্ট। এটি ডিলিট করা সম্পূর্ণ নিষিদ্ধ।");
  }

  if (me?.id && targetId === me.id) throw new Error("আপনি নিজের অ্যাকাউন্ট মুছতে পারবেন না।");

  await db.user.delete({ where: { id: targetId } });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function savePage(id: string | null, fd: FormData): Promise<void> {
  await staff();
  const d = z.object({
    title: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase().regex(slugRe, "Slug: use only English letters, numbers and hyphens"),
    body: z.string().min(10),
  }).parse({ title: str(fd, "title"), slug: str(fd, "slug"), body: str(fd, "body") });
  const other = await db.page.findUnique({ where: { slug: d.slug } });
  if (other && other.id !== id) throw new Error("This URL slug is already used.");
  if (id) await db.page.update({ where: { id }, data: d });
  else await db.page.create({ data: d });
  done();
  redirect("/admin/pages");
}
export async function deletePage(id: string): Promise<void> {
  await staff();
  await db.page.delete({ where: { id } });
  done();
}

export async function deleteTest(id: string): Promise<void> {
  await staff();
  await db.$transaction([db.practiceAttempt.deleteMany({ where: { testId: id } }), db.practiceTest.delete({ where: { id } })]);
  revalidatePath("/tests");
  revalidatePath("/admin/tests");
}

export async function deleteInquiry(id: string): Promise<void> {
  await staff();
  await db.inquiry.delete({ where: { id } });
  revalidatePath("/admin/inquiries");
}

export async function renameCategory(id: string, fd: FormData): Promise<void> {
  await staff();
  const name = z.string().trim().min(2).max(80).parse(str(fd, "name"));
  await db.category.update({ where: { id }, data: { name } });
  done();
}

export async function deleteMedia(url: string): Promise<void> {
  await staff();
  const u = new URL(url);
  if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com") || !u.pathname.startsWith("/media/")) throw new Error("Not a media file.");
  await del(url);
  revalidatePath("/admin/media");
}
