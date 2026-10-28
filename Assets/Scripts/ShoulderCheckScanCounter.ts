/**
 * ShoulderCheckScanCounter — pure scan-counting logic (no scene access).
 *
 * Owns: the rule for "what counts as one scan" from the design brief.
 *  - Head must turn at least `minYawDeg` away from the ball (passer direction)
 *  - and come back within `returnDeg` of the ball within `maxHoldSec` of first
 *    crossing `minYawDeg`. Held longer => not counted.
 *  - Head must return within `returnDeg` before the next turn can count (no double count).
 *  - Only turns that both cross and return inside the pass window count.
 *
 * Input is a signed yaw in degrees (negative = left of the ball, positive = right)
 * plus a timestamp in seconds, so tests can feed exact yaw values directly
 * (see ShoulderCheckMain's global test hook and `runSelfTest` below).
 *
 * Must NOT: read the camera, touch SceneObjects, or know about rounds/levels.
 */

export interface ScanConfig {
  minYawDeg: number
  returnDeg: number
  maxHoldSec: number
}

export class ScanCounter {
  left = 0
  right = 0
  /** Time (s) the head last came back inside minYaw on a counted scan; -1 = none. */
  lastCheckTime = -1

  private windowOpen = false
  private windowStart = 0
  private armed = true
  private crossed = false
  private crossTime = 0
  private crossSide = 0
  private belowMinTime = 0

  constructor(private cfg: ScanConfig) {}

  get total(): number {
    return this.left + this.right
  }

  setConfig(cfg: ScanConfig): void {
    this.cfg = cfg
  }

  /** Start a pass window. Resets per-round counts. */
  beginWindow(t: number): void {
    this.left = 0
    this.right = 0
    this.lastCheckTime = -1
    this.windowOpen = true
    this.windowStart = t
    this.crossed = false
  }

  endWindow(): void {
    this.windowOpen = false
  }

  /** Feed one head-yaw sample. Returns true if this sample completed a counted scan. */
  feed(yawDeg: number, t: number): boolean {
    const a = Math.abs(yawDeg)
    if (this.armed) {
      if (a > this.cfg.returnDeg) {
        this.armed = false
        this.crossed = false
      } else {
        return false
      }
    }
    // Excursion in progress.
    if (a >= this.cfg.minYawDeg) {
      if (!this.crossed) {
        this.crossed = true
        this.crossTime = t
        this.crossSide = yawDeg < 0 ? -1 : 1
      }
      this.belowMinTime = t
    }
    if (a <= this.cfg.returnDeg) {
      this.armed = true
      const counted =
        this.crossed &&
        this.windowOpen &&
        this.crossTime >= this.windowStart &&
        t - this.crossTime <= this.cfg.maxHoldSec
      this.crossed = false
      if (counted) {
        if (this.crossSide < 0) this.left++
        else this.right++
        this.lastCheckTime = this.belowMinTime
        return true
      }
    }
    return false
  }

  /**
   * Feeds synthetic yaw sequences through a fresh counter and reports pass/fail
   * for done criterion 1. Returns a list of human-readable result lines.
   */
  static runSelfTest(cfg: ScanConfig): {allPassed: boolean; lines: string[]} {
    const dt = 1 / 60
    const ramp = (from: number, to: number, sec: number): number[] => {
      const n = Math.max(1, Math.round(sec / dt))
      const out: number[] = []
      for (let i = 1; i <= n; i++) out.push(from + ((to - from) * i) / n)
      return out
    }
    const hold = (v: number, sec: number): number[] => ramp(v, v, sec)
    const run = (samples: number[]): ScanCounter => {
      const c = new ScanCounter(cfg)
      c.beginWindow(0)
      let t = 0
      c.feed(0, t)
      for (const s of samples) {
        t += dt
        c.feed(s, t)
      }
      return c
    }
    const cases: {name: string; samples: number[]; expectL: number; expectR: number}[] = [
      {name: "70 deg left and back in ~0.9 s counts 1", samples: [...ramp(0, -70, 0.3), ...hold(-70, 0.3), ...ramp(-70, 0, 0.3)], expectL: 1, expectR: 0},
      {name: "40 deg turn counts 0", samples: [...ramp(0, -40, 0.3), ...hold(-40, 0.3), ...ramp(-40, 0, 0.3)], expectL: 0, expectR: 0},
      {name: "90 deg held 3 s counts 0", samples: [...ramp(0, -90, 0.3), ...hold(-90, 3.0), ...ramp(-90, 0, 0.3)], expectL: 0, expectR: 0},
      {name: "no double count without returning inside 30 deg", samples: [...ramp(0, -70, 0.2), ...ramp(-70, -45, 0.2), ...ramp(-45, -70, 0.2), ...ramp(-70, 0, 0.3)], expectL: 1, expectR: 0},
      {name: "right turn 65 deg counts R1", samples: [...ramp(0, 65, 0.3), ...ramp(65, 0, 0.3)], expectL: 0, expectR: 1},
      {name: "left then right = L1 R1", samples: [...ramp(0, -70, 0.3), ...ramp(-70, 0, 0.3), ...ramp(0, 70, 0.3), ...ramp(70, 0, 0.3)], expectL: 1, expectR: 1},
    ]
    const lines: string[] = []
    let allPassed = true
    for (const c of cases) {
      const r = run(c.samples)
      const ok = r.left === c.expectL && r.right === c.expectR
      allPassed = allPassed && ok
      lines.push((ok ? "PASS " : "FAIL ") + c.name + " (got L" + r.left + " R" + r.right + ")")
    }
    return {allPassed, lines}
  }
}
