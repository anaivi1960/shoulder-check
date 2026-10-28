/**
 * ShoulderCheckExtras — the rest of the 22: background players who fill out both teams.
 *
 * Owns: 13 footballer bodies (you are the 22nd player) at fixed formation spots, all at
 * least ~20 m from the receiver so they never crowd the drill, built under an "Extras"
 * SceneObject it creates under the Pitch root. They turn to watch the ball.
 *
 * They are scenery, not part of the question: never pickable, and they keep their kits at
 * the freeze, so the grey silhouettes are always exactly the players you can pick.
 *
 * Positions are Pitch-local cm: you stand at (0, 0) facing your own goal (-Z); blue
 * (your team) defends the -Z goal, red the +Z goal (see ShoulderCheckPitch).
 *
 * Must NOT: hold round state or take part in outcomes.
 */
import {BodyStyle, PlayerBody} from "./ShoulderCheckBody"

interface ExtraSpot {
  name: string
  x: number
  z: number
  team: boolean
  keeper?: boolean
}

// Drill players already on the pitch: blue passer (CB), wingers, striker and you;
// red striker, presser, midfielder and full-back.
const SPOTS: ExtraSpot[] = [
  // Off-centre so he doesn't sit exactly behind the passer's head from where you stand.
  {name: "BlueKeeper", x: -260, z: -3750, team: true, keeper: true},
  {name: "BlueCentreBack", x: -1300, z: -2300, team: true},
  {name: "BlueLeftBack", x: -2700, z: -1700, team: true},
  {name: "BlueRightBack", x: 2700, z: -1700, team: true},
  {name: "BlueLeftMid", x: -1900, z: 1800, team: true},
  {name: "BlueRightMid", x: 1900, z: 1800, team: true},
  {name: "RedKeeper", x: 0, z: 6150, team: false, keeper: true},
  {name: "RedCentreBackL", x: -900, z: 3500, team: false},
  {name: "RedCentreBackR", x: 900, z: 3500, team: false},
  {name: "RedFullBack", x: -2800, z: 900, team: false},
  {name: "RedMidfielderL", x: -2000, z: 1100, team: false},
  {name: "RedMidfielderR", x: 1800, z: 1200, team: false},
  {name: "RedWinger", x: 2900, z: -1400, team: false},
]

export interface ExtrasKits {
  teammate: Texture[]
  opponent: Texture[]
  teammateKeeper: Texture
  opponentKeeper: Texture
}

export class Extras {
  readonly root: SceneObject
  private bodies: {body: PlayerBody; pos: vec3}[] = []

  constructor(parent: SceneObject, style: BodyStyle, kits: ExtrasKits) {
    this.root = global.scene.createSceneObject("Extras")
    this.root.setParent(parent)
    let blue = 0
    let red = 0
    for (const s of SPOTS) {
      const holder = global.scene.createSceneObject(s.name)
      holder.setParent(this.root)
      const pos = new vec3(s.x, 0, s.z)
      holder.getTransform().setLocalPosition(pos)
      let kit: Texture
      if (s.keeper) kit = s.team ? kits.teammateKeeper : kits.opponentKeeper
      else if (s.team) kit = kits.teammate[blue++ % kits.teammate.length]
      else kit = kits.opponent[red++ % kits.opponent.length]
      this.bodies.push({body: new PlayerBody(holder, "Body", style, kit), pos})
    }
  }

  get count(): number {
    return this.bodies.length
  }

  faceToward(targetLocal: vec3, dt: number): void {
    for (const b of this.bodies) b.body.faceToward(b.pos, targetLocal, dt)
  }
}
