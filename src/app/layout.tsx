import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://suraaj.me"),
  title: "Suraaj — A Little Ahead of the Curve",
  description:
    "Suraaj Samanta. Exploring the space between intelligence, software, and whatever comes next.",
  openGraph: {
    title: "Suraaj Samanta",
    description:
      "A little ahead of the curve. Intelligence, software, and whatever comes next.",
    url: "https://suraaj.me",
    siteName: "Suraaj Samanta",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
