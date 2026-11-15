import Beerio from "../../beerio/Beerio";
import QuickStart from "../shared/QuickStart";

export { metadata } from "../../beerio/page";

const steps = [
  { title: "Put the race on the big screen", body: "Open Host a Race on the device everyone can see, then choose Create Room. Keep that screen open. If the host wants to drive too, choose Drive on This Device." },
  { title: "Join on your phone", body: "Scan the host’s QR or choose Join With a Code. Enter your name and color, tap Join the Race, then pick your character and ride when prompted." },
  { title: "Drive with your phone", body: "Watch the host’s split screen for the track. Steer with the joystick, hold GO, and use BRAKE or DRIFT for corners. Collect a power-up box, then tap Use Item or double-tap GO." },
  { title: "Win the race", body: "Finish the laps ahead of everyone else. Playing alone? Choose Set up a solo practice race instead." },
] as const;

// The legacy /beerio entry stays unchanged. The Madfun alias adds pre-race help.
export default function MadfunBeerioPage() {
  return <Beerio quickStart={<QuickStart game="Beerio" steps={steps} />} />;
}
