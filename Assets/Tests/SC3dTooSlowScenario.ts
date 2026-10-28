/**
 * Done criterion 3d — not clicking for 4 s makes the presser step in with "Lost the ball, too slow".
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {camTransform, log, playerObject, sleep, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

function presserDistToMe(): number {
  const p = playerObject("presser").getTransform().getWorldPosition()
  const e = camTransform().getWorldPosition()
  return new vec3(p.x - e.x, 0, p.z - e.z).length
}

@component
export class SC3dTooSlowScenario extends Scenario {
  async run(): Promise<void> {
    await waitForFreshShaping()
    const tFreeze = await waitPhase("frozen")
    const dBefore = presserDistToMe()
    await waitPhase("outcome", 8000)
    const waited = getTime() - tFreeze
    await sleep(600)
    const dAfter = presserDistToMe()
    const s = state()
    log("C3d waited=" + waited.toFixed(2) + "s title='" + s.lastResult + "' presser dist " + dBefore.toFixed(0) + " -> " + dAfter.toFixed(0) + " cm")
    expect(waited).toBeGreaterThan(3.8)
    expect(s.lastResult).toBe("Lost the ball, too slow")
    expect(dAfter < dBefore - 20).toBe(true) // presser stepped in
    log("C3d PASS")
  }
}
