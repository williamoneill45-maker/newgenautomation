import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Law Automation",
  description: "Family law intake and document automation workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
