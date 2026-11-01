"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileName } from "@/app/actions/profile";

type Props = {
  initialName: string;
  greetingText: string;
  greetingIcon: string;
};

export default function ProfileNameEditor({
  initialName,
  greetingText,
  greetingIcon,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setValue(name);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setValue(name);
    setError("");
    setEditing(false);
  }

  function saveName() {
    if (isPending) return;

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setError("নাম কমপক্ষে ২ অক্ষরের হতে হবে।");
      return;
    }

    setError("");

    startTransition(async () => {
      const res = await updateProfileName(trimmed);
      if (res.success) {
        setName(res.name ?? trimmed);
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error ?? "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-lg font-bold text-slate-800 sm:text-xl">
          {greetingText}, {name} {greetingIcon}
        </h1>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ✏️ এডিট
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="mb-1 block text-xs font-semibold text-slate-600">
        আপনার নাম
      </label>
      <input
        type="text"
        value={value}
        maxLength={50}
        autoFocus
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveName();
          }
          if (e.key === "Escape") cancelEdit();
        }}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        placeholder="আপনার নাম লিখুন"
      />
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={saveName}
          disabled={isPending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "সেভ হচ্ছে..." : "✅ সেভ করুন"}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isPending}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          বাতিল
        </button>
      </div>
    </div>
  );
}
