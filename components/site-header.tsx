"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight, Bookmark, BookOpen, Briefcase, Home,
  LayoutDashboard, LogOut, Menu, Search, X, ChevronDown,
  Sparkles, BookMarked
} from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import SavedLink from "@/components/saved-link";
import MobileHeaderDrawer from "@/components/MobileHeaderDrawer";

type U = { name?: string | null; role?: string } | null;

type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

const navTree: NavItem[] = [
  { label: "পরীক্ষা দাও (AI)", href: "/exam" },
  { label: "বইঘর", href: "/books" },
  { label: "সংবাদ", href: "/news" },
  { label: "নোট", href: "/academic" },
  { label: "ভর্তি", href: "/admission" },
  {
    label: "NTRCA",
    href: "/ntrca",
    children: [
      { label: "স্কুল পর্যায়-2", href: "/ntrca/school-2" },
      { label: "স্কুল পর্যায়", href: "/ntrca/school" },
      { label: "কলেজ পর্যায়", href: "/ntrca/college" },
      { label: "প্রিলিমিনারি প্রিপারেশন", href: "/ntrca/preli" },
      { label: "লিখিত সাজেশন", href: "/ntrca/written" },
      { label: "শুন্য পদ", href: "/ntrca/vacant" },
    ],
  },
  { label: "জব", href: "/jobs" },
  { label: "ই-বুক", href: "/library" },
  { label: "ভিডিও", href: "/videos" },
  {
    label: "মডেল টেস্ট",
    href: "/model-test",
    children: [
      { label: "📝 সব মডেল টেস্ট", href: "/model-test" },
      { label: "🏆 Global Leaderboard", href: "/model-test/leaderboard" },
      { label: "👑 Premium প্যাকেজ", href: "/packages" },
      { label: "👤 আমার প্রোফাইল", href: "/profile" },
    ],
  },
  { label: "টুলস", href: "/tools" },
  { label: "ব্লগ", href: "/blog" },
];

const tabs = [
  ["Home", "/", Home],
  ["বইঘর", "/books", BookMarked],
  ["Exam", "/exam", Sparkles],
  ["Classes", "/academic", BookOpen],
  ["Save", "/saved", Bookmark],
] as const;

function Announcement({ text }: { text: string }) {
  const key = `ann:${text}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem(key)) setHidden(true); } catch {} }, [key]);
  if (hidden || !text) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem(key, "1"); } catch {} };
  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-blue-800 to-royal px-3 py-2 text-sm text-white">
      <span aria-hidden="true">🔔</span>
      <p className="min-w-0 flex-1 truncate">{text}</p>
      <Link href="/blog" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">
        এখনই দেখুন<ArrowRight size={14} />
      </Link>
      <button onClick={close} aria-label="Close notice" className="shrink-0 rounded p-1 hover:bg-white/10"><X size={18} /></button>
    </div>
  );
}

export default function SiteHeader({ user, logout, notice }: { user: U; logout: () => Promise<void>; notice: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const on = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [open]);

  const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold";
  const outline = `${btn} border border-slate-300 bg-white text-navy-900 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200`;
  const actions = (
    <>
      <Link href="/hire" className={`${btn} bg-hire text-white hover:bg-orange-600`}><Briefcase size={16} />Hire Me</Link>
      {isAdmin && <Link href="/admin" className={outline}><LayoutDashboard size={16} />Dashboard</Link>}
      {user ? (
        <form action={logout}><button className={`${outline} w-full`}><LogOut size={16} />Log out</button></form>
      ) : (
        <Link href="/login" className={outline}>Login / Register</Link>
      )}
    </>
  );

  return (
    <>
      <Announcement text={notice} />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:bg-slate-950/95 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-4">
          
          {/* বামপাশে মেনু + ব্র্যান্ড লোগো */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => setOpen(true)} 
              aria-label="Open menu" 
              className="shrink-0 rounded-lg p-2 text-navy-900 hover:bg-slate-100 xl:hidden dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Menu size={22} />
            </button>
            
            <Link href="/" aria-label="SaifulSir.com home" className="flex items-center gap-2 group shrink-0">
              <Image 
                src="/logo.png" 
                alt="SaifulSir.com Logo" 
                width={44} 
                height={44} 
                priority 
                unoptimized
                className="h-8 sm:h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform" 
              />
              <div className="flex flex-col justify-center">
                <span className="font-black text-sm sm:text-lg tracking-tight leading-none select-none">
                  <span className="text-slate-950 dark:text-white">SAIFUL</span>
                  <span className="text-blue-600 dark:text-blue-400">SIR</span>
                  <span className="text-orange-500 dark:text-orange-400">.COM</span>
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-tight mt-0.5">
                  শিক্ষার সবকিছু একসাথে
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-1 whitespace-nowrap xl:flex px-4">
            {navTree.map((item) => (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  aria-current={on(item.href) ? "page" : undefined}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                    on(item.href) ? "bg-blue-50 text-royal font-bold" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                  {item.children && <ChevronDown size={14} className="text-slate-500 transition-transform group-hover:rotate-180" />}
                </Link>

                {item.children && (
                  <div className="absolute left-0 top-full hidden w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg group-hover:block dark:bg-slate-900 dark:border-slate-800">
                    {item.children.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-royal dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* 🎯 ঠিক চিহ্নিত স্থানে আকর্ষণীয় 'বইঘর' বাটন ও ডানপাশের কন্ট্রোল */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* 📚 আপনার চিহ্নিত স্থানের 'বইঘর' বাটন */}
            <Link
              href="/books"
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 text-white px-2.5 sm:px-3 py-1.5 text-xs font-black shadow-md shadow-emerald-500/25 active:scale-95 transition-all border border-emerald-400/40"
            >
              <BookMarked size={14} className="animate-pulse text-emerald-200" />
              <span>বইঘর</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded-full font-bold">
                PDF
              </span>
            </Link>

            <SavedLink />
            <ThemeToggle />
            <div className="hidden items-center gap-2 xl:flex">{actions}</div>
          </div>

        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <MobileHeaderDrawer
        open={open}
        onClose={() => setOpen(false)}
        userName={user?.name}
        actions={actions}
      />

      {/* Bottom Bar Navigation for Mobile */}
      <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:bg-slate-950/95 dark:border-slate-800">
        {tabs.map(([l, h, Icon]) => (
          <Link key={h} href={h} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${on(h) ? "text-royal font-bold" : "text-slate-500 dark:text-slate-400"}`}>
            <Icon size={20} />{l}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Menu size={20} />Menu
        </button>
      </nav>
    </>
  );
}

// ===== ফাইল শেষ =====
