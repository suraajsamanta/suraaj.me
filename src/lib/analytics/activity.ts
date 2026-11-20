/** Public events are deliberately closed-schema; never accept page text, URLs, or names. */
const GAME_NAMES = ["beerio", "beerio-2", "boomerang", "bump-club", "codewords", "floor-is-trouble",
  "inside-ranks", "jeopardy", "simulator"] as const;
type GameName = (typeof GAME_NAMES)[number];
const GAME_SET = new Set<string>(GAME_NAMES);
const resumes = new Set(["/resume", "/cv", "/suraaj_resume"]);
const activePaths = new Set(["/", "/beerio", "/madfun", ...resumes, ...GAME_NAMES.map((g) => "/madfun/" + g)]);
const homeSections = new Set(["intro", "socials", "footer"]);
const homeActions = new Set(["github", "linkedin"]);
const resumeActions = new Set(["open_resume", "close_resume", "minimize_resume", "maximize_resume",
  "open_pdf_tab", "home_link", "download_click"]);
const identifier = /^(?:[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}|[\da-f]{16,64})$/i;
const gameKinds = ["game_join", "game_start", "game_end", "game_player_duration"] as const;
type GameKind = (typeof gameKinds)[number];
type Outcome = "completed" | "abandoned" | "unknown";
const validOutcomes = new Set<unknown>(["completed", "abandoned", "unknown"]);

export type PublicActivity =
  | { kind: "section_seen" | "site_action" | "page_active"; path: string; sid: string; eid: string; label?: string; durationMs?: number }
  | { kind: GameKind; path: string; game: GameName; matchId: string; roomId?: string; playerId?: string; eid?: string; durationMs?: number; estimated?: boolean; outcome?: Outcome };

export function activityId(value: unknown): string | undefined {
  return typeof value === "string" && identifier.test(value) ? value.toLowerCase() : undefined;
}

function duration(value: unknown, max: number, min = 1) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : undefined;
}

export function parseActivity(value: unknown): PublicActivity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const { kind, path, label, game } = v;
  const eid = activityId(v.eid);
  if (v.eid !== undefined && !eid) return null;
  if (kind === "section_seen" || kind === "site_action" || kind === "page_active") {
    const sid = activityId(v.sid);
    if (typeof path !== "string" || !activePaths.has(path) || !sid || !eid) return null;
    if (kind === "page_active") {
      const durationMs = duration(v.durationMs, 60_000);
      if (!durationMs || (label !== undefined && !(resumes.has(path) && label === "viewer_active"))) return null;
      return { kind, path, sid, eid, durationMs, ...(label ? { label: "viewer_active" } : {}) };
    }
    if (typeof label !== "string") return null;
    const labels = kind === "section_seen" ? (path === "/" ? homeSections : null)
      : path === "/" ? homeActions : resumes.has(path) ? resumeActions : null;
    return labels?.has(label) ? { kind, path, sid, eid, label } : null;
  }
  if (typeof game !== "string" || !GAME_SET.has(game) || !gameKinds.includes(kind as GameKind)) return null;
  const matchId = activityId(v.matchId);
  const roomId = activityId(v.roomId);
  const playerId = activityId(v.playerId);
  const durationMs = duration(v.durationMs, 4 * 60 * 60 * 1000, 0);
  if (!matchId || (v.roomId !== undefined && !roomId) || (v.playerId !== undefined && !playerId)) return null;
  if ((kind === "game_join" || kind === "game_player_duration") && !playerId) return null;
  if (kind === "game_player_duration" && durationMs === undefined) return null;
  if (v.durationMs !== undefined && durationMs === undefined) return null;
  if (v.outcome !== undefined && !validOutcomes.has(v.outcome)) return null;
  return { kind: kind as GameKind, path: "/madfun/" + game, game: game as GameName, matchId, roomId,
    playerId, durationMs, ...(eid ? { eid } : {}), ...(v.estimated === true ? { estimated: true } : {}),
    ...(v.outcome ? { outcome: v.outcome as Outcome } : {}) };
}
