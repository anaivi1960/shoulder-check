/**
 * Shared helpers for the Shoulder Check LEAF scenarios.
 *
 * Drives the lens through its test hook (global.shoulderCheck) and reads runtime scene
 * state (figure colours, feedback visuals, panel transform). Never changes game logic.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {UpdateDispatcher} from "Leaf.lspkg/Utils/common/UpdateDispatcher"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"

export const DEG = 180 / Math.PI

export type Phase = "idle" | "between" | "shaping" | "pass" | "frozen" | "outcome" | "replay" | "result"

export interface SCState {
  phase: Phase
  level: number
  scans: number
  left: number
  right: number
  free: string | null
  marks: {marker: string; marked: string}[]
  pickTimeSec: number
  passSec: number
  lastResult: string
  panelVisible: boolean
  stripVisible: boolean
  seen: string[]
}

export interface SCHook {
  setTestYaw(deg: number): void
  clearTestYaw(): void
  start(): void
  pick(role: string): void
  pickFree(): void
  getState(): SCState
}

export function log(msg: string): void {
  print("[SC-LEAF] " + msg)
}

export function hook(): SCHook {
  const h = (global as any).shoulderCheck as SCHook
  if (!h) throw new Error("global.shoulderCheck test hook not installed (ShoulderCheckMain not started?)")
  return h
}

export function state(): SCState {
  return hook().getState()
}

/** Wait (frame-by-frame) until the round reaches `phase`. Returns the getTime() of the first frame in it. */
export async function waitPhase(phase: Phase, timeoutMs: number = 20000): Promise<number> {
  const start = getTime()
  while (state().phase !== phase) {
    if ((getTime() - start) * 1000 > timeoutMs) {
      throw new Error("Timed out waiting for phase '" + phase + "' (still '" + state().phase + "')")
    }
    await nextFrame()
  }
  return getTime()
}

/** Wait for the hook to exist and for a fresh round's SHAPING to begin. */
export async function waitForFreshShaping(timeoutMs: number = 25000): Promise<number> {
  const start = getTime()
  while (!(global as any).shoulderCheck) {
    if ((getTime() - start) * 1000 > timeoutMs) throw new Error("Test hook never appeared")
    await nextFrame()
  }
  // If we're already mid-round, wait for the next 'between' so we start at a clean SHAPING.
  if (state().phase !== "between") await waitPhase("between", timeoutMs)
  return waitPhase("shaping", timeoutMs)
}

/** Ramp the test yaw from `from` to `to` over `sec`, one value per frame. */
export async function rampYaw(from: number, to: number, sec: number): Promise<void> {
  const t0 = getTime()
  for (;;) {
    const u = Math.min(1, (getTime() - t0) / Math.max(1e-3, sec))
    hook().setTestYaw(from + (to - from) * u)
    if (u >= 1) break
    await nextFrame()
  }
}

/** Hold the test yaw at `deg` for `sec` (re-sets every frame). */
export async function holdYaw(deg: number, sec: number): Promise<void> {
  const t0 = getTime()
  while (getTime() - t0 < sec) {
    hook().setTestYaw(deg)
    await nextFrame()
  }
}

// ── Scene lookups ─────────────────────────────────

function scriptWith(so: SceneObject, field: string): any | null {
  const comps = so.getComponents("Component.ScriptComponent") as ScriptComponent[]
  for (const c of comps) if ((c as any)[field] !== undefined) return c as any
  return null
}

/** The ShoulderCheckMain component (for its colour inputs). */
export function mainScript(): any {
  const so = findSceneObjectByName("ShoulderCheck")
  if (!so) throw new Error("SceneObject 'ShoulderCheck' not found")
  const m = scriptWith(so, "silhouetteColor")
  if (!m) throw new Error("ShoulderCheckMain component not found on 'ShoulderCheck'")
  return m
}

/** Role -> player SceneObject (matched via ShoulderCheckPlayerFigure.role). */
export function playerObject(role: string): SceneObject {
  const players = findSceneObjectByName("Players")
  if (!players) throw new Error("SceneObject 'Players' not found")
  for (let i = 0; i < players.getChildrenCount(); i++) {
    const c = players.getChild(i)
    const fig = scriptWith(c, "role")
    if (fig && fig.role === role) return c
  }
  throw new Error("No player with role '" + role + "'")
}

export const ALL_ROLES = ["passer", "oppStriker", "presser", "leftWinger", "rightWinger", "striker", "oppMidfielder", "fullBack"]

export function activeRoles(): string[] {
  return ALL_ROLES.filter((r) => playerObject(r).enabled)
}

function childNamed(so: SceneObject, name: string): SceneObject | null {
  for (let i = 0; i < so.getChildrenCount(); i++) if (so.getChild(i).name === name) return so.getChild(i)
  return null
}

/** Current base colour of a player's figure material. */
export function figureColor(role: string): vec4 {
  const fig = childNamed(playerObject(role), "Figure")
  if (!fig) throw new Error("Player '" + role + "' has no 'Figure' child")
  const rmv = fig.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  return rmv.mainMaterial.mainPass.baseColor
}

export function pickProxy(role: string): SceneObject {
  const p = childNamed(playerObject(role), "PickProxy")
  if (!p) throw new Error("Player '" + role + "' has no 'PickProxy' child")
  return p
}

export function colorClose(a: vec4, b: vec4, eps: number = 0.01): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps && Math.abs(a.w - b.w) < eps
}

export function fmt(c: vec4 | vec3): string {
  const v = c as any
  return "(" + [v.x, v.y, v.z, v.w].filter((n) => n !== undefined).map((n: number) => n.toFixed(2)).join(",") + ")"
}

export function feedbackVisible(name: "FreeManRing" | "MarkerLine" | "GhostPassLine"): boolean {
  const fb = findSceneObjectByName("Feedback")
  if (!fb) throw new Error("SceneObject 'Feedback' not found")
  const o = childNamed(fb, name)
  if (!o) throw new Error("Feedback child '" + name + "' not found")
  return o.enabled
}

export function feedbackObject(name: string): SceneObject {
  const fb = findSceneObjectByName("Feedback") as SceneObject
  const o = childNamed(fb, name)
  if (!o) throw new Error("Feedback child '" + name + "' not found")
  return o
}

// ── Camera (head) driver ──────────────────────────

export function camTransform(): Transform {
  return WorldCameraFinderProvider.getInstance().getTransform()
}

/** Flat unit direction from the eye to the passer's chest (the game's "ball" direction). */
export function passerDir(): vec3 {
  const eye = camTransform().getWorldPosition()
  const p = playerObject("passer").getTransform().getWorldPosition().add(new vec3(0, 90, 0))
  const d = p.sub(eye)
  return new vec3(d.x, 0, d.z).normalize()
}

/** World look direction for a signed yaw (deg, + = right) from the passer direction. */
export function lookForYaw(yawDeg: number): vec3 {
  return quat.angleAxis(-yawDeg / DEG, vec3.up()).multiplyVec3(passerDir())
}

/**
 * Turns the real head (camera) to a given look direction. The preview's DeviceTracking
 * rewrites the camera's own transform every frame, so we rotate a temporary runtime parent
 * pivot (at the world origin, where the eye is) instead; every script — in any hierarchy
 * order — then sees the turned head. stop() puts the camera back at the root.
 */
export class HeadDriver {
  private look: vec3 | null = null
  private readonly camObj: SceneObject
  private readonly originalParent: SceneObject | null
  private pivot: SceneObject | null
  private unsub: (() => void) | null = null
  /** Frames where, at the start of our Update, the world look didn't match the requested one. */
  mismatchFrames = 0
  framesDriven = 0

  constructor() {
    this.camObj = camTransform().getSceneObject()
    this.originalParent = this.camObj.getParent()
    this.pivot = global.scene.createSceneObject("SCLeafHeadPivot")
    if (this.originalParent) this.pivot.setParent(this.originalParent)
    this.camObj.setParent(this.pivot)
    this.unsub = UpdateDispatcher.getInstance().onUpdate.add(() => {
      if (this.look) {
        this.framesDriven++
        const f = camTransform().forward.uniformScale(-1)
        const lf = new vec3(f.x, 0, f.z).normalize()
        if (lf.dot(this.look) < 0.9998) this.mismatchFrames++
      }
      this.apply()
    })
  }

  setYaw(yawDeg: number): void {
    this.look = lookForYaw(yawDeg)
    this.apply()
  }

  setLook(dir: vec3): void {
    this.look = new vec3(dir.x, 0, dir.z).normalize()
    this.apply()
  }

  private apply(): void {
    if (!this.look || !this.pivot) return
    // Tracked (local) look of the camera, flattened; rotate the pivot about +Y so it maps onto `look`.
    const lr = this.camObj.getTransform().getLocalRotation()
    const lf = lr.multiplyVec3(new vec3(0, 0, -1))
    const theta = Math.atan2(this.look.x, this.look.z) - Math.atan2(lf.x, lf.z)
    this.pivot.getTransform().setLocalRotation(quat.angleAxis(theta, vec3.up()))
  }

  /** Current yaw of the real camera relative to the passer direction (deg). */
  static currentYaw(): number {
    const f = camTransform().forward.uniformScale(-1)
    const l = new vec3(f.x, 0, f.z)
    const d = passerDir()
    const right = new vec3(-d.z, 0, d.x)
    return Math.atan2(l.dot(right), l.dot(d)) * DEG
  }

  stop(): void {
    if (this.unsub) this.unsub()
    this.unsub = null
    this.look = null
    if (this.pivot) {
      this.camObj.setParent(this.originalParent as SceneObject)
      this.pivot.destroy()
      this.pivot = null
    }
  }
}

/** Angular offsets (deg) of a world point from the camera's look axis: |horizontal|, |vertical|, in front? */
export function viewAngles(point: vec3): {ax: number; ay: number; inFront: boolean} {
  const cam = camTransform()
  const v = point.sub(cam.getWorldPosition())
  const look = cam.forward.uniformScale(-1)
  const z = v.dot(look)
  if (z <= 0) return {ax: 180, ay: 180, inFront: false}
  return {
    ax: Math.atan(Math.abs(v.dot(cam.right)) / z) * DEG,
    ay: Math.atan(Math.abs(v.dot(cam.up)) / z) * DEG,
    inFront: true,
  }
}

export {sleep, nextFrame}
