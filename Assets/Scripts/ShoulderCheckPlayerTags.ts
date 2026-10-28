/**
 * ShoulderCheckPlayerTags — short labels pinned above players' heads after a pick
 * ("FREE MAN", "MARKED", "OPPONENT", ...), so the answer sits on the player it's about
 * instead of in a block of text in front of your face.
 *
 * Each tag is a coloured rounded pill with dark text and a small pointer down to the head.
 * Tags face you and scale with distance so they keep the same apparent size (readable at
 * 25 m), and follow their player during the replay. Shown only after the freeze; the
 * live drill stays label-free (finding players is the skill).
 *
 * Must NOT: decide outcomes; ShoulderCheckMain says what to tag.
 */
import {addVisual, buildPointerXY, buildRoundedRectXY, makeMaterial} from "./ShoulderCheckProcMesh"
import {addUIText, ORDER_BORDER, ORDER_FILL, PALETTE, UI_MAT, withAlpha} from "./ShoulderCheckUIStyle"

export interface TagSpec {
  target: SceneObject
  text: string
  color: vec4
}

/** Tag size is designed for 1 m and scaled with distance. */
const REF_DIST_CM = 100
const PILL_H = 2.4
const CHAR_W = 0.95
const PILL_PAD = 1.3
const POINTER_H = 0.7
const TEXT_SIZE = 50
/** Height above the player's feet (the target's origin) of the pointer tip, cm (head top is ~180). */
const ABOVE_CM = 196
const MAX_TAGS = 3
const FADE_SEC = 0.25

class Tag {
  readonly root: SceneObject
  private pill: RenderMeshVisual
  private pillMat: Material
  private pointerMat: Material
  private text: Text
  private color: vec4 = PALETTE.good
  target: SceneObject | null = null

  constructor(parent: SceneObject, i: number) {
    this.root = global.scene.createSceneObject("Tag" + i)
    this.root.setParent(parent)
    this.root.createComponent("Component.Canvas")
    this.pillMat = this.uiMat()
    const pillObj = addVisual(this.root, "Pill", buildRoundedRectXY(8, PILL_H, PILL_H / 2), this.pillMat)
    pillObj.getTransform().setLocalPosition(new vec3(0, POINTER_H + PILL_H / 2, 0))
    this.pill = pillObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.pill.renderOrder = ORDER_FILL
    this.pointerMat = this.uiMat()
    const ptr = addVisual(this.root, "Pointer", buildPointerXY(1.2, POINTER_H + 0.05), this.pointerMat)
    ;(ptr.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).renderOrder = ORDER_FILL
    const y = POINTER_H + PILL_H / 2
    this.text = addUIText(this.root, "Label", TEXT_SIZE, PALETTE.tagText, 800,
      Rect.create(-20, 20, y - PILL_H / 2, y + PILL_H / 2), HorizontalAlignment.Center, false)
    this.text.renderOrder = ORDER_BORDER + 2
    this.root.enabled = false
  }

  set(spec: TagSpec): void {
    this.target = spec.target
    this.color = spec.color
    this.text.text = spec.text
    const w = spec.text.length * CHAR_W + PILL_PAD * 2
    this.pill.mesh = buildRoundedRectXY(w, PILL_H, PILL_H / 2)
    this.root.enabled = true
  }

  get label(): string {
    return this.text.text
  }

  clear(): void {
    this.target = null
    this.root.enabled = false
  }

  apply(alpha: number): void {
    this.pillMat.mainPass.baseColor = withAlpha(this.color, 0.95 * alpha)
    this.pointerMat.mainPass.baseColor = withAlpha(this.color, 0.95 * alpha)
    this.text.textFill.color = withAlpha(PALETTE.tagText, alpha)
  }

  place(eye: vec3): void {
    if (!this.target) return
    const anchor = this.target.getTransform().getWorldPosition().add(new vec3(0, ABOVE_CM, 0))
    const toEye = eye.sub(anchor)
    const dist = toEye.length
    if (dist < 1) return
    const t = this.root.getTransform()
    t.setWorldPosition(anchor)
    t.setWorldRotation(quat.lookAt(toEye.uniformScale(1 / dist), vec3.up()))
    t.setWorldScale(vec3.one().uniformScale(Math.max(0.6, dist / REF_DIST_CM)))
  }

  private uiMat(): Material {
    const m = makeMaterial(UI_MAT, PALETTE.good, true, true)
    m.mainPass.depthTest = false
    m.mainPass.depthWrite = false
    return m
  }
}

export class PlayerTags {
  private tags: Tag[] = []
  private alpha = 0
  private targetAlpha = 0

  constructor(parent: SceneObject) {
    const root = global.scene.createSceneObject("PlayerTags")
    root.setParent(parent)
    for (let i = 0; i < MAX_TAGS; i++) this.tags.push(new Tag(root, i))
  }

  show(specs: TagSpec[]): void {
    for (let i = 0; i < this.tags.length; i++) {
      if (i < specs.length) this.tags[i].set(specs[i])
      else this.tags[i].clear()
    }
    this.alpha = 0
    this.targetAlpha = 1
  }

  hideAll(): void {
    this.targetAlpha = 0
  }

  /** Text currently shown on each visible tag (for logs/tests). */
  get labels(): string[] {
    return this.tags.filter((t) => t.target).map((t) => t.label)
  }

  /** Call every frame with the eye position (world). */
  update(eye: vec3, dt: number): void {
    if (this.alpha !== this.targetAlpha) {
      const step = dt / FADE_SEC
      this.alpha = this.targetAlpha > this.alpha ? Math.min(1, this.alpha + step) : Math.max(0, this.alpha - step)
      if (this.alpha <= 0) for (const t of this.tags) t.clear()
    }
    for (const t of this.tags) {
      if (!t.target) continue
      t.apply(this.alpha)
      t.place(eye)
    }
  }
}
