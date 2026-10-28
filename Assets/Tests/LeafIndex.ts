import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {SC1ScanCountingScenario} from "./SC1ScanCountingScenario"
import {SC2FreezeScenario} from "./SC2FreezeScenario"
import {SC3aFreeManScenario} from "./SC3aFreeManScenario"
import {SC3bMarkedTeammateScenario} from "./SC3bMarkedTeammateScenario"
import {SC3cOpponentScenario} from "./SC3cOpponentScenario"
import {SC3dTooSlowScenario} from "./SC3dTooSlowScenario"
import {SC4HiddenPlayersScenario} from "./SC4HiddenPlayersScenario"
import {SC5PanelFollowScenario} from "./SC5PanelFollowScenario"
import {DemoReelScenario} from "./DemoReelScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-scan-counting", typename: SC1ScanCountingScenario.getTypeName()},
    {id: "c2-freeze", typename: SC2FreezeScenario.getTypeName()},
    {id: "c3a-free-man", typename: SC3aFreeManScenario.getTypeName()},
    {id: "c3b-marked-teammate", typename: SC3bMarkedTeammateScenario.getTypeName()},
    {id: "c3c-opponent", typename: SC3cOpponentScenario.getTypeName()},
    {id: "c3d-too-slow", typename: SC3dTooSlowScenario.getTypeName()},
    {id: "c4-hidden-players", typename: SC4HiddenPlayersScenario.getTypeName()},
    {id: "c5-panel-follow", typename: SC5PanelFollowScenario.getTypeName()},
    // Not a test: scripted session used to record the submission video.
    {id: "demo-reel", typename: DemoReelScenario.getTypeName()},
  ]
}
