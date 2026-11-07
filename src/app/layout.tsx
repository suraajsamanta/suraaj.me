import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://suraaj.me"),
  title: "Suraaj Samanta — Learning, Building, Exploring",
  description: "Suraaj Samanta. Learning, building, exploring.",
  openGraph: {
    title: "Suraaj Samanta",
    description: "Learning, building, exploring.",
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
