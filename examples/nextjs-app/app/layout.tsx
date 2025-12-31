import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S3 File Manager - Next.js Example",
  description: "A secure, server-driven S3 file manager built with s3kit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
