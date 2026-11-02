import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import PostBody from "@/components/post-body";
import SaveButton from "@/components/save-button";
import ShareBar from "@/components/share-bar";
import CopyGuard from "@/components/copy-guard";
import PostViewTracker from "@/components/post-view-tracker";
export const dynamic = "force-dynamic";

const find = cache((key: string) => db.post.findFirst({ where: { OR: [{ slug: key }, { id: key }] }, include: { category: true } }));
const base = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await find((await params).id).catch(() => null);
  if (!p) return { title: "Not found" };
  if (!p.published) return { title: p.title, robots: { index: false, follow: false } };
  const title = p.metaTitle || p.title;
  const description = p.metaDescription || p.excerpt || p.body.replace(/[#!\[\]()]/g, "").replace(/\s+/g, " ").slice(0, 155);
  const path = `/blog/${p.slug ?? p.id}`;
  return {
    title, description, alternates: { canonical: path }, keywords: [...p.keywords, ...p.tags],
    openGraph: { type: "article", title, description, url: path, publishedTime: p.createdAt.toISOString(), tags: p.tags,
      ...(p.coverUrl ? { images: [{ url: p.coverUrl, alt: p.coverAlt ?? p.title }] } : {}) },
    twitter: { card: p.coverUrl ? "summary_large_image" : "summary", title, description },
  };
}

export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const key = (await params).id;
  const p = await find(key);
  if (!p) notFound();
  if (!p.published) {
    const role = (await auth())?.user?.role;
    if (role !== "ADMIN" && role !== "TEACHER") notFound();
  }
  if (p.slug && key !== p.slug) permanentRedirect(`/blog/${p.slug}`);
  const href = `/blog/${p.slug ?? p.id}`;
  
  const description = p.metaDescription || p.excerpt || p.body.replace(/[#!\[\]()]/g, "").replace(/\s+/g, " ").slice(0, 155);

  // 👇 আপডেট করা Article Schema 👇
  const ld = {
    "@context": "https://schema.org", 
    "@type": "Article", 
    headline: p.metaTitle || p.title,
    description: description,
    datePublished: p.createdAt.toISOString(),
    author: { "@type": "Person", name: "Saiful Islam" },
    publisher: {
      "@type": "Organization",
      name: "SaifulSir.com",
      logo: { "@type": "ImageObject", url: `${base()}/logo.png` }
    },
    mainEntityOfPage: `${base()}${href}`, 
    keywords: [...p.keywords, ...p.tags].join(", "), 
    ...(p.coverUrl ? { image: [p.coverUrl] } : {}),
  };

  // 👇 নতুন FAQ Schema (আপনার ডাটাবেসে faqs থাকলে এটি কাজ করবে) 👇
  // টাইপ এরর এড়াতে (p as any) ব্যবহার করা হলো
  const postFaqs = (p as any).faqs; 
  let faqLd = null;
  
  if (postFaqs && Array.isArray(postFaqs) && postFaqs.length > 0) {
    faqLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": postFaqs.map((faq: any) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* 👇 স্কিমা স্ক্রিপ্টসমূহ 👇 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      {faqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      )}
      
      <article>
        {/* 👁 ভিউ গণনা (শুধু Published লেখায়) */}
        {p.published && <PostViewTracker postId={p.id} />}

        {!p.published && <p className="mb-4 rounded-xl bg-orange-100 p-3 text-sm font-medium text-orange-800">Draft: only admins and teachers can see this page.</p>}
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-slate-500">
          <Link href="/" className="hover:text-royal">Home</Link>
          {p.category && <> / <Link href={`/category/${p.category.slug}`} className="hover:text-royal">{p.category.name}</Link></>}
        </nav>
        <h1 className="text-3xl font-bold leading-tight">{p.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {p.createdAt.toLocaleDateString("en-GB")}
            {p.views > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                👁 {p.views.toLocaleString("en-US")} বার পঠিত
              </span>
            )}
          </p>
          <SaveButton label item={{ id: p.id, type: "post", title: p.title, href }} />
        </div>
        {p.coverUrl && (
          <Image src={p.coverUrl} alt={p.coverAlt ?? p.title} width={1200} height={630} priority sizes="(max-width: 768px) 100vw, 672px" className="mt-6 h-auto w-full rounded-2xl" />
        )}
                <CopyGuard />
        <div className="no-copy">
          <PostBody body={p.body} />
        </div>
        {p.downloadUrl && (
          <a href={p.downloadUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-royal px-5 py-3 font-semibold text-white">
            <Download size={18} />Download
          </a>
        )}
        {p.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {p.tags.map((t) => <Link key={t} href={`/tag/${encodeURIComponent(t)}`} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-royal hover:bg-blue-100">#{t}</Link>)}
          </div>
        )}
        {p.published && <ShareBar url={`${base()}${href}`} title={p.title} tags={p.tags} />}
      </article>
    </main>
  );
}

// ===== ফাইল শেষ =====
