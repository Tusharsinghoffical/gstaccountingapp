import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "gst-ledger-local-secret-key-32-chars-min",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: {
            businessUsers: {
              where: { status: "active" },
              include: {
                business: true,
              },
            },
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          businesses: user.businessUsers.map((bu) => ({
            businessId: bu.businessId,
            role: bu.role,
            name: bu.business.name,
            gstin: bu.business.gstin,
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        const u = user as unknown as Record<string, unknown>;
        token.businesses = u.businesses;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const s = session.user as unknown as Record<string, unknown>;
        s.id = token.id as string;
        s.businesses = token.businesses;
      }
      return session;
    },
  },
};
