/**
 * Done criterion 3c — clicking an opponent shows the red flash.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {Clicker} from "./ShoulderCheckLeafClick"
import {colorClose, figureColor, log, mainScript, nextFrame, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

@component
export class SC3cOpponentScenario extends Scenario {
  async run(): Promise<void> {
    const clicker = new Clicker()
    const main = mainScript()
    await waitForFreshShaping()
    await waitPhase("frozen")
    const opp = "fullBack"
    await clicker.click(opp)
    let redFrames = 0
    let offFrames = 0
    const t0 = getTime()
    while (getTime() - t0 < 0.9 && state().phase === "outcome") {
      if (colorClose(figureColor(opp), main.redColor as vec4)) redFrames++
      else offFrames++
      await nextFrame()
    }
    const s = state()
    log("C3c title='" + s.lastResult + "' redFrames=" + redFrames + " offFrames=" + offFrames)
    expect(s.lastResult).toBe("That's an opponent")
    expect(redFrames).toBeGreaterThan(0)
    expect(offFrames).toBeGreaterThan(0) // it flashes (on/off), not a steady tint
    log("C3c PASS")
  }
}
