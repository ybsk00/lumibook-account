import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "LumiBooks Admin",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const isEmailValid = credentials.email === process.env.ADMIN_EMAIL;
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          process.env.ADMIN_PASSWORD_HASH!
        );

        if (isEmailValid && isPasswordValid) {
          return {
            id: "admin",
            name: "유범석",
            email: process.env.ADMIN_EMAIL,
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = "admin";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
};
