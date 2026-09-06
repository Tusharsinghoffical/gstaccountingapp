import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      sessionVersion?: number;
      businesses?: Array<{
        businessId: string;
        role: string;
        name: string;
        gstin: string;
      }>;
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    sessionVersion?: number;
    businesses?: Array<{
      businessId: string;
      role: string;
      name: string;
      gstin: string;
    }>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sessionVersion?: number;
    businesses?: unknown;
  }
}
