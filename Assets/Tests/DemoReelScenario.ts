/**
 * Demo reel (not a test) — plays a scripted session for the submission video.
 *
 * Turns the real head with HeadDriver and picks silhouettes through SIK, round by round:
 * no checks (too slow) -> both shoulders, free man -> left only, marked teammate ->
 * opponent -> then correct picks until the level climbs. Prints "[SC-DEMO]" beats to the
 * log so the video captions can be timed. Never changes game logic.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {Clicker} from "./ShoulderCheckLeafClick"
import {DEG, HeadDriver, camTransform, nextFrame, passerDir, playerObject, sleep, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

type Beat = "tooSlow" | "free" | "marked" | "opponent"

interface RoundScript {
  checks: ("L" | "R")[]
  answer: Beat
}

const ROUNDS: RoundScript[] = [
  {checks: [], answer: "tooSlow"},
  {checks: ["L", "R"], answer: "free"},
  {checks: ["L"], answer: "marked"},
  {checks: ["R"], answer: "opponent"},
  {checks: ["L", "R"], answer: "free"},
  {checks: ["R", "L"], answer: "free"},
  {checks: ["L", "R"], answer: "free"},
  {checks: ["R", "L"], answer: "free"},
]

function say(msg: string): void {
  print("[SC-DEMO] t=" + getTime().toFixed(2) + " " + msg)
}

/** LEAF's sleep rejects 0 ms; skip non-positive waits. */
async function pause(ms: number): Promise<void> {
  if (ms >= 1) await sleep(ms)
}

function ease(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  return x * x * (3 - 2 * x)
}

/** Signed yaw (deg, + = right) of a player from the passer direction. */
function yawOf(role: string): number {
  const eye = camTransform().getWorldPosition()
  const p = playerObject(role).getTransform().getWorldPosition()
  const v = new vec3(p.x - eye.x, 0, p.z - eye.z).normalize()
  const d = passerDir()
  const right = new vec3(-d.z, 0, d.x)
  return Math.atan2(v.dot(right), v.dot(d)) * DEG
}

@component
export class DemoReelScenario extends Scenario {
  private head: HeadDriver | null = null
  private yaw = 0

  private async turnTo(target: number, sec: number): Promise<void> {
    const from = this.yaw
    // Take the short way round.
    let delta = target - from
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    const t0 = getTime()
    for (;;) {
      const u = Math.min(1, (getTime() - t0) / Math.max(1e-3, sec))
      this.yaw = from + delta * ease(u)
      this.head!.setYaw(this.yaw)
      if (u >= 1) break
      await nextFrame()
    }
  }

  private async shoulderCheck(side: "L" | "R"): Promise<void> {
    const a = side === "L" ? -80 : 80
    await this.turnTo(a, 0.3)
    await sleep(180)
    await this.turnTo(0, 0.3)
  }

  async run(): Promise<void> {
    const clicker = new Clicker()
    this.head = new HeadDriver()
    try {
      this.head.setYaw(0)
      for (let i = 0; i < ROUNDS.length; i++) {
        const r = ROUNDS[i]
        await waitForFreshShaping(30000)
        say("ROUND " + (i + 1) + " level=" + state().level + " checks=" + (r.checks.join("") || "none") + " answer=" + r.answer)
        await waitPhase("pass")
        // Spread the checks across the pass so the last one lands just before the ball arrives.
        const passMs = state().passSec * 1000
        const slot = passMs / (r.checks.length + 1)
        for (const c of r.checks) {
          await pause(slot - 780)
          say("CHECK " + c)
          await this.shoulderCheck(c)
        }
        await waitPhase("frozen")
        say("FREEZE")
        if (r.answer === "tooSlow") {
          await waitPhase("outcome", 8000)
        } else {
          const s = state()
          let role = s.free as string
          if (r.answer === "marked") {
            const m = s.marks.find((x) => x.marked !== "passer")
            role = m ? m.marked : role
          } else if (r.answer === "opponent") {
            role = "presser"
          }
          await sleep(350)
          await this.turnTo(yawOf(role), 0.7)
          await sleep(300)
          say("PICK " + role)
          await clicker.click(role)
        }
        say("OUTCOME " + state().lastResult)
        await sleep(1400)
        // Look back toward the passer: the result panel glides after the head settles.
        await this.turnTo(0, 0.9)
      }
      await waitForFreshShaping(30000)
      say("END level=" + state().level)
      await sleep(2500)
    } finally {
      this.head.stop()
    }
  }
}
