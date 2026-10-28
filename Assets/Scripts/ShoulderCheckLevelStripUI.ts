/**
 * ShoulderCheckLevelStripUI — the small status pill shown between rounds:
 * bold "Level 3" on the left, muted "2 scans last round" on the right.
 *
 * Same visual language as the result card (ShoulderCheckUIStyle): dark rounded fill,
 * thin accent border, one bold item + one muted item. Small and low in view, and gone
 * as soon as the passer shapes to pass.
 *
 * Passive view: renders what ShoulderCheckMain pushes (setStatus), fades on show()/hide().
 * Position is owned by ShoulderCheckHeadFollow on the same SceneObject (1 m, ~15 deg below eye).
 * Holds no game state.
 */
import {buildRoundedFrameXY, buildRoundedRectXY} from "./ShoulderCheckProcMesh"
import {addUIMesh, addUIText, ORDER_BORDER, ORDER_FILL, PALETTE, withAlpha} from "./ShoulderCheckUIStyle"

@component
export class ShoulderCheckLevelStripUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckLevelStripUI – level pill</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Pill width, cm.")
  @widget(new SliderWidget(8, 40, 0.5))
  pillWidthCm: number = 19

  @input
  @hint("Pill height, cm.")
  @widget(new SliderWidget(2, 8, 0.1))
  pillHeightCm: number = 3.4

  @input
  @hint("Text size.")
  @widget(new SliderWidget(14, 60, 1))
  textSize: number = 38

  @input
  @hint("Fade in/out time, s.")
  @widget(new SliderWidget(0, 1.5, 0.05))
  fadeSec: number = 0.3
  @ui.group_end

  private content: SceneObject | null = null
  private fillMat: Material | null = null
  private borderMat: Material | null = null
  private levelText: Text | null = null
  private scansText: Text | null = null
  private alpha = 1
  private targetAlpha = 1

  setStatus(level: number, scans: number): void {
    if (!this.levelText || !this.scansText) return
    this.levelText.text = "Level " + level
    this.scansText.text = (scans === 1 ? "1 scan" : scans + " scans") + " last round"
  }

  show(): void {
    this.targetAlpha = 1
    if (this.content) this.content.enabled = true
  }

  hide(): void {
    this.targetAlpha = 0
  }

  get isVisible(): boolean {
    return this.alpha > 0.01
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = this.pillWidthCm
    const h = this.pillHeightCm
    this.content = global.scene.createSceneObject("Content")
    this.content.setParent(this.sceneObject)
    this.fillMat = addUIMesh(this.content, "Pill", buildRoundedRectXY(w, h, h / 2), PALETTE.card, ORDER_FILL)
    this.borderMat = addUIMesh(this.content, "Border", buildRoundedFrameXY(w, h, h / 2, 0.12), PALETTE.info, ORDER_BORDER)
    const pad = h * 0.5
    this.levelText = addUIText(this.content, "Level", this.textSize, PALETTE.title, 700,
      Rect.create(-w / 2 + pad, 0, -h / 2, h / 2), HorizontalAlignment.Left, false)
    this.scansText = addUIText(this.content, "Scans", this.textSize, PALETTE.label, 500,
      Rect.create(-w / 2 + pad, w / 2 - pad, -h / 2, h / 2), HorizontalAlignment.Right, false)
    this.setStatus(1, 0)
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
    if (this.borderMat) this.borderMat.mainPass.baseColor = withAlpha(PALETTE.info, 0.7 * a)
    if (this.levelText) this.levelText.textFill.color = withAlpha(PALETTE.title, a)
    if (this.scansText) this.scansText.textFill.color = withAlpha(PALETTE.label, a)
    if (a <= 0 && this.targetAlpha <= 0 && this.content) this.content.enabled = false
  }
}
