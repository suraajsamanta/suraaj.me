import type { Metadata } from "next";
import BoomerangGame from "./BoomerangGame";
export const metadata: Metadata = { title: "Ricochet | Madfun", description: "Catch it. Throw it. Dodge it. A boomerang arena for your whole group." };
export default function Page() { return <BoomerangGame />; }
