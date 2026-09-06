import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/lib/env-check";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GST Ledger - Indian Accounting & Invoicing",
  description: "Modern GST Invoicing and Ledger Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
