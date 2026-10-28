/**
 * Done criterion 3a — clicking the free teammate shows the green ring and "Free man found".
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {Clicker} from "./ShoulderCheckLeafClick"
import {colorClose, feedbackObject, feedbackVisible, figureColor, fmt, log, mainScript, playerObject, sleep, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

@component
export class SC3aFreeManScenario extends Scenario {
  async run(): Promise<void> {
    const clicker = new Clicker()
    const main = mainScript()
    await waitForFreshShaping()
    await waitPhase("frozen")
    const free = state().free as string
    expect(free !== null).toBe(true)
    await clicker.click(free)
    await sleep(100)
    const s = state()
    log("C3a outcome: phase=" + s.phase + " free=" + free + " title='" + s.lastResult + "' ring=" + feedbackVisible("FreeManRing"))
    expect(s.phase).toBe("outcome")
    expect(s.lastResult).toBe("Free man found")
    // Green ring under the free man.
    expect(feedbackVisible("FreeManRing")).toBe(true)
    const ringPos = feedbackObject("FreeManRing").getTransform().getWorldPosition()
    const manPos = playerObject(free).getTransform().getWorldPosition()
    const d = new vec3(ringPos.x - manPos.x, 0, ringPos.z - manPos.z).length
    expect(d < 5).toBe(true)
    // Free man solid blue, pass line drawn.
    expect(colorClose(figureColor(free), main.foundColor as vec4), "free man colour " + fmt(figureColor(free))).toBe(true)
    expect(feedbackVisible("GhostPassLine")).toBe(true)
    await sleep(500)
    expect(state().panelVisible).toBe(true)
    log("C3a PASS")
  }
}
