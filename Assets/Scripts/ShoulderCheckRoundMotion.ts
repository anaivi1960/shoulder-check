/**
 * ShoulderCheckRoundMotion — where players and the ball move during one round.
 *
 * Owns: the per-round move list (free man shows wider, markers close on their man, the
 * presser closes behind you, opponents step in) and the ball's rolling path from the passer
 * to your feet. Positions are Pitch-root local (floor level, centred on the receiver).
 *
 * Must NOT: decide who is free (ShoulderCheckLevels.planRound does) or touch phases/UI.
 */
import {Role, ROLE_INFO, RoundPlan} from "./ShoulderCheckLevels"
import {ShoulderCheckPlayerFigure} from "./ShoulderCheckPlayerFigure"

export const BALL_RADIUS_CM = 11

export interface MotionConfig {
  markGapCm: number
  markerHeadStart: number
  presserCloseCm: number
  freeManShowCm: number
}

interface Move {
  fig: ShoulderCheckPlayerFigure
  start: vec3
  end: vec3
}

export function smooth(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  return x * x * (3 - 2 * x)
}

/** Point `dist` cm from `from` toward `to`, on the ground plane (negative = away). */
export function toward(from: vec3, to: vec3, dist: number): vec3 {
  const d = new vec3(to.x - from.x, 0, to.z - from.z)
  return d.length < 1e-3 ? from : from.add(d.normalize().uniformScale(dist))
}

export class RoundMotion {
  ballStart = vec3.zero()
  ballEnd = vec3.zero()
  private moves: Move[] = []

  constructor(private ball: SceneObject, private ballVisual: SceneObject | null) {}

  build(plan: RoundPlan, figs: ShoulderCheckPlayerFigure[], byRole: Map<Role, ShoulderCheckPlayerFigure>, me: vec3, cfg: MotionConfig): void {
    this.moves = []
    const homeOf = (r: Role): vec3 => {
      const f = byRole.get(r)
      return f ? f.home : vec3.zero()
    }
    const assigned = new Set<Role>()
    // Free man shows for the ball (steps wider, away from me).
    const freeFig = byRole.get(plan.free)
    if (freeFig) {
      const h = freeFig.home
      this.moves.push({fig: freeFig, start: h, end: toward(h, me, -cfg.freeManShowCm)})
      assigned.add(plan.free)
    }
    for (const m of plan.marks) {
      const mf = byRole.get(m.marker)
      if (!mf) continue
      const spot = toward(homeOf(m.marked), me, cfg.markGapCm)
      const start = vec3.lerp(mf.home, spot, cfg.markerHeadStart)
      this.moves.push({fig: mf, start, end: spot})
      assigned.add(m.marker)
    }
    for (const f of figs) {
      if (assigned.has(f.roleId) || !f.isActive) continue
      const h = f.home
      let end = h
      if (f.roleId === "presser" && plan.presserCommits) end = toward(me, h, cfg.presserCloseCm)
      else if (f.roleId === "oppStriker") end = toward(h, me, 200)
      else if (!ROLE_INFO[f.roleId].teammate) end = toward(h, me, 100)
      this.moves.push({fig: f, start: h, end})
    }
  }

  applyMoves(u: number): void {
    // Ease in only: players set off from rest but are still moving when the ball arrives,
    // so the freeze catches runners mid-stride (same end spots as before).
    const x = Math.min(1, Math.max(0, u))
    const k = x * x * (2 - x)
    for (const m of this.moves) m.fig.setLocalPos(vec3.lerp(m.start, m.end, k))
  }

  /** Roll the ball from 60 cm in front of the passer to 40 cm in front of me; u in [0,1]. */
  placeBall(u: number, passerHome: vec3, me: vec3): void {
    const flat = new vec3(me.x - passerHome.x, 0, me.z - passerHome.z).normalize()
    this.ballStart = passerHome.add(flat.uniformScale(60))
    this.ballEnd = me.sub(flat.uniformScale(40))
    const k = Math.min(1, Math.max(0, u))
    this.ball.getTransform().setLocalPosition(vec3.lerp(this.ballStart, this.ballEnd, k))
    const travel = this.ballEnd.sub(this.ballStart)
    const axis = new vec3(travel.z, 0, -travel.x)
    if (axis.length > 1e-3 && this.ballVisual) {
      this.ballVisual.getTransform().setLocalRotation(quat.angleAxis((travel.length * u) / BALL_RADIUS_CM, axis.normalize()))
    }
  }

  /** Ball bouncing at my feet after I lost it (t = seconds into the outcome). */
  dropBall(t: number): void {
    const bounce = Math.abs(Math.sin(t * 9)) * Math.max(0, 1 - t) * 12
    this.ball.getTransform().setLocalPosition(this.ballEnd.add(new vec3(0, bounce, 0)))
  }
}
