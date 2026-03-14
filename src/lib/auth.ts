import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "LumiBooks",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Convex HTTP 엔드포인트로 사용자 조회
        const siteUrl = process.env.CONVEX_SITE_URL;
        if (!siteUrl) {
          console.error("CONVEX_SITE_URL not set");
          return null;
        }

        try {
          const res = await fetch(`${siteUrl}/auth/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: credentials.email }),
          });

          if (!res.ok) return null;

          const user = await res.json();

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isPasswordValid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            companyName: user.companyName,
          };
        } catch {
          console.error("Auth verification failed");
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.companyName = (user as unknown as Record<string, unknown>).companyName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).userId = token.userId;
        (session.user as Record<string, unknown>).companyName = token.companyName;
      }
      return session;
    },
  },
};
