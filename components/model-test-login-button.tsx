"use client";

import { signIn } from "next-auth/react";

export default function ModelTestLoginButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl })}
      className="w-full rounded-xl bg-royal px-5 py-3 font-bold text-white hover:opacity-90 transition"
    >
      Google দিয়ে লগইন করুন
    </button>
  );
}
