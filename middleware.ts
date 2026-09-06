import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized({ token }) {
      return !!token;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/customers/:path*",
    "/suppliers/:path*",
    "/payments/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/ocr/:path*",
    "/audit-log/:path*",
    "/api/files/:path*",
  ],
};
