import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the Auth.js config — no Prisma/bcrypt here, since this
// is what middleware.ts runs on the Edge runtime. The Credentials provider
// (which needs Node APIs) is added in auth.ts, the full config used by
// route handlers and server actions/components.
export const authConfig = {
  pages: {
    signIn: "/access",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
