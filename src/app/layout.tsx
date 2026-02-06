import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Theme Converter",
  description:
    "Convert AI-generated HTML into installable WordPress Block Themes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
