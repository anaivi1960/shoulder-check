/**
 * ShoulderCheckHeadFollow — lazy head-follow for a UI panel (level strip, result panel).
 *
 * Owns: this SceneObject's world position/rotation. Keeps the panel `distanceCm` ahead
 * of the head, `angleBelowDeg` below eye level, centred on head yaw. It waits until the
 * head has stopped turning for `settleDelaySec`, then glides there — it never snaps
 * while visible.
 *
 * Must NOT: show/hide the panel or set any text (the UI module does that).
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const DEG = 180 / Math.PI

@component
export class ShoulderCheckHeadFollow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckHeadFollow – lazy follow</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Distance in front of the head, cm.")
  @widget(new SliderWidget(40, 250, 5))
  distanceCm: number = 100

  @input
  @hint("Degrees below eye level.")
  @widget(new SliderWidget(0, 40, 1))
  angleBelowDeg: number = 10

  @input
  @hint("Head must be still this long before the panel starts gliding, s.")
  @widget(new SliderWidget(0, 1.5, 0.05))
  settleDelaySec: number = 0.3

  @input
  @hint("Head turn speed below which the head counts as 'still', deg/s.")
  @widget(new SliderWidget(5, 120, 5))
  stillThresholdDegPerSec: number = 30

  @input
  @hint("Glide responsiveness (higher = faster glide).")
  @widget(new SliderWidget(1, 20, 0.5))
  glideSpeed: number = 5
  @ui.group_end

  private cam: Transform | null = null
  private lastYaw = 0
  private lastMoveTime = 0
  private goal: vec3 | null = null
  private snapped = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.cam = WorldCameraFinderProvider.getInstance().getTransform()
      this.lastYaw = this.headYaw()
      this.snapNow()
    })
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Jump straight to the target (only call while hidden). */
  snapNow(): void {
    if (!this.cam) return
    this.goal = this.target()
    this.getTransform().setWorldPosition(this.goal)
    this.face()
    this.snapped = true
  }

  private headYaw(): number {
    if (!this.cam) return 0
    const f = this.cam.forward.uniformScale(-1)
    return Math.atan2(f.x, -f.z) * DEG
  }

  private target(): vec3 {
    const cam = this.cam as Transform
    const f = cam.forward.uniformScale(-1)
    const flat = new vec3(f.x, 0, f.z)
    const dir = flat.length > 1e-4 ? flat.normalize() : new vec3(0, 0, -1)
    const a = this.angleBelowDeg / DEG
    const off = dir.uniformScale(Math.cos(a) * this.distanceCm).add(new vec3(0, -Math.sin(a) * this.distanceCm, 0))
    return cam.getWorldPosition().add(off)
  }

  private face(): void {
    if (!this.cam) return
    const t = this.getTransform()
    const toCam = this.cam.getWorldPosition().sub(t.getWorldPosition())
    const flat = new vec3(toCam.x, 0, toCam.z)
    if (flat.length < 1e-3) return
    t.setWorldRotation(quat.lookAt(flat.normalize(), vec3.up()))
  }

  private tick(): void {
    if (!this.cam) return
    if (!this.snapped) this.snapNow()
    const now = getTime()
    const dt = Math.max(1e-3, getDeltaTime())
    const yaw = this.headYaw()
    let dy = yaw - this.lastYaw
    if (dy > 180) dy -= 360
    if (dy < -180) dy += 360
    this.lastYaw = yaw
    if (Math.abs(dy) / dt > this.stillThresholdDegPerSec) this.lastMoveTime = now
    if (now - this.lastMoveTime >= this.settleDelaySec) this.goal = this.target()
    if (!this.goal) return
    const t = this.getTransform()
    const k = 1 - Math.exp(-this.glideSpeed * dt)
    t.setWorldPosition(vec3.lerp(t.getWorldPosition(), this.goal, k))
    this.face()
  }
}
