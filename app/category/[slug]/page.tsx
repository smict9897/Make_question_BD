// app/category/[slug]/page.tsx

import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NCTB_CLASSES } from "@/lib/nctb-data"; // 👈 নতুন ইমপোর্ট
import { BookOpen, FileText } from "lucide-react"; // 👈 আইকন ইমপোর্ট

export const dynamic = "force-dynamic";

const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const get = cache((slug: string) => db.category.findUnique({ where: { slug }, include: { parent: true, children: true } }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const c = await get(dec(resolvedParams.slug)).catch(() => null);
  if (!c) return { title: "Not found" };
  return { title: c.name, description: `${c.name} এর সব গাইড, নোট ও সাজেশন।`, alternates: { canonical: `/category/${c.slug}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const c = await get(dec(resolvedParams.slug));
  if (!c) notFound();

  // This category plus every child, grandchild and so on.
  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const ids = new Set<string>([c.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const k of all) {
      if (k.parentId && ids.has(k.parentId) && !ids.has(k.id)) { ids.add(k.id); grew = true; }
    }
  }
  const targetCategoryIds = Array.from(ids);

  const posts = await db.post.findMany({
    where: { published: true, categoryId: { in: targetCategoryIds } },
    orderBy: { createdAt: "desc" },
  });

  // 👇 NCTB ডাটা থেকে অধ্যায় খুঁজে বের করা (যদি এটি সাব-ক্যাটাগরি/বিষয় হয়) 👇
  let chapters: string[] = [];
  if (c.parent) {
    const classData = NCTB_CLASSES.find(cd => cd.class === c.parent?.name);
    const subjectData = classData?.subjects.find(s => s.name === c.name);
    if (subjectData) chapters = subjectData.chapters ?? []; // ✅ ফিক্সড: undefined হলে খালি অ্যারে
  }

  // 👇 সাইডারের মতো একই ক্লাসের অন্যান্য বিষয়গুলো আনা (Pills এর জন্য) 👇
  let siblings: { id: string, name: string, slug: string }[] = [];
  if (c.parentId) {
    siblings = await db.category.findMany({
      where: { parentId: c.parentId },
      select: { id: true, name: true, slug: true }
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      {/* ব্রেডক্রাম্ব */}
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href="/" className="hover:text-royal">Home</Link>
        {c.parent && <> / <Link href={`/category/${c.parent.slug}`} className="hover:text-royal">{c.parent.name}</Link></>}
      </nav>

      {/* টাইটেল এবং কাউন্ট */}
      <div className="flex items-center gap-2">
        {c.children.length > 0 ? <BookOpen className="text-royal h-6 w-6" /> : <FileText className="text-emerald-600 h-6 w-6" />}
        <h1 className="text-2xl font-bold">{c.name} <span className="text-base font-normal text-slate-500">({posts.length} টি কন্টেন্ট)</span></h1>
      </div>

      {/* পিল বা বাটনসমূহ (সাব-ক্যাটাগরি থাকলে ভেতরের বিষয়, না থাকলে অন্যান্য বিষয়) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {c.children.length > 0 
          ? // যদি এটি মেইন ক্যাটাগরি হয় (যেমন Class 9-10), তবে ভেতরের বিষয়গুলো দেখাবে
            c.children.map((k) => (
              <Link key={k.id} href={`/category/${k.slug}`} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:border-royal hover:text-royal">
                {k.name}
              </Link>
            ))
          : // যদি এটি সাব-ক্যাটাগরি হয়, তবে একই ক্লাসের অন্যান্য বিষয়গুলো দেখাবে
            siblings.map((sib) => (
              <Link key={sib.id} href={`/category/${sib.slug}`} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${sib.id === c.id ? 'border-royal bg-royal text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-royal hover:text-royal'}`}>
                {sib.name}
              </Link>
            ))
        }
      </div>

      {/* 👇 অধ্যায়সমূহ (Chapters) সেকশন 👇 */}
      {chapters.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
            <FileText className="text-blue-600" size={20} /> অধ্যায়সমূহ
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {chapters.map((chapter, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-white hover:shadow-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-royal">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{chapter}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* পোস্ট গ্রিড */}
      {posts.length === 0 && chapters.length === 0 && <p className="mt-6 text-slate-600">এখনো কোনো পোস্ট নেই।</p>}
      
      {posts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-slate-800">নোট ও পোস্টসমূহ</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug ?? p.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="relative aspect-video bg-gradient-to-br from-royal to-sky-400">
                  {p.coverUrl && <Image src={p.coverUrl} alt={p.coverAlt ?? p.title} fill sizes="(max-width: 640px) 100vw, 340px" className="object-cover transition group-hover:scale-105" />}
                </div>
                <div className="p-4">
                  <h3 className="font-bold leading-snug group-hover:text-royal transition">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{p.metaDescription || p.excerpt || p.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
