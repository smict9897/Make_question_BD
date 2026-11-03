"use client";
import CategorySelector from "@/components/category-selector";
import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { savePost, uploadInline, type PostState } from "@/app/actions/posts";
import { parseTags } from "@/lib/tags";
import RichEditor from "@/components/rich-editor";
import SeoPanel from "@/components/seo-panel";
import AdminKeywordTool from "@/components/admin-keyword-tool";
import { Code, Eye, Pencil, Wrench, FileText, UploadCloud, Loader2, AlertCircle } from "lucide-react";

const OPEN = '<div class="raw-html not-prose">';
const isRawBody = (b: string) => b.trim().startsWith(OPEN);
const wrapRaw = (h: string) => (isRawBody(h) ? h.trim() : `${OPEN}${h.trim()}</div>`);
const unwrapRaw = (b: string) => {
  const t = b.trim();
  return isRawBody(t) ? t.slice(OPEN.length).replace(/<\/div>\s*$/, "").trim() : b;
};

async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;
    if (file.size <= 600_000 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export type PostFormData = {
  id?: string; title: string; slug: string; categoryId: string; chapter?: string; tags: string; published: boolean; focusKeyword: string; keywords: string;
  metaTitle: string; metaDescription: string; coverUrl: string | null; coverAlt: string; downloadUrl: string; body: string;
};
const empty: PostFormData = {
  title: "", slug: "", categoryId: "", tags: "", published: true, focusKeyword: "", keywords: "", metaTitle: "", metaDescription: "",
  coverUrl: null, coverAlt: "", downloadUrl: "", body: "",
};
const f = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2";
const init: PostState = { msg: "" };

type Tab = "compose" | "html" | "preview";
const isEscapedTable = (s: string) => /&lt;\s*table\b/i.test(s);
const risky = (s: string) => /<table\b|style=/i.test(s);

function repairEscapedHtml(s: string): string {
  return s
    .replace(/<\/(div|p)>\s*<(div|p)[^>]*>/gi, "\n")
    .replace(/^\s*<(div|p)[^>]*>/i, "")
    .replace(/<\/(div|p)>\s*$/i, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?a\b[^>]*>/gi, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .trim();
}

function L({ t, hint, n, max }: { t: string; hint?: string; n?: number; max?: number }) {
  return (
    <span className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium">
      <span>{t}{hint && <span className="ml-2 font-normal text-slate-500">{hint}</span>}</span>
      {max !== undefined && n !== undefined && (
        <span className={`text-xs ${n > max ? "text-red-600" : n >= max * 0.8 ? "text-orange-600" : "text-slate-500"}`}>{n}/{max}</span>
      )}
    </span>
  );
}

export default function PostForm({ post = empty, cats }: { post?: PostFormData; cats: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(savePost.bind(null, post.id ?? null), init);
  const [v, setV] = useState({
    title: post.title, slug: post.slug, tags: post.tags, focusKeyword: post.focusKeyword, keywords: post.keywords,
    metaTitle: post.metaTitle, metaDescription: post.metaDescription,
  });

  const startRaw = isRawBody(post.body) || /<table\b/i.test(post.body) || isEscapedTable(post.body);
  const [html, setHtml] = useState(isRawBody(post.body) ? unwrapRaw(post.body) : post.body);
  const [raw, setRaw] = useState(startRaw);
  const [tab, setTab] = useState<Tab>(startRaw ? "html" : "compose");
  const [info, setInfo] = useState({ text: "", headings: [] as string[], words: 0 });
  const [coverMsg, setCoverMsg] = useState("");

  const [uploadingDocx, setUploadingDocx] = useState(false);
  const [uploadingHtml, setUploadingHtml] = useState(false);
  const [docxWarning, setDocxWarning] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const docxFileRef = useRef<HTMLInputElement>(null);
  const htmlFileRef = useRef<HTMLInputElement>(null);

  const on = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const addKeyword = (kw: string, target: "auto" | "focus" | "keywords" = "auto") => {
    setV((p) => {
      const toFocus = target === "focus" || (target === "auto" && !p.focusKeyword.trim());
      if (toFocus) return { ...p, focusKeyword: kw.slice(0, 80) };
      const list = p.keywords.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.some((s) => s.toLowerCase() === kw.toLowerCase())) return p;
      return { ...p, keywords: [...list, kw].slice(0, 10).join(", ") };
    });
  };

  const applySeo = (p: { title?: string; slug?: string; metaTitle?: string; metaDescription?: string; tags?: string }) => {
    setV((s) => ({
      ...s,
      ...(p.title !== undefined ? { title: p.title.slice(0, 200) } : {}),
      ...(p.slug !== undefined ? { slug: p.slug } : {}),
      ...(p.metaTitle !== undefined ? { metaTitle: p.metaTitle.slice(0, 70) } : {}),
      ...(p.metaDescription !== undefined ? { metaDescription: p.metaDescription.slice(0, 170) } : {}),
      ...(p.tags !== undefined ? { tags: p.tags } : {}),
    }));
  };

  // 👇 নতুন আর্টিকেল বডি ইভেন্ট লিসেনার 👇
  useEffect(() => {
    const handleBodyInsert = (e: Event) => {
      const customEvent = e as CustomEvent<{ content: string }>;
      const { content } = customEvent.detail;
      if (content) {
        setHtml(content);
        setTab("html"); // কন্টেন্ট দেখতে HTML ট্যাবে নিয়ে যাবে
        setRaw(true);
      }
    };
    window.addEventListener("cms:body", handleBodyInsert);
    return () => window.removeEventListener("cms:body", handleBodyInsert);
  }, []);
  // 👆 -------------------------------- 👆

  useEffect(() => {
    const doc = new DOMParser().parseFromString(html.replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, " </$1>"), "text/html");
    const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
    setInfo({ text, headings: Array.from(doc.querySelectorAll("h2,h3,h4")).map((h) => (h.textContent ?? "").trim()), words: text ? text.split(" ").length : 0 });
  }, [html]);

  const goTab = (next: Tab) => {
    if (next === "compose" && raw) {
      if (risky(html) && !confirm("Compose এডিটর টেবিল ও জটিল স্টাইল মুছে ফেলতে পারে। তবুও Compose-এ যাবেন?")) return;
      setRaw(false);
    }
    setTab(next);
  };

  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) { setCoverMsg(""); return; }
    setCoverMsg("ছবি ছোট করা হচ্ছে…");
    const small = await compressImage(file);
    try {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
    } catch {
      // fallback
    }
    setCoverMsg(small.size > 3_000_000
      ? "ছবিটি এখনও ৩ MB-এর বেশি, ছোট ছবি বাছুন।"
      : `ছবি তৈরি (${Math.round(small.size / 1024)} KB)।`);
  };

  // Word (.docx) ফাইল কনভার্টার
  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setUploadError("শুধুমাত্র .docx ফাইল নির্বাচন করুন।");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("ফাইল সাইজ ২৫ MB এর বেশি হতে পারবে না।");
      return;
    }

    setUploadingDocx(true);
    setUploadError(null);
    setDocxWarning(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore
      const mammoth: any = await import("mammoth/mammoth.browser");

      const options = {
        convertImage: mammoth.images.imgElement(async (image: any) => {
          const imageBuffer = await image.read();
          const contentType = image.contentType || "image/png";
          const blob = new Blob([imageBuffer], { type: contentType });
          const ext = contentType.split("/")[1] || "png";
          const imgFile = new File([blob], `word-${Date.now()}.${ext}`, { type: contentType });
          
          const fd = new FormData();
          fd.set("image", imgFile);
          fd.set("alt", "Document illustration");
          
          const res = await uploadInline(fd);
          if (res.url) {
            return { src: res.url };
          }
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ src: reader.result as string });
            reader.readAsDataURL(blob);
          });
        }),
      };

      const result = await mammoth.convertToHtml({ arrayBuffer }, options);
      const convertedHtml = result.value;

      setHtml(convertedHtml);
      setRaw(true);
      setTab("html");

      if (result.messages && result.messages.length > 0) {
        const msgs = result.messages.map((m: any) => m.message).slice(0, 3).join("; ");
        setDocxWarning(`ফরম্যাটিং নোট: ${msgs}`);
      }

      if (!v.title) {
        setV((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, "").slice(0, 200) }));
      }
    } catch (err: any) {
      setUploadError(`Word ফাইল পড়তে সমস্যা হয়েছে: ${err?.message || "অজানা ত্রুটি"}`);
    } finally {
      setUploadingDocx(false);
      if (docxFileRef.current) docxFileRef.current.value = "";
    }
  };

  // 🎯 HTML ফাইল প্রসেসর (সিএসএস ও <style> অক্ষুণ্ণ রেখে কম্পাইলার মোড)
  const handleHtmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".html") && !file.name.toLowerCase().endsWith(".htm")) {
      setUploadError("শুধুমাত্র .html বা .htm ফাইল নির্বাচন করুন।");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("ফাইল সাইজ ১০ MB এর বেশি হতে পারবে না।");
      return;
    }

    setUploadingHtml(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = String(event.target?.result || "");
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawContent, "text/html");

        // ক্ষতিকর স্ক্রিপ্ট ও অবজেক্ট বাদ দেওয়া হবে (style অক্ষুণ্ণ থাকবে)
        const dangerous = doc.querySelectorAll("script, iframe, object, embed, form");
        dangerous.forEach((el) => el.remove());

        doc.querySelectorAll("*").forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name.toLowerCase().startsWith("on") || attr.value.toLowerCase().startsWith("javascript:")) {
              el.removeAttribute(attr.name);
            }
          });
        });

        // <head>-এর সব <style> ট্যাগ সংগ্রহ করে বডির শুরুতে যুক্ত করা
        const allStyles = Array.from(doc.querySelectorAll("style"))
          .map((s) => s.outerHTML)
          .join("\n");

        const bodyContent = (allStyles ? allStyles + "\n" : "") + (doc.body ? doc.body.innerHTML : rawContent);

        setHtml(bodyContent);
        setRaw(true);
        setTab("html");

        if (!v.title) {
          const docTitle = doc.querySelector("title")?.textContent;
          if (docTitle) setV((prev) => ({ ...prev, title: docTitle.trim().slice(0, 200) }));
        }
      } catch (err: any) {
        setUploadError(`HTML ফাইল প্রসেস করতে ব্যর্থ: ${err?.message}`);
      } finally {
        setUploadingHtml(false);
        if (htmlFileRef.current) htmlFileRef.current.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const previewDoc =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>` +
    `body{margin:0;padding:16px;font-family:'Times New Roman',Times,system-ui,sans-serif;line-height:1.75;color:#0f172a;background:#fff}` +
    `img{max-width:100%;height:auto;border-radius:12px;margin:16px auto;display:block}` +
    `table{width:100%;border-collapse:collapse;margin:16px 0;display:block;overflow-x:auto}` +
    `th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}` +
    `th{background:#f1f5f9;font-weight:700}` +
    `h1,h2,h3{color:#1e293b;font-weight:700;margin-top:24px}` +
    `blockquote{border-left:4px solid #2563eb;margin:16px 0;padding-left:16px;color:#475569;font-style:italic}` +
    `a{color:#2563eb;text-decoration:underline}` +
    `</style></head><body>${html}</body></html>`;

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => goTab(t)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t ? "bg-royal text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
    >
      {icon}<span>{label}</span>
    </button>
  );

  const tagList = parseTags(v.tags, info.text);

  return (
    <form action={action} className="grid gap-4">
      <label><L t="Title" n={v.title.length} max={200} /><input name="title" required value={v.title} onChange={on("title")} className={f} /></label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <L t="Post text" hint={`${info.words} শব্দ`} />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {tabBtn("compose", "Compose", <Pencil size={14} />)}
            {tabBtn("html", "HTML", <Code size={14} />)}
            {tabBtn("preview", "Preview", <Eye size={14} />)}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={docxFileRef}
              onChange={handleDocxUpload}
              accept=".docx"
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingDocx}
              onClick={() => docxFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
            >
              {uploadingDocx ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              <span>Word ফাইল আপলোড (.docx)</span>
            </button>

            <input
              type="file"
              ref={htmlFileRef}
              onChange={handleHtmlUpload}
              accept=".html,.htm"
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingHtml}
              onClick={() => htmlFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 transition disabled:opacity-50"
            >
              {uploadingHtml ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
              <span>HTML ফাইল আপলোড (.html)</span>
            </button>
          </div>
        </div>

        <div className="mb-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
          <span><strong>সতর্কতা:</strong> ফাইল অবশ্যই ইউনিকোড ফন্টে (Nirmala UI, Kalpurush) লেখা হতে হবে। বিজয়/SutonnyMJ হলে অক্ষর ভাঙবে।</span>
        </div>

        {uploadError && (
          <div className="mb-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-600">
            {uploadError}
          </div>
        )}

        {docxWarning && (
          <div className="mb-2 rounded-xl bg-slate-50 border border-slate-200 p-2 text-xs text-slate-600">
            {docxWarning}
          </div>
        )}

        {isEscapedTable(html) && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <span>এই পোস্টের টেবিল কোড লেখা হিসেবে সেভ হয়ে গেছে। এক ক্লিকে ঠিক করা যাবে।</span>
            <button
              type="button"
              onClick={() => { setHtml(repairEscapedHtml(html)); setRaw(true); setTab("html"); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
            >
              <Wrench size={14} /> টেবিল কোড ঠিক করুন
            </button>
          </div>
        )}

        <input type="hidden" name="body" value={raw ? wrapRaw(html) : html} />

        {tab === "compose" && <RichEditor name="body_editor" initialHtml={html} onChange={setHtml} />}

        {tab === "html" && (
          <textarea
            value={html}
            onChange={(e) => { setHtml(e.target.value); setRaw(true); }}
            rows={18}
            spellCheck={false}
            placeholder="সরাসরি HTML কোড পেস্ট করুন"
            className="w-full rounded-xl border border-slate-300 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-emerald-400 focus:outline-none sm:text-sm"
          />
        )}

        {tab === "preview" && (
          <iframe
            title="Preview"
            sandbox=""
            srcDoc={previewDoc}
            className="h-[480px] w-full rounded-xl border border-slate-300 bg-white"
          />
        )}

        <p className="mt-1 text-[11px] text-slate-500">
          {tab === "html" ? "HTML ট্যাবের কোড হুবহু সেভ হবে (টেবিল, বর্ডার ও রঙসহ)।" : tab === "preview" ? "এটা সেভ করার আগের প্রিভিউ।" : "সাধারণ লেখার জন্য Compose। টেবিলের কোড HTML ট্যাবে দিন।"}
        </p>
      </div>

      <label><L t="Hashtags" hint="separate with spaces, e.g. #hsc #গণিত #class8" n={tagList.length} max={15} />
        <input name="tags" value={v.tags} onChange={on("tags")} className={f} placeholder="#hsc #গণিত #class8" />
      </label>
      {tagList.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Tags that will be saved">
          {tagList.map((t) => <span key={t} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-royal">#{t}</span>)}
        </div>
      )}
      <div>
  <L t="Category (Class, Subject & Chapter)" />
  <CategorySelector 
    cats={cats as any} 
    initialCategoryId={post.categoryId} 
    initialChapter={post.chapter} 
  />
</div>

           {post.coverUrl && (
        <div>
          <L t="Current cover image" />
          <Image src={post.coverUrl} alt={post.coverAlt || post.title} width={400} height={210} className="h-auto w-full max-w-sm rounded-xl" />
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="removeCover" />Remove this cover image</label>
        </div>
      )}
      <label>
        <L t={post.coverUrl ? "Replace cover image" : "Cover image"} hint="মোবাইলের ছবিও চলবে, নিজে ছোট হবে" />
        <input name="cover" type="file" accept="image/*" onChange={onCover} className={f} />
      </label>
      {coverMsg && <p className="-mt-2 text-xs text-slate-500">{coverMsg}</p>}
      <label><L t="Cover image alt text" hint="required with a cover image" /><input name="coverAlt" maxLength={200} defaultValue={post.coverAlt} className={f} /></label>
      <label><L t="Download link" hint="Google Drive or PDF link, optional" /><input name="downloadUrl" type="url" defaultValue={post.downloadUrl} className={f} placeholder="https://" /></label>

      <fieldset className="grid gap-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold">SEO (গুগল সার্চের জন্য)</legend>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold">AI কিওয়ার্ড রিসার্চ (ঐচ্ছিক)</summary>
          <div className="mt-3">
            <AdminKeywordTool compact onSelectKeyword={addKeyword} onApplySeo={applySeo} />
          </div>
        </details>

        <label><L t="Focus keyword" hint="যে শব্দ লিখে সার্চে আসতে চান, একটি" /><input name="focusKeyword" maxLength={80} value={v.focusKeyword} onChange={on("focusKeyword")} className={f} placeholder="যেমন: ৮ম শ্রেণির গণিত সমাধান" /></label>
        <label><L t="Keywords" hint="কমা দিয়ে আলাদা করুন, সর্বোচ্চ ১০টি" /><textarea name="keywords" rows={2} value={v.keywords} onChange={on("keywords")} className={f} placeholder="class 8 math, ৮ম শ্রেণির গণিত, গণিত সমাধান pdf" /></label>
        <label><L t="URL slug" hint="English letters, numbers, hyphens. Blank = use ID" /><input name="slug" value={v.slug} onChange={on("slug")} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={f} placeholder="class-8-math-guide" /></label>
        <label><L t="Meta title" hint="shown on Google" n={v.metaTitle.length} max={60} /><input name="metaTitle" maxLength={70} value={v.metaTitle} onChange={on("metaTitle")} className={f} /></label>
        <label><L t="Meta description" hint="shown under the title on Google" n={v.metaDescription.length} max={160} /><textarea name="metaDescription" maxLength={170} rows={3} value={v.metaDescription} onChange={on("metaDescription")} className={f} /></label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Google preview</p>
          <p className="truncate text-sm text-green-800">saifulsir.com › blog › {v.slug || "..."}</p>
          <p className="truncate text-lg text-blue-700">{v.metaTitle || v.title || "Post title"}</p>
          <p className="line-clamp-2 text-sm text-slate-600">{v.metaDescription || "The meta description appears here."}</p>
        </div>
        <SeoPanel kw={v.focusKeyword} title={v.title} slug={v.slug} metaTitle={v.metaTitle} metaDescription={v.metaDescription} text={info.text} headings={info.headings} words={info.words} />
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="published" defaultChecked={post.published} />Publish now (untick to save as a draft)</label>
      {state.msg && <p role="alert" className="text-sm text-red-600">{state.msg}</p>}
      <button disabled={pending} className="rounded-xl bg-royal px-4 py-2.5 font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : post.id ? "Save changes" : "Save post"}
      </button>
    </form>
  );
}
