"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// The analytics script is shared with raw HTML resume routes. This is only the
// App Router navigation signal; the script reads the allowlisted pathname itself.
export default function AnalyticsNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    document.dispatchEvent(new Event("ss:analytics-navigation"));
  }, [pathname]);
  return null;
}
