/**
 * "Click" a player silhouette the way a user would: trigger its SIK Interactable
 * (the PickProxy) with LEAF's DefaultLeafInteractor.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {log, pickProxy} from "./ShoulderCheckLeafHelpers"

export class Clicker {
  private readonly interactor = new DefaultLeafInteractor("SCLeafClicker")

  async click(role: string): Promise<void> {
    const proxy = pickProxy(role)
    if (!proxy.isEnabledInHierarchy) throw new Error("PickProxy for '" + role + "' is not enabled (not pickable)")
    const it = proxy.getComponent(Interactable.getTypeName()) as Interactable
    if (!it) throw new Error("PickProxy for '" + role + "' has no Interactable")
    log("click " + role)
    await withTimeout(this.interactor.trigger(it), 3000, "trigger on '" + role + "' timed out")
  }
}
