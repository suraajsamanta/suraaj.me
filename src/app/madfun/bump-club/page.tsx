import type { Metadata } from "next";
import BoomerangGame from "./BoomerangGame";
export const metadata: Metadata = { title: "Bump Club | Madfun", description: "Shove, slide and dash. A shared-screen bumper arena for 2–10 players." };
export default function Page() { return <BoomerangGame />; }
