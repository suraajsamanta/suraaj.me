import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://suraaj.me"),
  title: "Suraaj Samanta — Quietly Building",
  description: "Software engineering. Machine learning. Thinking beyond the visible. The personal corner of the internet of Suraaj Samanta.",
  openGraph: { title: "Suraaj Samanta", description: "Quietly building. Thinking beyond the visible.", url: "https://suraaj.me", siteName: "Suraaj Samanta", type: "website" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
