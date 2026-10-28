/**
 * ShoulderCheckLevels — pure drill rules: roles, level progression, pass pace,
 * and the per-round marking plan. No scene access.
 *
 * Owns: role table (team / free-man candidate / marker preference — correctness
 * invariants of the drill: one free teammate, always), LevelProgress state,
 * passDuration(), planRound().
 *
 * Tunable numbers (pass pace, answers to level up/down, which level each player
 * joins) are NOT hardcoded here — they arrive from @inputs on ShoulderCheckMain
 * and ShoulderCheckPlayerFigure.
 */

export type Role =
  | "passer"
  | "oppStriker"
  | "presser"
  | "leftWinger"
  | "rightWinger"
  | "striker"
  | "oppMidfielder"
  | "fullBack"

export interface RoleInfo {
  teammate: boolean
  /** Can be the free man (an open teammate option). */
  candidate: boolean
  /** Phrase used in result lines, e.g. "the full-back". */
  phrase: string
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  passer: {teammate: true, candidate: false, phrase: "the centre-back"},
  oppStriker: {teammate: false, candidate: false, phrase: "their striker"},
  presser: {teammate: false, candidate: false, phrase: "the presser"},
  leftWinger: {teammate: true, candidate: true, phrase: "the left winger"},
  rightWinger: {teammate: true, candidate: true, phrase: "the right winger"},
  striker: {teammate: true, candidate: true, phrase: "the striker"},
  oppMidfielder: {teammate: false, candidate: false, phrase: "the midfielder"},
  fullBack: {teammate: false, candidate: false, phrase: "the full-back"},
}

export const ALL_ROLES: Role[] = [
  "passer",
  "oppStriker",
  "presser",
  "leftWinger",
  "rightWinger",
  "striker",
  "oppMidfielder",
  "fullBack",
]

/** Which opponents naturally pick up each candidate, in preference order. */
const MARKER_PREFERENCE: Partial<Record<Role, Role[]>> = {
  leftWinger: ["oppMidfielder", "fullBack", "presser"],
  rightWinger: ["fullBack", "oppMidfielder", "presser"],
  striker: ["presser", "oppMidfielder", "fullBack"],
}

export interface MarkPair {
  marker: Role
  marked: Role
}

export interface RoundPlan {
  free: Role
  marks: MarkPair[]
  /** Presser is not marking anyone: he closes in on the receiver instead. */
  presserCommits: boolean
}

export interface PaceConfig {
  basePassSec: number
  speedupPerLevel: number
  minPassSec: number
}

export function passDuration(level: number, cfg: PaceConfig): number {
  const d = cfg.basePassSec * Math.pow(1 - cfg.speedupPerLevel, Math.max(0, level - 1))
  return Math.max(cfg.minPassSec, d)
}

export function planRound(active: Role[], rand: () => number = Math.random): RoundPlan | null {
  const candidates = active.filter((r) => ROLE_INFO[r].candidate)
  if (candidates.length === 0) return null
  const free = candidates[Math.floor(rand() * candidates.length) % candidates.length]
  const used: Role[] = []
  const marks: MarkPair[] = []
  for (const c of candidates) {
    if (c === free) continue
    const prefs = MARKER_PREFERENCE[c] || []
    const marker = prefs.find((m) => active.indexOf(m) >= 0 && used.indexOf(m) < 0)
    if (!marker) {
      print("[ShoulderCheck] WARN: no marker available for " + c + " — more than one free man this round")
      continue
    }
    used.push(marker)
    marks.push({marker, marked: c})
  }
  return {free, marks, presserCommits: used.indexOf("presser") < 0}
}

export interface ProgressConfig {
  correctToLevelUp: number
  wrongInRowToLevelDown: number
}

export class LevelProgress {
  level = 1
  private correctSinceChange = 0
  private wrongInRow = 0

  constructor(private cfg: ProgressConfig) {}

  /** Record one answer. Returns +1 / -1 / 0 for the level change. */
  record(correct: boolean): number {
    if (correct) {
      this.wrongInRow = 0
      this.correctSinceChange++
      if (this.correctSinceChange >= this.cfg.correctToLevelUp) {
        this.level++
        this.correctSinceChange = 0
        return 1
      }
    } else {
      this.wrongInRow++
      if (this.wrongInRow >= this.cfg.wrongInRowToLevelDown) {
        this.wrongInRow = 0
        this.correctSinceChange = 0
        if (this.level > 1) {
          this.level--
          return -1
        }
      }
    }
    return 0
  }
}
