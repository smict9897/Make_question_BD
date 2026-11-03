import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Google, // reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET
    Credentials({
      async authorize(c) {
        const email = String(c?.email ?? "").toLowerCase().trim();
        const u = await db.user.findUnique({ where: { email } });
        if (!u?.passwordHash) return null;
        const ok = await bcrypt.compare(String(c?.password ?? ""), u.passwordHash);
        return ok ? { id: u.id, email: u.email, name: u.name, role: u.role } : null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      // Only accept Google accounts whose email Google has verified.
      return account?.provider !== "google" || profile?.email_verified === true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && token.email) {
        const email = token.email.toLowerCase();
        const isAdmin = email === process.env.ADMIN_EMAIL?.toLowerCase();
        const googleImage =
          typeof (profile as { picture?: string } | undefined)?.picture === "string"
            ? (profile as { picture?: string }).picture
            : undefined;
        // passwordHash is cleared: the email is now proven by Google, so nobody
        // who pre-registered this email with a password can keep access.
        const u = await db.user.upsert({
          where: { email },
          update: {
            passwordHash: null,
            ...(isAdmin ? { role: "ADMIN" as const } : {}),
            ...(googleImage ? { image: googleImage } : {}),
          },
          create: {
            email,
            name: token.name ?? null,
            image: googleImage ?? null,
            role: isAdmin ? "ADMIN" : "STUDENT",
          },
        });
        token.sub = u.id;
        token.role = u.role;
        token.picture = googleImage ?? u.image ?? token.picture;
      } else if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
});
