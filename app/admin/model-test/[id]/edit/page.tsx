import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import AdminModelTestForm from "@/components/admin-model-test-form";

export const dynamic = "force-dynamic";

export default async function EditModelTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await db.modelTest.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });

  if (!test) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/model-test" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600">
          <ArrowLeft size={16} /> তালিকায় ফিরে যান
        </Link>
        <h1 className="text-xl font-bold text-slate-900">মডেল টেস্ট এডিট করুন</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <AdminModelTestForm
          existing={{
            id: test.id,
            title: test.title,
            className: test.className,
            subject: test.subject,
            chapter: test.chapter,
            difficulty: test.difficulty,
            language: test.language,
            minutes: test.minutes,
            isPaid: test.isPaid,
            status: test.status,
            startAt: test.startAt,
            endAt: test.endAt,
            attemptCount: test._count.attempts,
          }}
        />
      </div>
    </main>
  );
}
