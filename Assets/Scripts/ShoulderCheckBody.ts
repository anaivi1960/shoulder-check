/**
 * ShoulderCheckBody — the footballer body visual shared by drill players and background extras.
 *
 * Owns: one lit footballer mesh (Assets/Models/Footballer.glb, built in Blender) per player,
 * its kit (a palette texture: shirt, shorts, socks, boots, skin, hair cells), flat-colour
 * mode (grey silhouette / flash tints swap to a white texture tinted by baseColor),
 * turning to face a point, and pose animation. One material per player = one draw call.
 *
 * Animation is a flipbook of baked poses (Assets/Models/FootballerPoses.glb, posed on a rig
 * in Blender): a ready stance, a 12-frame run cycle and a 3-frame kick. All poses share one
 * topology and UV layout, so swapping the mesh keeps the kit. Nothing animates unless
 * animate() is called, which is how the freeze holds everyone mid-stride.
 *
 * Must NOT: hold game state.
 */
import {addVisual} from "./ShoulderCheckProcMesh"

export interface BodyStyle {
  /** Ready stance (standing still). */
  mesh: RenderMesh
  /** Run cycle frames, in order; empty = no running animation. */
  run: RenderMesh[]
  /** Kick frames: wind-up, strike, follow-through. */
  kick: RenderMesh[]
  material: Material
  greyKit: Texture
  /** Uniform scale that makes the mesh 180 cm tall (import units vary). */
  scale: number
}

const WHITE = new vec4(1, 1, 1, 1)
const TURN_DEG_PER_SEC = 270
/** Below this speed the player stands in the ready stance, cm/s. */
const RUN_MIN_CM_PER_SEC = 45
/** Distance covered per run cycle (two strides), cm; sets the cadence. */
const CYCLE_CM = 220
const MIN_CYCLES_PER_SEC = 1.1
const MAX_CYCLES_PER_SEC = 2.6

export function bodyScale(mesh: RenderMesh, heightCm: number): number {
  const h = mesh.aabbMax.y - mesh.aabbMin.y
  return h > 0 ? heightCm / h : 1
}

export class PlayerBody {
  readonly so: SceneObject
  private mat: Material
  private kit: Texture
  private yaw = 0
  private hasYaw = false
  private visuals: RenderMeshVisual[] = []
  private current: RenderMesh
  private runPhase = 0
  private kickFrame = -1

  constructor(parent: SceneObject, name: string, private style: BodyStyle, kit: Texture) {
    this.kit = kit
    this.mat = style.material.clone()
    this.so = addVisual(parent, name, style.mesh, this.mat)
    this.so.getTransform().setLocalScale(vec3.one().uniformScale(style.scale))
    this.visuals.push(this.so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual)
    this.current = style.mesh
    // Players don't all step in sync.
    this.runPhase = Math.random()
    this.showKit()
  }

  get material(): Material {
    return this.mat
  }

  /** Name of the pose mesh showing now (for logs). */
  get poseName(): string {
    return this.current.name
  }

  /** Another visual (e.g. the hover outline) that must follow the pose. */
  link(rmv: RenderMeshVisual): void {
    this.visuals.push(rmv)
    rmv.mesh = this.current
  }

  /** Hold a kick frame (0 wind-up, 1 strike, 2 follow-through); -1 = back to run/stand. */
  setKickFrame(i: number): void {
    this.kickFrame = i
  }

  /** Advance the pose for this frame from the player's ground speed (cm/s). */
  animate(speedCmPerSec: number, dt: number): void {
    const s = this.style
    let mesh = s.mesh
    if (this.kickFrame >= 0 && this.kickFrame < s.kick.length) {
      mesh = s.kick[this.kickFrame]
    } else if (s.run.length > 0 && speedCmPerSec > RUN_MIN_CM_PER_SEC) {
      const rate = Math.max(MIN_CYCLES_PER_SEC, Math.min(MAX_CYCLES_PER_SEC, speedCmPerSec / CYCLE_CM))
      this.runPhase = (this.runPhase + rate * dt) % 1
      mesh = s.run[Math.floor(this.runPhase * s.run.length) % s.run.length]
    }
    if (mesh !== this.current) {
      this.current = mesh
      for (const v of this.visuals) v.mesh = mesh
    }
  }

  showKit(): void {
    this.mat.mainPass.baseTex = this.kit
    this.mat.mainPass.baseColor = WHITE
  }

  /** Solid colour over the whole body (grey silhouette, flash tints). */
  showFlat(c: vec4): void {
    this.mat.mainPass.baseTex = this.style.greyKit
    this.mat.mainPass.baseColor = c
  }

  /**
   * Turn (about +Y, the mesh faces +Z) so the body faces `target`, both in the parent's
   * parent space (the Pitch). `from` is where the body stands. dt <= 0 snaps.
   */
  faceToward(from: vec3, target: vec3, dt: number): void {
    const dx = target.x - from.x
    const dz = target.z - from.z
    if (dx * dx + dz * dz < 1) return
    const want = Math.atan2(dx, dz)
    if (!this.hasYaw || dt <= 0) {
      this.yaw = want
      this.hasYaw = true
    } else {
      let d = want - this.yaw
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      const step = TURN_DEG_PER_SEC * MathUtils.DegToRad * dt
      this.yaw += Math.max(-step, Math.min(step, d))
    }
    this.so.getTransform().setLocalRotation(quat.angleAxis(this.yaw, vec3.up()))
  }
}
