/**
 * ShoulderCheckResultPanelUI — the result card shown after each pick.
 *
 * Glasses-first layout (one glance, then out of the way): a dark rounded card with a thin
 * border in the outcome colour; a severity icon; a muted label line (scans · decision
 * time), one bold result line, and a single coaching tip. Detail that belongs to a player
 * ("free man", "marked") is tagged on that player in the world instead (ShoulderCheckPlayerTags).
 *
 * Passive view: ShoulderCheckMain calls showResult()/hide(); it fades itself.
 * Position is owned by ShoulderCheckHeadFollow on the same SceneObject (1 m, ~12 deg below
 * eye, lazy follow), so it stays where you're already looking without covering the pitch.
 * Holds no game state.
 */
import {buildRoundedFrameXY, buildRoundedRectXY} from "./ShoulderCheckProcMesh"
import {addUIMesh, addUIText, ORDER_BORDER, ORDER_FILL, PALETTE, withAlpha} from "./ShoulderCheckUIStyle"

const ICON_OK: Texture = requireAsset("../Icons/check_circle.png") as Texture
const ICON_BAD: Texture = requireAsset("../Icons/cancel.png") as Texture
const IMAGE_MAT = requireAsset("../Materials/ImageMaterial.mat") as Material

export type ResultSeverity = "good" | "warn" | "bad"

@component
export class ShoulderCheckResultPanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckResultPanelUI – result card</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Card width, cm (at the 1 m head-follow distance; ~16 deg keeps it inside the glasses' view).")
  @widget(new SliderWidget(16, 50, 0.5))
  cardWidthCm: number = 28

  @input
  @hint("Card height, cm.")
  @widget(new SliderWidget(5, 20, 0.25))
  cardHeightCm: number = 8.5

  @input
  @hint("Corner radius, cm.")
  @widget(new SliderWidget(0, 4, 0.1))
  cornerCm: number = 1.4

  @input
  @hint("Result line text size.")
  @widget(new SliderWidget(20, 80, 1))
  titleSize: number = 62

  @input
  @hint("Label line (scans · decision) and tip text size.")
  @widget(new SliderWidget(14, 60, 1))
  smallSize: number = 40

  @input
  @hint("Fade in/out time, s.")
  @widget(new SliderWidget(0, 1.5, 0.05))
  fadeSec: number = 0.3
  @ui.group_end

  private content: SceneObject | null = null
  private fillMat: Material | null = null
  private borderMat: Material | null = null
  private iconMat: Material | null = null
  private label: Text | null = null
  private title: Text | null = null
  private tip: Text | null = null
  private accent: vec4 = PALETTE.good
  private alpha = 0
  private targetAlpha = 0

  /** label: muted line above (e.g. "2 scans · L1 R1 · 1.4 s decision"); tip: one coaching line below. */
  showResult(severity: ResultSeverity, title: string, label: string, tip: string): void {
    if (!this.title || !this.label || !this.tip || !this.iconMat) return
    this.title.text = title
    this.label.text = label
    this.tip.text = tip
    this.iconMat.mainPass.baseTex = severity === "good" ? ICON_OK : ICON_BAD
    this.accent = severity === "good" ? PALETTE.good : severity === "warn" ? PALETTE.warn : PALETTE.bad
    this.targetAlpha = 1
    if (this.content) this.content.enabled = true
    this.applyAlpha()
  }

  hide(): void {
    this.targetAlpha = 0
  }

  get isVisible(): boolean {
    return this.alpha > 0.01
  }

  get titleText(): string {
    return this.title ? this.title.text : ""
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = this.cardWidthCm
    const h = this.cardHeightCm
    this.content = global.scene.createSceneObject("Content")
    this.content.setParent(this.sceneObject)
    this.fillMat = addUIMesh(this.content, "Card", buildRoundedRectXY(w, h, this.cornerCm), PALETTE.card, ORDER_FILL)
    this.borderMat = addUIMesh(this.content, "Border", buildRoundedFrameXY(w, h, this.cornerCm, 0.14), PALETTE.good, ORDER_BORDER)

    // Icon on the left, vertically centred; text column to its right, left-aligned.
    const pad = 1.8
    const icon = 2.6
    const iconObj = global.scene.createSceneObject("Icon")
    iconObj.setParent(this.content)
    iconObj.getTransform().setLocalPosition(new vec3(-w / 2 + pad + icon / 2, 0, 0.05))
    iconObj.getTransform().setLocalScale(new vec3(icon, icon, 1))
    const img = iconObj.createComponent("Component.Image") as Image
    const mat = IMAGE_MAT.clone()
    mat.mainPass.baseTex = ICON_OK
    mat.mainPass.depthTest = false
    mat.mainPass.depthWrite = false
    img.mainMaterial = mat
    img.renderOrder = ORDER_BORDER + 1
    this.iconMat = mat

    const x0 = -w / 2 + pad + icon + 1.2
    const x1 = w / 2 - pad
    const row = (y: number, half: number) => Rect.create(x0, x1, y - half, y + half)
    this.label = addUIText(this.content, "Label", this.smallSize, PALETTE.label, 500, row(h * 0.27, 1), HorizontalAlignment.Left, true)
    this.title = addUIText(this.content, "Title", this.titleSize, PALETTE.title, 700, row(h * 0.02, 1.6), HorizontalAlignment.Left, true)
    this.tip = addUIText(this.content, "Tip", this.smallSize, PALETTE.body, 500, row(-h * 0.27, 1), HorizontalAlignment.Left, true)

    this.alpha = 0
    this.applyAlpha()
    this.createEvent("UpdateEvent").bind(() => this.tickFade())
  }

  private tickFade(): void {
    if (this.alpha === this.targetAlpha) return
    const step = this.fadeSec > 0 ? getDeltaTime() / this.fadeSec : 1
    this.alpha = this.targetAlpha > this.alpha ? Math.min(this.targetAlpha, this.alpha + step) : Math.max(this.targetAlpha, this.alpha - step)
    this.applyAlpha()
  }

  private applyAlpha(): void {
    const a = this.alpha
    if (this.fillMat) this.fillMat.mainPass.baseColor = withAlpha(PALETTE.card, a)
    if (this.borderMat) this.borderMat.mainPass.baseColor = withAlpha(this.accent, 0.9 * a)
    if (this.iconMat) this.iconMat.mainPass.baseColor = withAlpha(this.accent, a)
    if (this.label) this.label.textFill.color = withAlpha(PALETTE.label, a)
    if (this.title) this.title.textFill.color = withAlpha(PALETTE.title, a)
    if (this.tip) this.tip.textFill.color = withAlpha(PALETTE.body, a)
    // Only switch off once fully faded out — not on the first frame of a fade-in.
    if (a <= 0 && this.targetAlpha <= 0 && this.content) this.content.enabled = false
  }
}
