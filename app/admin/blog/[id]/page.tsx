import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bodyToEditorHtml, cleanHtml } from "@/lib/html";
import PostForm from "@/components/post-form";
export const dynamic = "force-dynamic";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const [p, cats] = await Promise.all([
    db.post.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!p) notFound();
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <Link href="/admin/posts" className="text-sm text-royal">← Back to posts</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Edit post</h1>
      <PostForm cats={cats} post={{
        id: p.id, 
        title: p.title, 
        slug: p.slug ?? "", 
        categoryId: p.categoryId ?? "", 
        chapter: (p as any).chapter ?? "", 
        tags: p.tags.map((t) => `#${t}`).join(" "),
        published: p.published, // 👈 এই লাইনটি নতুন যোগ করা হলো
        focusKeyword: p.focusKeyword ?? "", 
        keywords: p.keywords.join(", "),
        metaTitle: p.metaTitle ?? "", 
        metaDescription: p.metaDescription ?? "", 
        coverUrl: p.coverUrl, 
        coverAlt: p.coverAlt ?? "", 
        downloadUrl: p.downloadUrl ?? "", 
        body: cleanHtml(bodyToEditorHtml(p.body)),
      }} />
    </div>
  );
}
