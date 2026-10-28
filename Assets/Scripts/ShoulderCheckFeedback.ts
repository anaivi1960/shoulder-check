/**
 * ShoulderCheckFeedback — on-pitch outcome visuals, built under the authored
 * "Feedback" SceneObject (a child of the Pitch root, so all positions are pitch-local).
 *
 * Owns: green ring on the free man, the short marker line (marker -> marked man),
 * the ghost pass line (me -> free man).
 *
 * Must NOT: decide outcomes; ShoulderCheckMain tells it what to draw.
 */
import {addVisual, makeMaterial} from "./ShoulderCheckProcMesh"

export interface FeedbackLook {
  baseMaterial: Material
  ringMesh: RenderMesh
  stripMesh: RenderMesh
  freeRingColor: vec4
  markerLineColor: vec4
  passLineColor: vec4
  lineWidthCm: number
}

export class Feedback {
  private freeRing: SceneObject
  private markerLine: SceneObject
  private passLine: SceneObject
  private ringRadius = 100

  constructor(root: SceneObject, private look: FeedbackLook) {
    this.freeRing = addVisual(root, "FreeManRing", look.ringMesh, makeMaterial(look.baseMaterial, look.freeRingColor, true, true))
    this.markerLine = addVisual(root, "MarkerLine", look.stripMesh, makeMaterial(look.baseMaterial, look.markerLineColor, true, true))
    this.passLine = addVisual(root, "GhostPassLine", look.stripMesh, makeMaterial(look.baseMaterial, look.passLineColor, true, true))
    this.hideAll()
  }

  hideAll(): void {
    this.freeRing.enabled = false
    this.markerLine.enabled = false
    this.passLine.enabled = false
  }

  hideLines(): void {
    this.markerLine.enabled = false
    this.passLine.enabled = false
  }

  /** Green ring at a pitch-local floor point; radius scales gently with distance. */
  showFreeRing(localPos: vec3, distanceFromMeCm: number): void {
    this.ringRadius = 70 + distanceFromMeCm * 0.03
    const t = this.freeRing.getTransform()
    t.setLocalPosition(new vec3(localPos.x, 2.5, localPos.z))
    t.setLocalScale(new vec3(this.ringRadius, 1, this.ringRadius))
    this.freeRing.enabled = true
  }

  moveFreeRing(localPos: vec3): void {
    if (!this.freeRing.enabled) return
    this.freeRing.getTransform().setLocalPosition(new vec3(localPos.x, 2.5, localPos.z))
  }

  showMarkerLine(a: vec3, b: vec3): void {
    this.placeStrip(this.markerLine, a, b, 3.0)
  }

  showPassLine(a: vec3, b: vec3): void {
    this.placeStrip(this.passLine, a, b, 3.5)
  }

  private placeStrip(obj: SceneObject, a: vec3, b: vec3, y: number): void {
    const d = new vec3(b.x - a.x, 0, b.z - a.z)
    const len = d.length
    if (len < 1) {
      obj.enabled = false
      return
    }
    const t = obj.getTransform()
    t.setLocalPosition(new vec3(a.x, y, a.z))
    t.setLocalRotation(quat.angleAxis(Math.atan2(d.x, d.z), vec3.up()))
    t.setLocalScale(new vec3(this.look.lineWidthCm, 1, len))
    obj.enabled = true
  }
}
