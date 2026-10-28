/**
 * ShoulderCheckPitch — the virtual grass pitch: a full-size pitch drawn around the receiver.
 *
 * Owns: mowing-striped grass + run-off apron, every pitch marking (touchlines, goal lines,
 * halfway line, centre circle/spot, penalty and goal areas, penalty spots and arcs, corner
 * arcs) and the two goals with nets, built under this authored SceneObject. The SceneObject's
 * transform sits at floor level, centred on the receiver (you), who faces their own goal (-Z)
 * just inside their own half. Players are siblings under the same Pitch root.
 *
 * Draw order: grass and lines don't write depth and draw first (lines after grass), so the
 * markings never z-fight with the grass at 60 m+, and everything else draws on top.
 *
 * Must NOT: move, hold game state, or build players.
 */
import {addVisual, makeMaterial, MeshBatch} from "./ShoulderCheckProcMesh"

const BASE_MAT = requireAsset("../Materials/ShoulderCheckGhost.mat") as Material

const GRASS_ORDER = -30
const LINE_ORDER = -20
const SEG = 48

@component
export class ShoulderCheckPitch extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckPitch – full-size virtual pitch</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Pitch length goal line to goal line, cm (FIFA standard 105 m).")
  @widget(new SliderWidget(6000, 12000, 50))
  pitchLengthCm: number = 10500

  @input
  @hint("Pitch width touchline to touchline, cm (FIFA standard 68 m).")
  @widget(new SliderWidget(4000, 9000, 50))
  pitchWidthCm: number = 6800

  @input
  @hint("Grass run-off beyond the lines, cm.")
  @widget(new SliderWidget(0, 1500, 50))
  apronCm: number = 600

  @input
  @hint("Distance behind the receiver to the halfway line, cm (you stand just inside your own half).")
  @widget(new SliderWidget(0, 3000, 50))
  halfwayBehindCm: number = 1200

  @input
  @hint("Number of mowing stripes between the goal lines.")
  @widget(new SliderWidget(2, 30, 1))
  stripes: number = 18

  @input
  @hint("Painted line width, cm.")
  @widget(new SliderWidget(4, 30, 1))
  lineWidthCm: number = 12

  @input("vec4", "{0.09,0.30,0.11,1}")
  @hint("Light mowing stripe. Additive display: keep it dim so players read on top.")
  @widget(new ColorWidget())
  grassLight: vec4

  @input("vec4", "{0.06,0.22,0.08,1}")
  @hint("Dark mowing stripe.")
  @widget(new ColorWidget())
  grassDark: vec4

  @input("vec4", "{0.05,0.18,0.07,1}")
  @hint("Run-off grass outside the lines.")
  @widget(new ColorWidget())
  apronColor: vec4

  @input("vec4", "{0.85,0.88,0.85,1}")
  @hint("Pitch line colour.")
  @widget(new ColorWidget())
  lineColor: vec4

  @input("vec4", "{0.95,0.95,0.95,1}")
  @hint("Goal frame colour.")
  @widget(new ColorWidget())
  goalColor: vec4

  @input("vec4", "{0.9,0.9,0.9,0.18}")
  @hint("Goal net (translucent).")
  @widget(new ColorWidget())
  netColor: vec4

  @input
  @hint("Show the pitch. Turn off on real glasses to train on your real pitch instead.")
  showPitch: boolean = true
  @ui.group_end

  onAwake(): void {
    if (!this.showPitch) return
    const so = this.getSceneObject()
    const hw = this.pitchWidthCm / 2
    const zMid = this.halfwayBehindCm
    const zOwn = zMid - this.pitchLengthCm / 2 // own goal line (in front of you)
    const zOpp = zMid + this.pitchLengthCm / 2 // opponents' goal line (behind you)
    const a = this.apronCm

    // Grass: apron frame + stripes, none overlapping.
    const light = new MeshBatch()
    const dark = new MeshBatch()
    const apron = new MeshBatch()
    const n = Math.max(2, Math.round(this.stripes))
    const sl = this.pitchLengthCm / n
    for (let i = 0; i < n; i++) (i % 2 === 0 ? light : dark).rectXZ(-hw, hw, zOwn + i * sl, zOwn + (i + 1) * sl)
    apron.rectXZ(-hw - a, hw + a, zOwn - a, zOwn)
    apron.rectXZ(-hw - a, hw + a, zOpp, zOpp + a)
    apron.rectXZ(-hw - a, -hw, zOwn, zOpp)
    apron.rectXZ(hw, hw + a, zOwn, zOpp)
    this.flat(so, "GrassLight", light, this.grassLight, GRASS_ORDER)
    this.flat(so, "GrassDark", dark, this.grassDark, GRASS_ORDER)
    this.flat(so, "GrassApron", apron, this.apronColor, GRASS_ORDER)

    // Markings.
    const w = this.lineWidthCm / 2
    const L = new MeshBatch()
    const hLine = (x0: number, x1: number, z: number) => L.rectXZ(x0 - w, x1 + w, z - w, z + w)
    const vLine = (x: number, z0: number, z1: number) => L.rectXZ(x - w, x + w, z0 - w, z1 + w)
    vLine(-hw, zOwn, zOpp)
    vLine(hw, zOwn, zOpp)
    hLine(-hw, hw, zOwn)
    hLine(-hw, hw, zOpp)
    hLine(-hw, hw, zMid)
    L.arcXZ(0, zMid, 915 - w, 915 + w, 0, Math.PI * 2, 96)
    L.arcXZ(0, zMid, 0, 18, 0, Math.PI * 2, 16)
    for (const end of [{z: zOwn, dir: 1}, {z: zOpp, dir: -1}]) {
      const box = (halfW: number, depth: number) => {
        const zIn = end.z + end.dir * depth
        vLine(-halfW, Math.min(end.z, zIn), Math.max(end.z, zIn))
        vLine(halfW, Math.min(end.z, zIn), Math.max(end.z, zIn))
        hLine(-halfW, halfW, zIn)
      }
      box(2016, 1650) // penalty area 40.32 m x 16.5 m
      box(916, 550) // goal area 18.32 m x 5.5 m
      const spotZ = end.z + end.dir * 1100
      L.arcXZ(0, spotZ, 0, 18, 0, Math.PI * 2, 16)
      // Penalty arc: the part of the 9.15 m circle outside the box (|dz| > 5.5 m).
      const t = Math.asin(550 / 915)
      if (end.dir > 0) L.arcXZ(0, spotZ, 915 - w, 915 + w, t, Math.PI - t, SEG)
      else L.arcXZ(0, spotZ, 915 - w, 915 + w, Math.PI + t, Math.PI * 2 - t, SEG)
    }
    // Corner arcs (1 m), quarter circles facing into the pitch.
    L.arcXZ(-hw, zOwn, 100 - w, 100 + w, 0, Math.PI / 2, 12)
    L.arcXZ(hw, zOwn, 100 - w, 100 + w, Math.PI / 2, Math.PI, 12)
    L.arcXZ(-hw, zOpp, 100 - w, 100 + w, -Math.PI / 2, 0, 12)
    L.arcXZ(hw, zOpp, 100 - w, 100 + w, Math.PI, Math.PI * 1.5, 12)
    this.flat(so, "Lines", L, this.lineColor, LINE_ORDER)

    // Goals: 7.32 m x 2.44 m, 12 cm posts, net 2 m deep behind the line.
    const frame = new MeshBatch()
    const net = new MeshBatch()
    for (const end of [{z: zOwn, dir: -1}, {z: zOpp, dir: 1}]) {
      const gw = 366
      const gh = 244
      const p = 6
      const z0 = end.z - p
      const z1 = end.z + p
      frame.box(-gw - p, 0, z0, -gw + p, gh + p, z1)
      frame.box(gw - p, 0, z0, gw + p, gh + p, z1)
      frame.box(-gw - p, gh - p, z0, gw + p, gh + p, z1)
      const zb = end.z + end.dir * 200
      const ztop = end.z + end.dir * 100
      net.quad([-gw, 0, zb, gw, 0, zb, gw, gh * 0.6, zb, -gw, gh * 0.6, zb, 0, 0, end.dir]) // back
      net.quad([-gw, gh * 0.6, zb, gw, gh * 0.6, zb, gw, gh, ztop, -gw, gh, ztop, 0, 1, 0]) // back slope
      net.quad([-gw, gh, end.z, gw, gh, end.z, gw, gh, ztop, -gw, gh, ztop, 0, 1, 0]) // roof
      for (const x of [-gw, gw]) {
        net.quad([x, 0, end.z, x, 0, zb, x, gh * 0.6, zb, x, gh, end.z, 1, 0, 0])
        net.quad([x, gh, end.z, x, gh * 0.6, zb, x, gh, ztop, x, gh, ztop, 1, 0, 0])
      }
    }
    addVisual(so, "GoalFrames", frame.build(), makeMaterial(BASE_MAT, this.goalColor, false, true))
    addVisual(so, "GoalNets", net.build(), makeMaterial(BASE_MAT, this.netColor, true, true))
  }

  private flat(parent: SceneObject, name: string, batch: MeshBatch, color: vec4, order: number): void {
    const mat = makeMaterial(BASE_MAT, color, false, true)
    mat.mainPass.depthWrite = false
    const v = addVisual(parent, name, batch.build(), mat)
    ;(v.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).renderOrder = order
  }
}
