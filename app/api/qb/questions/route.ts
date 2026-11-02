import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type AnyObj = Record<string, any>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asObj(v: unknown): AnyObj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AnyObj) : {};
}

// প্রশ্নের ধরন বের করা (create/page.tsx-এর নিয়মের সাথে মিলিয়ে)
function detectType(text: string, options: AnyObj, correct: string): "MCQ" | "CQ" | "SHORT" {
  if (correct && correct.trim()) return "MCQ";
  const hasCq =
    !!options.stimulus ||
    !!options.k ||
    !!options["ক"] ||
    !!options.subQuestions ||
    text.includes("(ক)");
  if (hasCq) return "CQ";
  return "SHORT";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200)
    : [];
  if (!ids.length) return NextResponse.json({ items: [] });

  const rows = await db.question
    .findMany({ where: { id: { in: ids }, approved: true } })
    .catch(() => []);
  const map = new Map(rows.map((r) => [r.id, r]));

  const items = ids.flatMap((id) => {
    const r = map.get(id);
    if (!r) return [];

    const options = asObj(r.options);
    const correct = r.correct ?? "";
    const type = detectType(r.text ?? "", options, correct);

    const base = {
      id: r.id,
      text: r.text,
      options: r.options as Record<string, string>,
      correct: r.correct,
      explanation: r.explanation,
      category: r.category,
      subject: r.subject,
      topic: r.topic,
      source: r.source,
      type,
    };

    if (type === "CQ") {
      const sub = options.subQuestions ? asObj(options.subQuestions) : options;
      const k = str(sub.k) || str(sub["ক"]);
      const kh = str(sub.kh) || str(sub["খ"]);
      const g = str(sub.g) || str(sub["গ"]);
      const gh = str(sub.gh) || str(sub["ঘ"]);
      const stimulus = str(options.stimulus) || str(options["উদ্দীপক"]) || r.text;
      const hasSub = !!(k || kh || g || gh);
      const answers = asObj(options.ans ?? options.answers);

      return [
        {
          ...base,
          stimulus,
          subQuestions: hasSub ? { k, kh, g, gh } : undefined,
          answers,
        },
      ];
    }

    return [base];
  });

  return NextResponse.json({ items });
}

// ===== ফাইল শেষ =====
