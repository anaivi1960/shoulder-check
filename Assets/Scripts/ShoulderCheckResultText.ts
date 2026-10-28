/**
 * ShoulderCheckResultText — the words on the result card for one round.
 *
 * Pure function: outcome + scan stats in, severity / title / label / tip out. Kept to one
 * glance: a muted label (scans, decision time), the bold result, and the single most useful
 * coaching tip. Who was free or marked is shown on the players themselves (player tags).
 * Must NOT: touch the scene or UI (ShoulderCheckResultPanelUI displays the result).
 */
import {Role, ROLE_INFO} from "./ShoulderCheckLevels"
import {ResultSeverity} from "./ShoulderCheckResultPanelUI"

export type OutcomeKind = "correct" | "markedTeammate" | "opponent" | "tooSlow"

export interface ResultInput {
  kind: OutcomeKind
  marker: Role | null // who marked the teammate I picked
  scans: {total: number; left: number; right: number; lastCheckTime: number}
  freezeTime: number
  decisionSec: number
  free: Role
  activeRoles: Role[]
  seen: Set<Role>
}

export function composeResult(r: ResultInput): {severity: ResultSeverity; title: string; label: string; tip: string} {
  let severity: ResultSeverity = "bad"
  let title: string
  if (r.kind === "correct") {
    severity = "good"
    title = "Free man found"
  } else if (r.kind === "markedTeammate") {
    severity = "warn"
    title = r.marker ? "He was marked by " + ROLE_INFO[r.marker].phrase : "That's the passer — find the free man"
  } else if (r.kind === "opponent") {
    title = "That's an opponent"
  } else {
    title = "Lost the ball, too slow"
  }
  const s = r.scans
  const scans = s.total === 1 ? "1 scan" : s.total + " scans"
  const sides = s.total > 0 ? " · L" + s.left + " R" + s.right : ""
  const dec = r.kind === "tooSlow" ? " · no pick in time" : " · " + r.decisionSec.toFixed(1) + " s decision"
  const label = scans + sides + dec

  // One tip, most useful first: who you never looked at, then how early your last check was.
  const unseen = r.activeRoles.filter((role) => ROLE_INFO[role].candidate && !r.seen.has(role))
  let tip: string
  if (unseen.indexOf(r.free) >= 0) tip = "You never looked at " + ROLE_INFO[r.free].phrase + "."
  else if (unseen.length > 0) tip = "You never looked at " + ROLE_INFO[unseen[0]].phrase + "."
  else if (s.lastCheckTime >= 0) tip = "Last check " + (r.freezeTime - s.lastCheckTime).toFixed(1) + " s before the ball."
  else tip = "Check a shoulder before the ball arrives."
  return {severity, title, label, tip}
}
