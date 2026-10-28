/**
 * ShoulderCheckPlayerFigure — one ghost player on the pitch (authored SceneObject).
 *
 * Owns: this player's visuals (translucent figure, hover outline shell, ground ring),
 * its colour state (team / grey silhouette / flash tint), and its pick target
 * (a SIK Interactable on a proxy collider placed along the eye ray, because SIK
 * interactors only raycast ~5 m and players stand 3-25 m away).
 *
 * The authored transform of this SceneObject IS the player's home spot — move it in
 * the Scene panel to change where this player starts. Keep it unit-scale.
 *
 * Expects: build(shared) called once by ShoulderCheckMain before use.
 * Must NOT: decide outcomes or hold round state — it reports picks via onPicked.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BodyStyle, PlayerBody} from "./ShoulderCheckBody"
import {Role} from "./ShoulderCheckLevels"
import {addVisual, makeMaterial} from "./ShoulderCheckProcMesh"

export interface FigureShared {
  baseMaterial: Material
  /** Fallback ghost figure, used only when no footballer body style is wired. */
  figureMesh: RenderMesh
  body: BodyStyle | null
  kit: Texture | null
  ringMesh: RenderMesh
  teamColor: vec4
  silhouetteColor: vec4
  hoverColor: vec4
  ringBaseRadiusCm: number
  ringGrowthPerMeterCm: number
  proxyDistanceCm: number
  proxyPadding: number
}

const FIGURE_HEIGHT_CM = 180
const FIGURE_WIDTH_CM = 46

@component
export class ShoulderCheckPlayerFigure extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckPlayerFigure – one ghost player</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Which player this is. Sets team (blue teammate / red opponent) and drill behaviour.")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Passer (centre-back)", "passer"),
      new ComboBoxItem("Opponent striker", "oppStriker"),
      new ComboBoxItem("Presser (opponent)", "presser"),
      new ComboBoxItem("Left winger", "leftWinger"),
      new ComboBoxItem("Right winger", "rightWinger"),
      new ComboBoxItem("Striker (teammate)", "striker"),
      new ComboBoxItem("Opponent midfielder", "oppMidfielder"),
      new ComboBoxItem("Opponent full-back", "fullBack"),
    ])
  )
  role: string = "passer"

  @input
  @hint("First level this player appears on (brief: L1 passer/presser/wingers/full-back, L2 midfielder, L3 striker, L4 opponent striker).")
  @widget(new SliderWidget(1, 10, 1))
  minLevel: number = 1
  @ui.group_end

  private _onPicked = new Event<ShoulderCheckPlayerFigure>()
  get onPicked(): PublicApi<ShoulderCheckPlayerFigure> {
    return this._onPicked.publicApi()
  }

  private shared: FigureShared | null = null
  private figureMat: Material | null = null
  private body: PlayerBody | null = null
  private lastPos: vec3 = vec3.zero()
  private speed = 0
  private outlineObj: SceneObject | null = null
  private ringObj: SceneObject | null = null
  private ringMat: Material | null = null
  private proxyObj: SceneObject | null = null
  private collider: ColliderComponent | null = null
  private pickable = false
  private hovered = false
  private homeLocal: vec3 = vec3.zero()
  private tint: vec4 | null = null
  private silhouette = false

  get roleId(): Role {
    return this.role as Role
  }

  get home(): vec3 {
    return this.homeLocal
  }

  onAwake(): void {
    this.homeLocal = this.getTransform().getLocalPosition()
  }

  build(shared: FigureShared): void {
    if (this.shared) return
    this.shared = shared
    const so = this.getSceneObject()

    // Hover outline: slightly larger shell, front faces culled so only the rim shows.
    const outlineMat = makeMaterial(shared.baseMaterial, shared.hoverColor, true)
    outlineMat.mainPass.cullMode = CullMode.Front
    if (shared.body && shared.kit) {
      this.body = new PlayerBody(so, "Figure", shared.body, shared.kit)
      this.figureMat = this.body.material
      // Child of the body, so it turns and scales with it.
      this.outlineObj = addVisual(this.body.so, "HoverOutline", shared.body.mesh, outlineMat)
      this.outlineObj.getTransform().setLocalScale(new vec3(1.1, 1.03, 1.1))
      this.body.link(this.outlineObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual)
    } else {
      this.figureMat = makeMaterial(shared.baseMaterial, shared.teamColor, true)
      addVisual(so, "Figure", shared.figureMesh, this.figureMat)
      this.outlineObj = addVisual(so, "HoverOutline", shared.figureMesh, outlineMat)
      this.outlineObj.getTransform().setLocalScale(new vec3(1.12, 1.04, 1.12))
    }
    this.outlineObj.getTransform().setLocalPosition(new vec3(0, -2, 0))
    this.outlineObj.enabled = false

    // Ground ring — grows with distance from the receiver so far players register on a glance.
    const d = this.homeLocal.length
    const outer = shared.ringBaseRadiusCm + (d / 100) * shared.ringGrowthPerMeterCm
    this.ringMat = makeMaterial(shared.baseMaterial, shared.teamColor, true, true)
    this.ringObj = addVisual(so, "GroundRing", shared.ringMesh, this.ringMat)
    this.ringObj.getTransform().setLocalPosition(new vec3(0, 1.5, 0))
    this.ringObj.getTransform().setLocalScale(new vec3(outer, 1, outer)) // ring mesh is unit radius (inner 0.78)

    // Pick proxy: unit-scale wrapper with a box collider + Interactable (leaf-free; sized via shape).
    this.proxyObj = global.scene.createSceneObject("PickProxy")
    this.proxyObj.setParent(so)
    this.collider = this.proxyObj.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(FIGURE_WIDTH_CM, FIGURE_HEIGHT_CM, FIGURE_WIDTH_CM)
    this.collider.shape = shape
    this.collider.fitVisual = false
    const interactable = this.proxyObj.createComponent(Interactable.getTypeName()) as Interactable
    this.proxyObj.enabled = false

    const bind = () => {
      interactable.onHoverEnter.add(() => {
        this.hovered = true
        this.refreshOutline()
      })
      interactable.onHoverExit.add(() => {
        this.hovered = false
        this.refreshOutline()
      })
      interactable.onTriggerEnd.add(() => {
        if (this.pickable) this._onPicked.invoke(this)
      })
    }
    // build() runs from Main's OnStart; Interactable events are safe to bind now.
    bind()
  }

  setActive(on: boolean): void {
    this.getSceneObject().enabled = on
  }

  get isActive(): boolean {
    return this.getSceneObject().enabled
  }

  setLocalPos(p: vec3): void {
    this.getTransform().setLocalPosition(p)
  }

  getLocalPos(): vec3 {
    return this.getTransform().getLocalPosition()
  }

  getWorldPos(): vec3 {
    return this.getTransform().getWorldPosition()
  }

  /** Grey, identical silhouette (freeze) vs team colour. */
  setSilhouette(on: boolean): void {
    this.silhouette = on
    this.applyColor()
  }

  /** Temporary tint override (flash amber/red, highlight marker). null = back to normal. */
  setTint(c: vec4 | null): void {
    this.tint = c
    this.applyColor()
  }

  setRingVisible(on: boolean): void {
    if (this.ringObj) this.ringObj.enabled = on
  }

  setPickable(on: boolean): void {
    this.pickable = on
    if (this.proxyObj) this.proxyObj.enabled = on
    if (!on) this.hovered = false
    this.refreshOutline()
  }

  /** Keep the pick proxy on the eye ray toward the figure, inside SIK's raycast range. */
  updateProxy(eyeWorld: vec3): void {
    if (!this.shared || !this.proxyObj || !this.collider || !this.pickable) return
    const center = this.getWorldPos().add(new vec3(0, FIGURE_HEIGHT_CM / 2, 0))
    const toFig = center.sub(eyeWorld)
    const dist = toFig.length
    if (dist < 1) return
    const r = Math.min(dist, this.shared.proxyDistanceCm)
    const k = (r / dist) * this.shared.proxyPadding
    this.proxyObj.getTransform().setWorldPosition(eyeWorld.add(toFig.uniformScale(r / dist)))
    const shape = this.collider.shape as BoxShape
    shape.size = new vec3(FIGURE_WIDTH_CM * k * 1.3, FIGURE_HEIGHT_CM * k, FIGURE_WIDTH_CM * k * 1.3)
    this.collider.shape = shape
  }

  /** Turn the body toward a Pitch-local point (no-op for the fallback ghost figure). */
  faceToward(targetLocal: vec3, dt: number): void {
    if (this.body) this.body.faceToward(this.getLocalPos(), targetLocal, dt)
  }

  /** Run or stand depending on how fast this player moved since the last call. Not called = pose holds. */
  animate(dt: number): void {
    const p = this.getLocalPos()
    if (dt > 0) {
      const v = p.sub(this.lastPos).length / dt
      this.speed += (v - this.speed) * Math.min(1, dt * 10)
    }
    this.lastPos = p
    if (this.body) this.body.animate(this.speed, dt)
  }

  /** Forget the previous position after a teleport (new round setup), so it doesn't read as a sprint. */
  resetMotion(): void {
    this.lastPos = this.getLocalPos()
    this.speed = 0
  }

  get poseName(): string {
    return this.body ? this.body.poseName.replace("Footballer_", "") : "ghost"
  }

  setKickFrame(i: number): void {
    if (this.body) this.body.setKickFrame(i)
  }

  private refreshOutline(): void {
    if (this.outlineObj) this.outlineObj.enabled = this.pickable && this.hovered
  }

  private applyColor(): void {
    if (!this.shared || !this.figureMat || !this.ringMat) return
    const c = this.tint ? this.tint : this.silhouette ? this.shared.silhouetteColor : this.shared.teamColor
    if (this.body) {
      // Real kit in play; one flat colour (same texture + baseColor for everyone) when frozen or tinted.
      if (this.tint || this.silhouette) this.body.showFlat(c)
      else this.body.showKit()
    } else {
      this.figureMat.mainPass.baseColor = c
    }
    this.ringMat.mainPass.baseColor = this.silhouette && !this.tint ? this.shared.silhouetteColor : c
  }
}
