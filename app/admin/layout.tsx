import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Database, FileUp, FilePlus2, FolderOpen, SlidersHorizontal,
  BookOpen, PackageCheck, Sparkles, Layers,
  ListChecks, Crown, Wallet, Trophy, Globe, FileText, Mail, Eye,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import AdminNav from "@/components/admin-nav";

type QuickLink = {
  href: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  badge?: number;
};

const QB_LINKS: QuickLink[] = [
  { href: "/admin/questions", label: "প্রশ্ন ব্যাংক", sub: "প্রশ্ন যোগ ও ইমপোর্ট", Icon: Database },
  { href: "/admin/questions/manage", label: "প্রশ্ন ম্যানেজ", sub: "গণনা, ফিল্টার, অনুমোদন, মোছা", Icon: SlidersHorizontal },
  { href: "/admin/questions/extract", label: "PDF/ছবি থেকে প্রশ্ন", sub: "AI দিয়ে প্রশ্ন তোলা", Icon: FileUp },
  { href: "/question-builder", label: "প্রশ্নপত্র তৈরি", sub: "প্রশ্ন বেছে প্রশ্নপত্র বানান", Icon: FilePlus2 },
  { href: "/question-builder/saved", label: "সংরক্ষিত প্রশ্নপত্র", sub: "আগে সেভ করা প্রশ্নপত্র", Icon: FolderOpen },
];

const CONTENT_LINKS: QuickLink[] = [
  { href: "/admin/pdf", label: "ম্যাটেরিয়াল / PDF", sub: "নতুন ম্যাটেরিয়াল যোগ", Icon: FileText },
  { href: "/admin/books", label: "বইঘর ম্যানেজ", sub: "বই ও ডেমো পাতা", Icon: BookOpen },
  { href: "/admin/inquiries", label: "Inquiries", sub: "ইউজারের পাঠানো বার্তা", Icon: Mail },
  { href: "/", label: "হোম পেজ দেখুন", sub: "লাইভ সাইট", Icon: Globe },
  { href: "/exam", label: "Instant Exam", sub: "/exam পেজ", Icon: Eye },
  { href: "/tests", label: "Practice Test", sub: "/tests পেজ", Icon: Eye },
  { href: "/profile", label: "প্রোফাইল ড্যাশবোর্ড", sub: "ছাত্রের প্রোফাইল দেখুন", Icon: Eye },
];

function QuickGrid({ links }: { links: QuickLink[] }) {
  return (
    <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2 lg:grid-cols-3">
      {links.map(({ href, label, sub, Icon, badge }) => (
        <Link
          key={href}
          href={href}
          className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Icon size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {label}
              {badge ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="block text-xs text-slate-500">{sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = (await auth())?.user;

  if (u?.role !== "ADMIN") redirect(u?.role === "TEACHER" ? "/question-builder" : "/login");

  // পেন্ডিং পেমেন্ট সংখ্যা (এরর হলে 0, যাতে অ্যাডমিন পেজ না ভাঙে)
  const pending = await db.packagePurchase
    .count({ where: { status: "PENDING" } })
    .catch(() => 0);

  const MT_LINKS: QuickLink[] = [
    { href: "/admin/model-test", label: "মডেল টেস্ট ম্যানেজ", sub: "তৈরি, এডিট, ডিলিট, Leaderboard", Icon: ListChecks },
    { href: "/model-test", label: "পাবলিক ফিড", sub: "ছাত্ররা যা দেখে", Icon: Eye },
    { href: "/model-test/leaderboard", label: "Global Leaderboard", sub: "সব পরীক্ষার সেরারা", Icon: Trophy },
    { href: "/admin/package-requests", label: "পেমেন্ট অনুরোধ", sub: "Approve / Reject", Icon: Wallet, badge: pending },
    { href: "/admin/packages", label: "প্যাকেজ ম্যানেজ", sub: "দাম, মেয়াদ, চালু/বন্ধ", Icon: Crown },
    { href: "/packages", label: "ছাত্রের প্যাকেজ পেজ", sub: "ছাত্ররা যা দেখে", Icon: Eye },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/50 to-orange-50/50 min-h-screen">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 lg:flex-row">
        <AdminNav name={u?.name ?? "Admin"} role={u?.role} />

        <div className="min-w-0 flex-1">

          {/* 🛍️ ১. বইঘর ক্যাটালগ, অফার ও অর্ডার কন্ট্রোল (৩টি কুইক কার্ড) */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">

            {/* 📚 ১. বইঘর ম্যানেজার বাটন (নতুন বই যোগ করার জন্য) */}
            <Link
              href="/admin/books"
              className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 shadow-sm transition hover:bg-blue-100/70 dark:border-blue-800 dark:bg-blue-950/40 group"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                <BookOpen size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">বইঘর ম্যানেজার</span>
                  <span className="rounded-md bg-blue-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">বই</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                  নতুন বই ও ডেমো পাতা যোগ
                </span>
              </div>
            </Link>

            {/* 🎁 ২. অফার ও পপ-আপ বাটন */}
            <Link
              href="/admin/promo"
              className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-sm transition hover:bg-emerald-100/70 dark:border-emerald-800 dark:bg-emerald-950/40 group"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                <Sparkles size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">হোমপেজ পপ-আপ</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                  বইয়ের অফার ব্যানার
                </span>
              </div>
            </Link>

            {/* 📦 ৩. অর্ডার ও TrxID বাটন */}
            <Link
              href="/admin/orders"
              className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 shadow-sm transition hover:bg-indigo-100/60 dark:border-indigo-800 dark:bg-indigo-950/40 group"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                <PackageCheck size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">অর্ডার ও TrxID</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                  পেমেন্ট ও TrxID চেক
                </span>
              </div>
            </Link>

          </div>

          {/* ২. 🎯 মডেল টেস্ট ও প্যাকেজ (পেন্ডিং থাকলে নিজে খোলা থাকবে) */}
          <details
            open={pending > 0}
            className="group mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
              <span className="flex items-center gap-2">
                <ListChecks size={18} className="text-green-600" />
                মডেল টেস্ট ও প্যাকেজ
                {pending > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {pending}
                  </span>
                )}
              </span>
              <span className="text-xs font-normal text-slate-500 group-open:hidden">খুলুন ›</span>
              <span className="hidden text-xs font-normal text-slate-500 group-open:inline">বন্ধ করুন ˅</span>
            </summary>
            <QuickGrid links={MT_LINKS} />
          </details>

          {/* ৩. প্রশ্ন ব্যাংক ও প্রশ্নপত্র সেকশন */}
          <details className="group mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
              <span className="flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                প্রশ্ন ব্যাংক ও প্রশ্নপত্র
              </span>
              <span className="text-xs font-normal text-slate-500 group-open:hidden">খুলুন ›</span>
              <span className="hidden text-xs font-normal text-slate-500 group-open:inline">বন্ধ করুন ˅</span>
            </summary>
            <QuickGrid links={QB_LINKS} />
          </details>

          {/* ৪. 🌐 কনটেন্ট ও সাইট */}
          <details className="group mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
              <span className="flex items-center gap-2">
                <Layers size={18} className="text-purple-600" />
                কনটেন্ট ও সাইট
              </span>
              <span className="text-xs font-normal text-slate-500 group-open:hidden">খুলুন ›</span>
              <span className="hidden text-xs font-normal text-slate-500 group-open:inline">বন্ধ করুন ˅</span>
            </summary>
            <QuickGrid links={CONTENT_LINKS} />
          </details>

          {children}
        </div>
      </div>
    </div>
  );
}

// ===== ফাইল শেষ =====
