/**
 * Done criterion 1 — Scan counting.
 * During a pass, a >60 deg turn left and back within 1.5 s adds exactly one scan;
 * a 40 deg turn adds nothing; holding a 90 deg turn (3 s, and 1.7 s inside the window) adds nothing.
 * Head yaw is fed through global.shoulderCheck.setTestYaw (exact values, no mouse drag).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {hook, holdYaw, log, rampYaw, sleep, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

@component
export class SC1ScanCountingScenario extends Scenario {
  async run(): Promise<void> {
    const h = () => hook()
    try {
      // ── A: 70 deg left and back in ~0.8 s -> exactly 1 (L1) ──
      await waitForFreshShaping()
      h().setTestYaw(0)
      await sleep(50)
      expect(state().scans).toBe(0)
      await rampYaw(0, -70, 0.25)
      await holdYaw(-70, 0.3)
      await rampYaw(-70, 0, 0.25)
      await holdYaw(0, 0.1)
      const a = state()
      log("C1-A after 70deg L turn: phase=" + a.phase + " scans=" + a.scans + " L" + a.left + " R" + a.right)
      expect(a.phase === "shaping" || a.phase === "pass").toBe(true) // still inside the pass window
      expect(a.scans).toBe(1)
      expect(a.left).toBe(1)
      await waitPhase("frozen")
      expect(state().scans).toBe(1)
      h().pick("presser") // end the round quickly without levelling up
      // ── B: 40 deg turn -> 0 ──
      await waitForFreshShaping()
      h().setTestYaw(0)
      await rampYaw(0, -40, 0.25)
      await holdYaw(-40, 0.3)
      await rampYaw(-40, 0, 0.25)
      await holdYaw(0, 0.1)
      log("C1-B after 40deg turn: phase=" + state().phase + " scans=" + state().scans)
      expect(state().scans).toBe(0)
      await waitPhase("frozen")
      expect(state().scans).toBe(0)
      h().pick("presser")
      // ── C: 90 deg held 1.7 s, back inside the pass window -> 0 ──
      await waitForFreshShaping()
      h().setTestYaw(0)
      await rampYaw(0, -90, 0.1)
      await holdYaw(-90, 1.7)
      await rampYaw(-90, 0, 0.1)
      await holdYaw(0, 0.05)
      const c = state()
      log("C1-C after 90deg hold 1.7s: phase=" + c.phase + " scans=" + c.scans)
      expect(c.phase === "shaping" || c.phase === "pass").toBe(true)
      expect(c.scans).toBe(0)
      await waitPhase("frozen")
      h().pick("presser")
      // ── D: 90 deg held 3 s (brief's literal case) -> 0 ──
      await waitForFreshShaping()
      h().setTestYaw(0)
      await rampYaw(0, -90, 0.1)
      await holdYaw(-90, 3.0)
      await rampYaw(-90, 0, 0.1)
      await holdYaw(0, 0.1)
      log("C1-D after 90deg hold 3s: phase=" + state().phase + " scans=" + state().scans)
      expect(state().scans).toBe(0)
      log("C1 PASS")
    } finally {
      h().clearTestYaw()
    }
  }
}
