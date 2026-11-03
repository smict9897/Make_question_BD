import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileText,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";

// লিংকগুলো এক জায়গায় — বদলাতে হলে শুধু এখানে বদলান
const LINKS = {
  database: "/question-builder",
  live: "/model-test",
  exam: "/exam",
  tests: "/tests",
  books: "/books",
  tools: "/tools",
};

const css = `
.hfc{--card:#fff;--text:#0f1f4d;--muted:#6b7280;--border:#e6eaf3;--blue:#2563eb;
  max-width:1120px;margin:0 auto;padding:8px 16px 0;text-align:left;color:var(--text)}
.dark .hfc{--card:#111c33;--text:#f1f5f9;--muted:#94a3b8;--border:#26344d;--blue:#6ea0ff}
.hfc a{text-decoration:none;color:inherit}
.hfc svg{flex-shrink:0}

.hfc-head{margin-bottom:12px}
.hfc-head h2{font-size:22px;font-weight:800;display:flex;align-items:center;gap:10px;color:var(--text);margin:0}
.hfc-head h2 em{font-style:normal;color:var(--blue)}
.hfc-gdot{width:20px;height:20px;border-radius:50%;background:rgba(34,197,94,.18);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.hfc-gdot i{width:11px;height:11px;border-radius:50%;background:#22c55e;display:block}
.hfc-head p{font-size:13.5px;color:var(--muted);margin:2px 0 0}

.hfc-layout{display:grid;gap:12px;grid-template-columns:1fr}

/* হিরো */
.hfc-hero{position:relative;overflow:hidden;color:#fff;border-radius:22px;padding:16px;
  background:radial-gradient(circle at 0% 100%,rgba(124,58,237,.38),transparent 55%),
  linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#4f6fe0 100%);
  box-shadow:0 12px 26px rgba(37,99,235,.28)}
.hfc-hero::before{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(rgba(255,255,255,.13) 1.2px,transparent 1.5px);background-size:16px 16px}
.hfc-hero>*{position:relative}
.hfc-hero-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.hfc-hero-ic{width:42px;height:42px;border-radius:13px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center}
.hfc-hero h3{font-size:19px;font-weight:800;margin:0}
.hfc-hero p.hfc-d{font-size:13px;opacity:.95;margin:0 0 12px;line-height:1.5}
.hfc-btns{display:grid;gap:9px;grid-template-columns:1fr 1fr}
.hfc-btn{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:15px;transition:transform .15s}
a.hfc-btn:hover{transform:translateY(-2px)}
.hfc-bt{display:flex;align-items:center;gap:7px}
.hfc-bt b{font-size:14.5px;font-weight:800}
.hfc-arr{margin-left:auto}
.hfc-btn small{font-size:12px}
.hfc-db{background:#fff;color:#1e3a8a !important}
.hfc-db small{color:#64748b}
.hfc-ai{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff !important;border:1px solid rgba(255,255,255,.3);box-shadow:0 8px 18px rgba(234,88,12,.3)}
.hfc-ai small{opacity:.9}
.hfc-soon{margin-left:auto;background:#fde047;color:#713f12;font-size:10.5px;font-weight:800;padding:1px 8px;border-radius:999px}

/* লাইভ কার্ড — মোবাইল/ট্যাবলেট */
.hfc-live-m{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:12px 14px 12px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 6px 16px rgba(15,37,87,.07)}
.hfc-live-m::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:linear-gradient(180deg,#ef4444,#f97316)}
.hfc-lm-ic{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(239,68,68,.28)}
.hfc-lm-body{flex:1;min-width:0}
.hfc-lm-title{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
.hfc-lm-title b{font-size:15.5px;font-weight:800;color:var(--text)}
.hfc-lm-body p{font-size:12.5px;color:var(--muted);margin:2px 0 0;line-height:1.45}
.hfc-pill-l{display:inline-flex;align-items:center;gap:5px;background:#fee2e2;color:#dc2626;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px}
.hfc-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;animation:hfcPulse 1.2s infinite}
@keyframes hfcPulse{50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){.hfc-dot{animation:none}}
.hfc-chev{color:var(--muted)}

/* লাইভ কার্ড — ডেস্কটপ */
.hfc-live-d{display:none;position:relative;overflow:hidden;color:#fff;border-radius:22px;padding:20px;flex-direction:column;
  background:linear-gradient(135deg,#c2410c 0%,#ea580c 45%,#f59e0b 100%);
  box-shadow:0 12px 26px rgba(234,88,12,.28)}
.hfc-live-d::before{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(rgba(255,255,255,.13) 1.2px,transparent 1.5px);background-size:16px 16px}
.hfc-live-d>*{position:relative}
.hfc-ld-top{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
.hfc-ld-ic{width:48px;height:48px;border-radius:15px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center}
.hfc-ld-top h3{font-size:19px;font-weight:800;line-height:1.3;margin:0}
.hfc-pill-d{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.3);font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px;margin:4px 0}
.hfc-ld-top p{font-size:13px;opacity:.95;line-height:1.5;margin:0}
.hfc-ld-tags{display:flex;flex-wrap:wrap;gap:7px}
.hfc-ld-tags span{font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.34)}
.hfc-ld-gap{flex:1;min-height:14px}
.hfc-ld-cta{background:#fff;color:#b45309 !important;font-weight:800;text-align:center;padding:11px;border-radius:14px;font-size:14.5px;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s}
.hfc-ld-cta:hover{transform:translateY(-2px)}

/* ছোট কার্ড */
.hfc-mini-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr;margin-top:12px}
.hfc-mini{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:5px;box-shadow:0 6px 16px rgba(15,37,87,.06);transition:transform .15s,box-shadow .15s}
.hfc-mini:hover{transform:translateY(-3px);box-shadow:0 14px 26px rgba(15,37,87,.12)}
.hfc-mini::after{content:"";position:absolute;top:-30px;right:-30px;width:92px;height:92px;border-radius:50%;background:var(--tint)}
.hfc-mini>*{position:relative;z-index:1}
.hfc-mi{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#fff;margin-bottom:3px}
.hfc-mini h4{font-size:15px;font-weight:800;color:var(--text);margin:0}
.hfc-mini p{font-size:12.5px;color:var(--muted);line-height:1.45;margin:0}
.hfc-lk{margin-top:6px;font-size:13px;font-weight:800;display:flex;align-items:center;gap:5px}
.hfc-blue{--tint:#e4eafb} .hfc-blue .hfc-mi{background:linear-gradient(135deg,#3b82f6,#1d4ed8);box-shadow:0 8px 16px rgba(37,99,235,.3)} .hfc-blue .hfc-lk{color:#1d4ed8}
.hfc-amber{--tint:#fbeee0} .hfc-amber .hfc-mi{background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 8px 16px rgba(217,119,6,.3)} .hfc-amber .hfc-lk{color:#c2410c}
.hfc-green{--tint:#e0f3ea} .hfc-green .hfc-mi{background:linear-gradient(135deg,#10b981,#047857);box-shadow:0 8px 16px rgba(5,150,105,.3)} .hfc-green .hfc-lk{color:#047857}
.hfc-pink{--tint:#fbe3ee} .hfc-pink .hfc-mi{background:linear-gradient(135deg,#ec4899,#be185d);box-shadow:0 8px 16px rgba(219,39,119,.3)} .hfc-pink .hfc-lk{color:#be185d}
.dark .hfc-blue{--tint:#1b2a52} .dark .hfc-amber{--tint:#3a2a17} .dark .hfc-green{--tint:#16352c} .dark .hfc-pink{--tint:#3a1c2e}
.dark .hfc-blue .hfc-lk{color:#6ea0ff} .dark .hfc-amber .hfc-lk{color:#fbbf6a} .dark .hfc-green .hfc-lk{color:#34d399} .dark .hfc-pink .hfc-lk{color:#f472b6}
.dark .hfc-mini,.dark .hfc-live-m{box-shadow:0 6px 16px rgba(0,0,0,.35)}

@media (min-width:700px){
  .hfc{padding:8px 24px 0}
  .hfc-mini-grid{grid-template-columns:repeat(4,1fr)}
  .hfc-head h2{font-size:26px}
  .hfc-hero{padding:20px}
}
@media (min-width:900px){
  .hfc-layout{grid-template-columns:1.35fr 1fr;align-items:stretch}
  .hfc-live-m{display:none}
  .hfc-live-d{display:flex}
  .hfc-hero{padding:22px}
  .hfc-hero h3{font-size:21px}
}
`;

const MINIS = [
  {
    cls: "hfc-blue",
    href: LINKS.exam,
    Icon: Zap,
    title: "AI ইনস্ট্যান্ট এক্সাম",
    text: "যেকোনো বিষয়ে সাথে সাথে পরীক্ষা দিন",
    cta: "শুরু করুন",
  },
  {
    cls: "hfc-amber",
    href: LINKS.tests,
    Icon: ClipboardCheck,
    title: "প্র্যাকটিস টেস্ট",
    text: "অধ্যায় ধরে অনুশীলন করুন",
    cta: "অনুশীলন",
  },
  {
    cls: "hfc-green",
    href: LINKS.books,
    Icon: BookOpen,
    title: "বইঘর (PDF)",
    text: "গাইড বই ও লেকচার শিট ডাউনলোড",
    cta: "দেখুন",
  },
  {
    cls: "hfc-pink",
    href: LINKS.tools,
    Icon: Calculator,
    title: "টুলস",
    text: "GPA ক্যালকুলেটর, কভার পেজ, ছবির সাইজ",
    cta: "ব্যবহার করুন",
  },
];

export default function HomeFeatureCards({ aiHref }: { aiHref?: string }) {
  const aiInner = (
    <>
      <div className="hfc-bt">
        <Sparkles size={17} />
        <b>AI দিয়ে</b>
        {aiHref ? <ArrowRight size={14} className="hfc-arr" /> : <span className="hfc-soon">শীঘ্রই</span>}
      </div>
      <small>AI নতুন প্রশ্ন বানাবে</small>
    </>
  );

  return (
    <section className="hfc" aria-labelledby="hfc-title">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="hfc-head">
        <h2 id="hfc-title">
          <span className="hfc-gdot"><i /></span>
          আমাদের <em>সব সুবিধা</em>
        </h2>
        <p>পড়াশোনা, পরীক্ষা ও প্রস্তুতি — সবকিছু এক জায়গায়</p>
      </div>

      <div className="hfc-layout">
        {/* প্রশ্নপত্র তৈরি */}
        <div className="hfc-hero">
          <div className="hfc-hero-top">
            <div className="hfc-hero-ic"><FileText size={22} /></div>
            <h3>প্রশ্নপত্র তৈরি করুন</h3>
          </div>
          <p className="hfc-d">MCQ, সৃজনশীল ও সংক্ষিপ্ত প্রশ্ন বেছে মিনিটেই প্রশ্নপত্র বানান, প্রিন্ট বা PDF করুন।</p>
          <div className="hfc-btns">
            <Link href={LINKS.database} className="hfc-btn hfc-db">
              <div className="hfc-bt">
                <Database size={17} />
                <b>ডাটাবেস থেকে</b>
                <ArrowRight size={14} className="hfc-arr" />
              </div>
              <small>তৈরি প্রশ্ন বেছে নিন</small>
            </Link>
            {aiHref ? (
              <Link href={aiHref} className="hfc-btn hfc-ai">{aiInner}</Link>
            ) : (
              <div className="hfc-btn hfc-ai" aria-disabled="true">{aiInner}</div>
            )}
          </div>
        </div>

        {/* লাইভ মডেল টেস্ট — মোবাইল/ট্যাবলেট */}
        <Link href={LINKS.live} className="hfc-live-m">
          <div className="hfc-lm-ic"><Trophy size={22} /></div>
          <div className="hfc-lm-body">
            <div className="hfc-lm-title">
              <b>লাইভ অনলাইন মডেল টেস্ট</b>
              <span className="hfc-pill-l"><span className="hfc-dot" />LIVE</span>
            </div>
            <p>সবার সাথে পরীক্ষা দিন, মেধাতালিকায় নিজের অবস্থান দেখুন</p>
          </div>
          <ChevronRight size={17} className="hfc-chev" />
        </Link>

        {/* লাইভ মডেল টেস্ট — ডেস্কটপ */}
        <div className="hfc-live-d">
          <div className="hfc-ld-top">
            <div className="hfc-ld-ic"><Trophy size={22} /></div>
            <div>
              <h3>লাইভ অনলাইন মডেল টেস্ট</h3>
              <span className="hfc-pill-d"><span className="hfc-dot" />LIVE</span>
              <p>সবার সাথে পরীক্ষা দিন, মেধাতালিকায় অবস্থান দেখুন</p>
            </div>
          </div>
          <div className="hfc-ld-tags">
            <span>লিডারবোর্ড</span>
            <span>উত্তরপত্র</span>
            <span>ফ্রি ও প্রিমিয়াম</span>
          </div>
          <div className="hfc-ld-gap" />
          <Link href={LINKS.live} className="hfc-ld-cta">
            এখনই অংশ নিন <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ছোট ৪টি কার্ড */}
      <div className="hfc-mini-grid">
        {MINIS.map(({ cls, href, Icon, title, text, cta }) => (
          <Link key={title} href={href} className={`hfc-mini ${cls}`}>
            <div className="hfc-mi"><Icon size={21} /></div>
            <h4>{title}</h4>
            <p>{text}</p>
            <span className="hfc-lk">{cta} <ArrowRight size={14} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ===== ফাইল শেষ =====
