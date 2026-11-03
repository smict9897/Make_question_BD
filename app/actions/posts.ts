"use server";
import { put, del } from "@vercel/blob";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { parseTags } from "@/lib/tags";
import { cleanHtml, htmlToText } from "@/lib/html";
import { broadcastToSocial } from "@/lib/social-share"; // 👈 অটোমেশন ফাংশন ইমপোর্ট

export type PostState = { msg: string };
export type MediaState = { msg: string; snippet?: string };

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugField = z.string().trim().toLowerCase().refine((s) => s === "" || slugRe.test(s), "use only English letters, numbers and hyphens");

// টাস্ক D: ৭,০০০+ শব্দের জন্য বডি সাইজ বাড়িয়ে ২,০০০,০০০ ক্যারেক্টার করা হলো
const PostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().min(1).max(2000000),
  slug: slugField,
  focusKeyword: z.string().trim().max(80),
  keywords: z.string().max(1200),
  categoryId: z.string(),
  chapter: z.string().max(200).optional(), 
  tags: z.string().max(800),
  metaTitle: z.string().trim().max(70),
  metaDescription: z.string().trim().max(170),
  coverAlt: z.string().trim().max(200),
  downloadUrl: z.string().trim().refine((s) => s === "" || s.startsWith("https://"), "must start with https://"),
});

async function uploadImage(file: File, alt: string, folder: string): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) throw new Error("Image must be JPG, PNG or WebP, up to 5 MB.");
  if (!alt) throw new Error("Add alt text that describes the image.");
  return (await put(`${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`, file, { access: "public" })).url;
}

export async function savePost(id: string | null, _: PostState, fd: FormData): Promise<PostState> {
  try {
    // সার্ভার সাইড সিকিউরিটি: শুধুমাত্র শিক্ষক বা অ্যাডমিন
    await staff();
    const d = PostSchema.parse(Object.fromEntries(fd));
    
    // সার্ভার সাইড স্যানিটাইজেশন
    const html = cleanHtml(d.body);
    const text = htmlToText(html);
    if (text.length < 20) return { msg: "Post text is too short. Write at least 20 characters." };
    
    const keywords = Array.from(new Set(d.keywords.split(/[,\n،]+/).map((k) => k.trim()).filter((k) => k.length >= 2 && k.length <= 60))).slice(0, 10);
    if (d.slug) {
      const other = await db.post.findUnique({ where: { slug: d.slug } });
      if (other && other.id !== id) return { msg: "This URL slug is already used. Choose another." };
    }
    const old = id ? await db.post.findUnique({ where: { id } }) : null;
    if (id && !old) return { msg: "Post not found." };
    
    const file = fd.get("cover");
    let coverUrl = old?.coverUrl ?? null;
    if (file instanceof File && file.size > 0) coverUrl = await uploadImage(file, d.coverAlt, "blog");
    else if (fd.get("removeCover") === "on") coverUrl = null;
    if (coverUrl && !d.coverAlt) return { msg: "Add alt text that describes the cover image." };
    
    const isPublished = fd.get("published") === "on";

    const data = {
      title: d.title, 
      body: html, 
      excerpt: text.slice(0, 300), 
      focusKeyword: d.focusKeyword || null, 
      keywords, 
      slug: d.slug || null, 
      categoryId: d.categoryId || null,
      chapter: d.chapter || null,
      tags: parseTags(d.tags, text), 
      published: isPublished,
      metaTitle: d.metaTitle || null, 
      metaDescription: d.metaDescription || null,
      downloadUrl: d.downloadUrl || null, 
      coverUrl, 
      coverAlt: coverUrl ? d.coverAlt : null,
    };
    
    let savedPost;
    if (old) {
      savedPost = await db.post.update({ where: { id: old.id }, data });
      if (old.coverUrl && old.coverUrl !== coverUrl) await del(old.coverUrl).catch(() => {});
    } else {
      savedPost = await db.post.create({ data });
    }

    // 🚀 অটোমেশন: পোস্টটি Published হলে স্বয়ংক্রিয়ভাবে Telegram, Facebook ও WhatsApp-এ চলে যাবে
    if (isPublished) {
      try {
        let isNews = false;
        if (d.categoryId) {
          const cat = await db.category.findUnique({ where: { id: d.categoryId } }).catch(() => null);
          if (cat?.slug === "news") isNews = true;
        }

        const siteUrl = process.env.SITE_URL || "https://saifulsir.com";
        const postUrl = `${siteUrl}/${isNews ? "news" : "blog"}/${savedPost.slug || savedPost.id}`;

        // সোশ্যাল মিডিয়ায় অটো-পোস্ট পাঠানো
        await broadcastToSocial({
          title: d.title,
          url: postUrl,
          excerpt: text.slice(0, 180),
          coverUrl: coverUrl,
        });
      } catch (socialErr) {
        console.error("Social broadcast failed:", socialErr);
      }
    }

  } catch (e) {
    if (e instanceof z.ZodError) return { msg: `${e.issues[0].path.join(".") || "Form"}: ${e.issues[0].message}` };
    return { msg: e instanceof Error ? e.message : "Could not save the post." };
  }
  
  revalidatePath("/", "layout");
  redirect("/admin/posts");
}

export async function deletePost(id: string): Promise<void> {
  await staff();
  const p = await db.post.findUnique({ where: { id } });
  if (!p) return;
  await db.post.delete({ where: { id } });
  if (p.coverUrl) await del(p.coverUrl).catch(() => {});
  revalidatePath("/", "layout");
}

export async function addCategory(fd: FormData): Promise<void> {
  await staff();
  const d = z.object({
    name: z.string().trim().min(2).max(80),
    slug: slugField.refine((s) => s !== "", "slug is required"),
    parentId: z.string(),
  }).parse(Object.fromEntries(fd));
  let slug = d.slug, n = 2;
  while (await db.category.findUnique({ where: { slug } })) slug = `${d.slug}-${n++}`;
  await db.category.create({ data: { name: d.name, slug, parentId: d.parentId || null } });
  revalidatePath("/", "layout");
}

export async function deleteCategory(id: string): Promise<void> {
  await staff();
  await db.category.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function uploadMedia(_: MediaState, fd: FormData): Promise<MediaState> {
  try {
    await staff();
    const file = fd.get("image");
    const alt = String(fd.get("alt") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) return { msg: "Choose an image." };
    const url = await uploadImage(file, alt, "media");
    return { msg: "Uploaded. Copy this line into your post text on its own paragraph.", snippet: `![${alt.replace(/[[\]]/g, "")}](${url})` };
  } catch (e) {
    return { msg: e instanceof Error ? e.message : "Upload failed." };
  }
}

// টাস্ক B: Word ডকুমেন্টের ছবি আপলোডের জন্য ব্যবহৃত হেল্পার
export async function uploadInline(fd: FormData): Promise<{ url?: string; error?: string }> {
  try {
    await staff();
    const file = fd.get("image");
    const alt = String(fd.get("alt") ?? "Illustration").trim();
    if (!(file instanceof File) || file.size === 0) return { error: "ছবি বাছুন।" };
    return { url: await uploadImage(file, alt, "media") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
      }
