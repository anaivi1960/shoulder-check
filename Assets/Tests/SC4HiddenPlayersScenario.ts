/**
 * Done criterion 4 — Hidden players stay hidden.
 * Facing straight at the passer, the left winger, right winger and striker are outside the
 * glasses-view window (37 x 32 deg => +-18.5 x +-16 deg); they're only seen by turning.
 *
 * Two checks:
 *  (a) geometry with the real camera aimed at the passer (all three, even if not yet active);
 *  (b) the game's own "seen" record: a full pass with head yaw 0 sees none of the active ones,
 *      a pass with a 90 deg left turn sees the left winger.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {HeadDriver, hook, holdYaw, log, mainScript, playerObject, rampYaw, sleep, state, viewAngles, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

const HIDDEN = ["leftWinger", "rightWinger", "striker"]

@component
export class SC4HiddenPlayersScenario extends Scenario {
  async run(): Promise<void> {
    const main = mainScript()
    const halfW = main.viewHalfWidthDeg as number
    const halfH = main.viewHalfHeightDeg as number
    expect(halfW).toBeCloseTo(18.5, 1)
    expect(halfH).toBeCloseTo(16, 1)

    // (a) Geometry: aim the real head at the passer, check each player's angular offset.
    await waitForFreshShaping()
    const head = new HeadDriver()
    try {
      head.setYaw(0)
      await sleep(100)
      const yawNow = HeadDriver.currentYaw()
      log("C4 camera yaw from passer after aiming: " + yawNow.toFixed(2))
      expect(Math.abs(yawNow) < 1).toBe(true)
      const centre = (r: string) => playerObject(r).getTransform().getWorldPosition().add(new vec3(0, 90, 0))
      const pa = viewAngles(centre("passer"))
      log("C4 passer ax=" + pa.ax.toFixed(1) + " ay=" + pa.ay.toFixed(1))
      expect(pa.inFront && pa.ax <= halfW && pa.ay <= halfH).toBe(true)
      for (const r of HIDDEN) {
        const a = viewAngles(centre(r))
        const inside = a.inFront && a.ax <= halfW && a.ay <= halfH
        log("C4 " + r + " active=" + playerObject(r).enabled + " inFront=" + a.inFront + " ax=" + a.ax.toFixed(1) + " ay=" + a.ay.toFixed(1) + " inside=" + inside)
        expect(inside, r + " visible inside the glasses frame while facing the passer").toBe(false)
      }
      // Turning brings them into the frame.
      head.setYaw(-90)
      await sleep(100)
      const lw = viewAngles(centre("leftWinger"))
      log("C4 turned -90: leftWinger ax=" + lw.ax.toFixed(1) + " ay=" + lw.ay.toFixed(1))
      expect(lw.inFront && lw.ax <= halfW && lw.ay <= halfH).toBe(true)
      head.setYaw(180)
      await sleep(100)
      const st = viewAngles(centre("striker"))
      log("C4 turned 180: striker ax=" + st.ax.toFixed(1) + " ay=" + st.ay.toFixed(1))
      expect(st.inFront && st.ax <= halfW && st.ay <= halfH).toBe(true)
    } finally {
      head.stop()
    }

    // (b) Game's seen record through a whole pass at yaw 0 (players moving).
    try {
      await waitForFreshShaping()
      await holdYaw(0, 0.05)
      while (state().phase === "shaping" || state().phase === "pass") await holdYaw(0, 0.05)
      const seen0 = state().seen
      log("C4 seen while facing passer: [" + seen0.join(",") + "]")
      for (const r of HIDDEN) expect(seen0.indexOf(r) >= 0, r + " was 'seen' without turning").toBe(false)
      expect(seen0.indexOf("passer") >= 0).toBe(true)
      hook().pick("presser")

      await waitForFreshShaping()
      await rampYaw(0, -90, 0.2)
      await holdYaw(-90, 0.4)
      await rampYaw(-90, 0, 0.2)
      const seenL = state().seen
      log("C4 seen after a 90 deg left turn: [" + seenL.join(",") + "]")
      expect(seenL.indexOf("leftWinger") >= 0).toBe(true)
      await waitPhase("frozen")
      hook().pick("presser")
      log("C4 PASS")
    } finally {
      hook().clearTestYaw()
    }
  }
}
