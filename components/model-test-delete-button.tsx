"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteModelTest } from "@/app/actions/model-test";

export default function ModelTestDeleteButton({ id, attemptCount }: { id: string; attemptCount: number }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const message =
      attemptCount > 0
        ? `⚠️ এই টেস্টে ${attemptCount} জন ইতিমধ্যে অংশ নিয়েছে। Delete করলে তাদের সব ফলাফল স্থায়ীভাবে মুছে যাবে। আপনি কি নিশ্চিত?`
        : "আপনি কি এই টেস্টটি মুছে ফেলতে চান?";
    const ok = window.confirm(message);
    if (!ok) return;
    startTransition(async () => {
      await deleteModelTest(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
    >
      <Trash2 size={14} /> {pending ? "মুছে ফেলা হচ্ছে..." : "Delete"}
    </button>
  );
}
