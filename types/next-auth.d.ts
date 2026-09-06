import "next-auth";

export interface UserBusinessInfo {
  businessId: string;
  role: string;
  name: string;
  gstin: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      sessionVersion?: number;
      businesses?: UserBusinessInfo[];
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    sessionVersion?: number;
    businesses?: UserBusinessInfo[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sessionVersion?: number;
    businesses?: UserBusinessInfo[];
  }
}
