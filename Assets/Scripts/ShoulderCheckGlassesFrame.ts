/**
 * ShoulderCheckGlassesFrame — preview-only outline of the glasses' real view window
 * (about 37 x 32 deg), so "hidden players stay hidden" can be judged in the preview,
 * whose camera is wider than the glasses.
 *
 * Owns: a thin head-locked rectangle outline under the camera. Lives on an authored
 * SceneObject parented to the Camera Object. Hidden on device unless forced.
 *
 * Must NOT: affect gameplay. (Gameplay's view-window test uses the same angles via
 * ShoulderCheckMain's inputs.)
 */
import {addVisual, buildRectOutlineXY, makeMaterial} from "./ShoulderCheckProcMesh"

const BASE_MAT = requireAsset("../Materials/ShoulderCheckGhost.mat") as Material
const DEG = Math.PI / 180

@component
export class ShoulderCheckGlassesFrame extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckGlassesFrame – preview view-window outline</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Horizontal field of view of the glasses window, degrees.")
  @widget(new SliderWidget(20, 60, 0.5))
  widthDeg: number = 37

  @input
  @hint("Vertical field of view of the glasses window, degrees.")
  @widget(new SliderWidget(20, 60, 0.5))
  heightDeg: number = 32

  @input
  @hint("Distance of the outline in front of the eye, cm.")
  @widget(new SliderWidget(30, 300, 5))
  distanceCm: number = 100

  @input
  @hint("Line thickness, cm.")
  @widget(new SliderWidget(0.1, 2, 0.05))
  thicknessCm: number = 0.35

  @input("vec4", "{1,1,1,0.55}")
  @hint("Outline colour.")
  @widget(new ColorWidget())
  color: vec4

  @input
  @hint("Also show the outline on real glasses (normally preview only).")
  showOnDevice: boolean = false
  @ui.group_end

  onAwake(): void {
    const isEditor = global.deviceInfoSystem.isEditor()
    if (!isEditor && !this.showOnDevice) return
    const so = this.getSceneObject()
    so.getTransform().setLocalPosition(new vec3(0, 0, -this.distanceCm))
    const hw = Math.tan((this.widthDeg / 2) * DEG) * this.distanceCm
    const hh = Math.tan((this.heightDeg / 2) * DEG) * this.distanceCm
    const mat = makeMaterial(BASE_MAT, this.color, true, true)
    mat.mainPass.depthTest = false
    addVisual(so, "Outline", buildRectOutlineXY(hw, hh, this.thicknessCm), mat)
  }
}
