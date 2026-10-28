/**
 * ShoulderCheckHeadTracker — reads head pose and answers "how far am I turned from
 * the ball?" and "is this point inside the glasses' central view window?".
 *
 * Owns: the optional test-yaw override (LEAF / test hook feeds exact yaw values),
 * signed yaw relative to the passer direction (negative = left, positive = right).
 *
 * Must NOT: count scans (ScanCounter does) or know about rounds.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const DEG = 180 / Math.PI

export class HeadTracker {
  private cam: Transform
  private testYaw: number | null = null

  constructor() {
    this.cam = WorldCameraFinderProvider.getInstance().getTransform()
  }

  get eyeWorld(): vec3 {
    return this.cam.getWorldPosition()
  }

  /** World look direction (camera looks down its local -Z). */
  get look(): vec3 {
    return this.cam.forward.uniformScale(-1)
  }

  setTestYaw(deg: number | null): void {
    this.testYaw = deg
  }

  get testYawActive(): boolean {
    return this.testYaw !== null
  }

  /** Signed yaw (deg) of the head relative to the flat direction to `ballTarget`. */
  yawFrom(ballTarget: vec3): number {
    if (this.testYaw !== null) return this.testYaw
    const d = flat(ballTarget.sub(this.eyeWorld))
    const l = flat(this.look)
    if (d.length < 1e-4 || l.length < 1e-4) return 0
    const right = new vec3(-d.z, 0, d.x) // right of d when facing along d
    return Math.atan2(l.dot(right), l.dot(d)) * DEG
  }

  /** Inside the central view window (halfW x halfH degrees) of the current / test head pose. */
  inView(point: vec3, ballTarget: vec3, halfWDeg: number, halfHDeg: number): boolean {
    const v = point.sub(this.eyeWorld)
    let look: vec3
    let right: vec3
    let up: vec3
    if (this.testYaw !== null) {
      const d = flat(ballTarget.sub(this.eyeWorld)).normalize()
      const q = quat.angleAxis(-this.testYaw / DEG, vec3.up())
      look = q.multiplyVec3(d)
      up = vec3.up()
      right = look.cross(up).normalize()
    } else {
      look = this.look
      right = this.cam.right
      up = this.cam.up
    }
    const z = v.dot(look)
    if (z <= 0) return false
    const ax = Math.atan(Math.abs(v.dot(right)) / z) * DEG
    const ay = Math.atan(Math.abs(v.dot(up)) / z) * DEG
    return ax <= halfWDeg && ay <= halfHDeg
  }
}

function flat(v: vec3): vec3 {
  return new vec3(v.x, 0, v.z)
}
