import type { NextAuthConfig } from "next-auth";

// Edge-safe part (no database): used by middleware.
export default {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    session({ session, token }) {
      const u = session.user as { role?: string; id?: string; image?: string | null };
      u.role = typeof token.role === "string" ? token.role : undefined;
      u.id = token.sub ?? "";
      u.image = typeof token.picture === "string" ? token.picture : u.image ?? null;
      return session;
    },
    authorized({ auth, request }) {
      if (request.nextUrl.pathname.startsWith("/admin")) {
        const r = (auth?.user as { role?: string } | undefined)?.role;
        return r === "ADMIN" || r === "TEACHER";
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
