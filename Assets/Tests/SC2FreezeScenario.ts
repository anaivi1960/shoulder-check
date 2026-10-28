/**
 * Done criterion 2 — The freeze.
 * When the ball reaches me, every (active) player turns into an identical grey silhouette
 * within one frame, and the pick timer (4 s in the editor) starts.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {activeRoles, colorClose, figureColor, fmt, log, mainScript, nextFrame, state, waitForFreshShaping, waitPhase} from "./ShoulderCheckLeafHelpers"

@component
export class SC2FreezeScenario extends Scenario {
  async run(): Promise<void> {
    const grey = mainScript().silhouetteColor as vec4
    await waitForFreshShaping()
    await waitPhase("pass")
    const roles = activeRoles()
    expect(roles.length).toBeGreaterThan(3)

    // Before the freeze, players are in team colours (not grey).
    const before = roles.map((r) => figureColor(r))
    expect(before.some((c) => !colorClose(c, grey))).toBe(true)

    // Step frame-by-frame; on the very first frame the phase reads 'frozen', all must already be grey.
    let lastPassFrameAllGrey = true
    while (state().phase === "pass") {
      lastPassFrameAllGrey = roles.every((r) => colorClose(figureColor(r), grey))
      await nextFrame()
    }
    expect(state().phase).toBe("frozen")
    const tFreeze = getTime()
    const after = roles.map((r) => figureColor(r))
    log("C2 freeze frame colours: " + roles.map((r, i) => r + "=" + fmt(after[i])).join(" ") + " grey=" + fmt(grey))
    expect(lastPassFrameAllGrey).toBe(false) // not grey before the ball arrived
    for (let i = 0; i < roles.length; i++) {
      expect(colorClose(after[i], grey), roles[i] + " not grey at freeze: " + fmt(after[i])).toBe(true)
    }
    // Identical: every silhouette has exactly the same colour.
    for (const c of after) expect(colorClose(c, after[0], 1e-4)).toBe(true)

    // Pick timer: 4 s in the editor, and it actually runs out after ~4 s with no pick.
    expect(state().pickTimeSec).toBe(4)
    await waitPhase("outcome", 8000)
    const elapsed = getTime() - tFreeze
    log("C2 timer ran out after " + elapsed.toFixed(2) + " s; result='" + state().lastResult + "'")
    expect(elapsed).toBeGreaterThan(3.8)
    expect(elapsed < 4.3).toBe(true)
    log("C2 PASS")
  }
}
