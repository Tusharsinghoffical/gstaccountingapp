import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function authorizeCredentials(
  credentials?: Record<"email" | "password", string>
) {
  if (!credentials?.email || !credentials?.password) {
    throw new Error("Invalid email or password.");
  }

  const email = credentials.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      businessUsers: {
        where: { status: "active" },
        include: {
          business: true,
        },
      },
    },
  });

  // Constant-time dummy comparison to prevent timing-based user enumeration
  if (!user || !user.passwordHash) {
    await bcrypt.compare(credentials.password, "$2a$12$e8V9m1w0rO2sB8rR8V9m1w0rO2sB8rR8V9m1w0rO2sB8rR8V9m1w0");
    throw new Error("Invalid email or password.");
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
    );
    throw new Error(
      `Account temporarily locked due to 5 consecutive failed logins. Please try again in ${remainingMinutes} minute(s) or reset your password.`
    );
  }

  // Check if email is verified
  if (!user.emailVerified) {
    throw new Error(
      "Please verify your email address before signing in. Check your inbox for the activation link."
    );
  }

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

  if (!isValid) {
    // Increment failed attempts
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= 5;
    const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });

    if (shouldLock) {
      throw new Error(
        "Account temporarily locked for 15 minutes due to 5 consecutive failed login attempts."
      );
    }

    throw new Error("Invalid email or password.");
  }

  // Reset failures on successful login
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    sessionVersion: user.sessionVersion,
    businesses: user.businessUsers.map((bu) => ({
      businessId: bu.businessId,
      role: bu.role,
      name: bu.business.name,
      gstin: bu.business.gstin,
    })),
  };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days idle timeout
  },
  secret: process.env.NEXTAUTH_SECRET || "gst-ledger-local-secret-key-32-chars-min",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.businesses = user.businesses;
        token.sessionVersion = user.sessionVersion;
      }

      // Periodically verify sessionVersion against DB to immediately invalidate old sessions on password reset
      if (token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { sessionVersion: true },
          });
          if (freshUser && freshUser.sessionVersion !== token.sessionVersion) {
            return {}; // Invalidate session
          }
        } catch {
          // Fall through
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        return null as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.businesses = token.businesses;
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
};
