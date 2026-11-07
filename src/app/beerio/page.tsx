import type { Metadata } from "next";
import Beerio from "./Beerio";

export const metadata: Metadata = {
  title: "Beerio | Party racing",
  description: "A big-screen kart race with your phones as controllers.",
  robots: { index: false, follow: false },
};

export default function BeerioPage() {
  return <Beerio />;
}
