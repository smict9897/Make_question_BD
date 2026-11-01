"use server";

import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const BACK = "/admin/packages";

function fail(message: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  redirect(`${BACK}?ok=${encodeURIComponent(message)}`);
}

function readForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Math.round(Number(formData.get("price")));
  const durationDays = Math.round(Number(formData.get("durationDays")));
  const active = formData.get("active") === "on";

  if (title.length < 2) fail("প্যাকেজের নাম কমপক্ষে ২ অক্ষর হতে হবে");
  if (!Number.isFinite(price) || price < 0) fail("দাম সঠিক নয়");
  if (!Number.isFinite(durationDays) || durationDays < 1)
    fail("মেয়াদ কমপক্ষে ১ দিন হতে হবে");

  return {
    title,
    description: description || null,
    price,
    durationDays,
    active,
  };
}

function refresh() {
  revalidatePath(BACK);
  revalidatePath("/packages");
  revalidatePath("/model-test");
}

export async function createPackage(formData: FormData) {
  await staff();
  const data = readForm(formData);
  await db.package.create({ data });
  refresh();
  done("প্যাকেজ তৈরি হয়েছে");
}

export async function updatePackage(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("প্যাকেজ আইডি পাওয়া যায়নি");
  const data = readForm(formData);
  await db.package.update({ where: { id }, data });
  refresh();
  done("প্যাকেজ আপডেট হয়েছে");
}

export async function togglePackage(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("প্যাকেজ আইডি পাওয়া যায়নি");
  const pkg = await db.package.findUnique({ where: { id } });
  if (!pkg) fail("প্যাকেজ পাওয়া যায়নি");
  await db.package.update({ where: { id }, data: { active: !pkg.active } });
  refresh();
  done(pkg.active ? "প্যাকেজ বন্ধ করা হয়েছে" : "প্যাকেজ চালু করা হয়েছে");
}

export async function deletePackage(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  if (!id) fail("প্যাকেজ আইডি পাওয়া যায়নি");
  // সতর্কতা: এই প্যাকেজের সব PackagePurchase রেকর্ডও মুছে যাবে (cascade)
  await db.package.delete({ where: { id } });
  refresh();
  done("প্যাকেজ মুছে ফেলা হয়েছে");
}

// ডিফল্ট ৩টা প্যাকেজ তৈরি (শুধু যদি কোনো প্যাকেজ না থাকে)
export async function seedDefaultPackages() {
  await staff();
  const count = await db.package.count();
  if (count > 0) fail("আগে থেকেই প্যাকেজ আছে, তাই ডিফল্ট তৈরি করা হয়নি");
  await db.package.createMany({
    data: [
      {
        title: "১ মাসের প্যাকেজ",
        description: "সব Premium মডেল টেস্ট ১ মাস আনলক",
        price: 100,
        durationDays: 30,
        active: true,
      },
      {
        title: "৬ মাসের প্যাকেজ",
        description: "সব Premium মডেল টেস্ট ৬ মাস আনলক",
        price: 450,
        durationDays: 180,
        active: true,
      },
      {
        title: "১ বছরের প্যাকেজ",
        description: "সব Premium মডেল টেস্ট ১ বছর আনলক",
        price: 700,
        durationDays: 365,
        active: true,
      },
    ],
  });
  refresh();
  done("ডিফল্ট ৩টা প্যাকেজ তৈরি হয়েছে");
}

// ===== ফাইল শেষ =====
