/**
 * Done criterion 3b — clicking a marked teammate shows the amber flash plus the marker line.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {Clicker} from "./ShoulderCheckLeafClick"
import {colorClose, feedbackObject, feedbackVisible, figureColor, log, mainScript, nextFrame, playerObject, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

@component
export class SC3bMarkedTeammateScenario extends Scenario {
  async run(): Promise<void> {
    const clicker = new Clicker()
    const main = mainScript()
    await waitForFreshShaping()
    await waitPhase("frozen")
    const marks = state().marks
    expect(marks.length).toBeGreaterThan(0)
    const {marker, marked} = marks[0]
    await clicker.click(marked)

    let sawAmber = false
    let sawMarkerRed = false
    let lineSeen = false
    const t0 = getTime()
    while (getTime() - t0 < 1.0 && state().phase === "outcome") {
      if (colorClose(figureColor(marked), main.amberColor as vec4)) sawAmber = true
      if (colorClose(figureColor(marker), main.redColor as vec4)) sawMarkerRed = true
      if (feedbackVisible("MarkerLine")) lineSeen = true
      await nextFrame()
    }
    const s = state()
    log("C3b marked=" + marked + " marker=" + marker + " title='" + s.lastResult + "' amber=" + sawAmber + " markerRed=" + sawMarkerRed + " line=" + lineSeen)
    expect(s.lastResult.indexOf("He was marked by") === 0).toBe(true)
    expect(sawAmber).toBe(true)
    expect(lineSeen).toBe(true)
    expect(sawMarkerRed).toBe(true)
    // Marker line starts at the marker.
    if (feedbackVisible("MarkerLine")) {
      const lp = feedbackObject("MarkerLine").getTransform().getWorldPosition()
      const mp = playerObject(marker).getTransform().getWorldPosition()
      expect(new vec3(lp.x - mp.x, 0, lp.z - mp.z).length < 5).toBe(true)
    }
    log("C3b PASS")
  }
}
