import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gmail Manager",
  description: "Gmail の整理・最適化ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
