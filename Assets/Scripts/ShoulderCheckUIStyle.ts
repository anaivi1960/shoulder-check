/**
 * ShoulderCheckUIStyle — shared look for the in-world notifications (result card, level
 * strip, player tags), following glasses UI guidance: short, high-contrast text; a muted
 * label line above one bold statement; dark rounded cards with a thin accent border; colour
 * only where it carries meaning (good / warn / bad).
 *
 * On the additive glasses display dark fills render as see-through, so the cards cost
 * nothing visually there; they add contrast in the preview and in recordings.
 *
 * Must NOT: hold state or create SceneObjects.
 */
import {addVisual, makeMaterial} from "./ShoulderCheckProcMesh"

export const UI_MAT = requireAsset("../Materials/ShoulderCheckGhost.mat") as Material

export const PALETTE = {
  card: new vec4(0.055, 0.06, 0.075, 0.72),
  label: new vec4(0.6, 0.65, 0.73, 1),
  title: new vec4(1, 1, 1, 1),
  body: new vec4(0.82, 0.86, 0.92, 1),
  good: new vec4(0.33, 0.9, 0.5, 1),
  warn: new vec4(1, 0.74, 0.22, 1),
  bad: new vec4(1, 0.38, 0.33, 1),
  info: new vec4(0.45, 0.68, 1, 1),
  tagText: new vec4(0.04, 0.05, 0.07, 1),
}

/** Card fill + text order: fills draw first, text on top, all above the pitch and players. */
export const ORDER_FILL = 98
export const ORDER_BORDER = 99
export const ORDER_TEXT = 100

export function withAlpha(c: vec4, a: number): vec4 {
  return new vec4(c.x, c.y, c.z, c.w * a)
}

/** A flat UI mesh that ignores depth (always readable) at the given draw order. */
export function addUIMesh(parent: SceneObject, name: string, mesh: RenderMesh, color: vec4, order: number): Material {
  const mat = makeMaterial(UI_MAT, color, true, true)
  mat.mainPass.depthTest = false
  mat.mainPass.depthWrite = false
  const so = addVisual(parent, name, mesh, mat)
  ;(so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).renderOrder = order
  return mat
}

/** World-space text, left/centre aligned in a box, always on top. */
export function addUIText(parent: SceneObject, name: string, size: number, color: vec4, weight: number,
    rect: Rect, align: HorizontalAlignment, shrink: boolean): Text {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const t = so.createComponent("Component.Text") as Text
  t.size = size
  ;(t as Text & {weight?: number}).weight = weight
  t.depthTest = false
  t.renderOrder = ORDER_TEXT
  t.horizontalAlignment = align
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = shrink ? HorizontalOverflow.Shrink : HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = rect
  t.textFill.color = color
  return t
}
