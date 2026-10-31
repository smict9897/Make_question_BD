import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminModelTestForm from "@/components/admin-model-test-form";

export const dynamic = "force-dynamic";

export default function CreateModelTestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/model-test" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600">
          <ArrowLeft size={16} /> তালিকায় ফিরে যান
        </Link>
        <h1 className="text-xl font-bold text-slate-900">নতুন মডেল টেস্ট তৈরি করুন</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <AdminModelTestForm />
      </div>
    </main>
  );
}
