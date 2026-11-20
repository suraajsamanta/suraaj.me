import { madfunMetadata } from './madfun/shared/share-metadata';
import "./globals.css";
import Script from "next/script";
import AnalyticsNavigation from "./AnalyticsNavigation";

export const metadata = {
  ...madfunMetadata('suraaj'),
  robots: { index: true, follow: true },
  metadataBase: new URL("https://suraaj.me"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsNavigation />
        <Script src="/journey-analytics.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
