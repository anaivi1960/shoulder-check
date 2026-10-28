/**
 * Done criterion 5 — The panel follows my head.
 * After clicking a silhouette behind me, the result panel glides into view ~1 m ahead and
 * slightly below eye level; it is fully gone before the next passer shapes to pass.
 *
 * The real camera (head) is turned with HeadDriver (same mechanism LEAF's IK head uses).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {Clicker} from "./ShoulderCheckLeafClick"
import {DEG, HeadDriver, camTransform, log, nextFrame, playerObject, sleep, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

function panel(): Transform {
  return findPanel().getTransform()
}

function findPanel(): SceneObject {
  const visit = (o: SceneObject): SceneObject | null => {
    if (o.name === "ResultPanel") return o
    for (let i = 0; i < o.getChildrenCount(); i++) {
      const r = visit(o.getChild(i))
      if (r) return r
    }
    return null
  }
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    const r = visit(global.scene.getRootObject(i))
    if (r) return r
  }
  throw new Error("SceneObject 'ResultPanel' not found")
}

/** Panel placement relative to the head: distance, degrees below eye level, yaw error vs look. */
function placement(): {dist: number; below: number; yawErr: number} {
  const cam = camTransform()
  const c = cam.getWorldPosition()
  const p = panel().getWorldPosition()
  const v = p.sub(c)
  const dist = v.length
  const below = Math.asin(Math.max(-1, Math.min(1, -v.y / Math.max(1e-3, dist)))) * DEG
  const f = cam.forward.uniformScale(-1)
  const lf = new vec3(f.x, 0, f.z).normalize()
  const lv = new vec3(v.x, 0, v.z).normalize()
  const yawErr = Math.acos(Math.max(-1, Math.min(1, lf.dot(lv)))) * DEG
  return {dist, below, yawErr}
}

@component
export class SC5PanelFollowScenario extends Scenario {
  async run(): Promise<void> {
    const clicker = new Clicker()
    const head = new HeadDriver()
    try {
      await waitForFreshShaping()
      await waitPhase("frozen")
      // Turn round to face the presser (behind-right) and click him.
      const pp = playerObject("presser").getTransform().getWorldPosition()
      const eye = camTransform().getWorldPosition()
      head.setLook(new vec3(pp.x - eye.x, 0, pp.z - eye.z))
      await sleep(150)
      const yaw = HeadDriver.currentYaw()
      log("C5 head yaw from passer before click: " + yaw.toFixed(1))
      expect(Math.abs(yaw)).toBeGreaterThan(120) // genuinely behind me
      await clicker.click("presser")
      expect(state().phase).toBe("outcome")

      // Glide: settle 0.3 s + exponential glide; sample at 2.0 s.
      await sleep(2000)
      const p1 = placement()
      log("C5 head driver: framesDriven=" + head.framesDriven + " lookMismatchFrames=" + head.mismatchFrames)
      log("C5 settled behind: dist=" + p1.dist.toFixed(1) + "cm below=" + p1.below.toFixed(1) + "deg yawErr=" + p1.yawErr.toFixed(1) + "deg visible=" + state().panelVisible)
      expect(state().panelVisible).toBe(true)
      expect(Math.abs(p1.dist - 100) < 5).toBe(true)
      expect(p1.below > 5 && p1.below < 15).toBe(true)
      expect(p1.yawErr < 3).toBe(true)

      // Turn again while the panel is up: it must not snap, then glide to the new spot.
      const before = panel().getWorldPosition()
      head.setYaw(HeadDriver.currentYaw() - 60)
      await nextFrame()
      await nextFrame()
      const jump = panel().getWorldPosition().sub(before).length
      log("C5 panel moved " + jump.toFixed(1) + " cm in the 2 frames after a 60 deg turn")
      expect(jump < 15).toBe(true)
      await sleep(2000)
      const p2 = placement()
      log("C5 after re-turn: dist=" + p2.dist.toFixed(1) + " below=" + p2.below.toFixed(1) + " yawErr=" + p2.yawErr.toFixed(1) + " visible=" + state().panelVisible + " phase=" + state().phase)
      expect(p2.yawErr < 3).toBe(true)
      expect(Math.abs(p2.dist - 100) < 5).toBe(true)

      // Gone before the next passer shapes to pass.
      await waitPhase("between", 15000)
      let goneAt = -1
      const tBetween = getTime()
      while (state().phase === "between") {
        if (goneAt < 0 && !state().panelVisible) goneAt = getTime() - tBetween
        await nextFrame()
      }
      const s = state()
      log("C5 panel gone " + goneAt.toFixed(2) + " s into 'between'; at '" + s.phase + "' panelVisible=" + s.panelVisible)
      expect(s.phase).toBe("shaping")
      expect(s.panelVisible).toBe(false)
      expect(goneAt >= 0).toBe(true)
      log("C5 PASS")
    } finally {
      head.stop()
    }
  }
}
