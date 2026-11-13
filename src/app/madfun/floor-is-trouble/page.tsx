import type { Metadata } from "next";
import FloorGame from "./FloorGame";
export const metadata: Metadata = { title: "Floor Is Trouble | Madfun", description: "Watch the tiles. Jump the gaps. Stay standing." };
export default function Page() { return <FloorGame />; }
