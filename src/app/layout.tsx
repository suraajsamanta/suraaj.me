import { madfunMetadata } from './madfun/shared/share-metadata';
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
