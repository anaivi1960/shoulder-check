/**
 * ShoulderCheckProcMesh — code-authored geometry (MeshBuilder) + material helpers.
 *
 * Owns: the ghost-player figure (lathe), ball (lathe sphere), flat ground ring,
 * unit ground strip (for lines), flat rectangle, and rectangle outline (glasses frame).
 * All triangles are CCW viewed from the front face (cross-product checked).
 *
 * Must NOT: hold game state or create SceneObjects.
 */

const LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3, normalized: true},
  {name: "texture0", components: 2},
]

function newBuilder(): MeshBuilder {
  const b = new MeshBuilder(LAYOUT)
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  return b
}

function finish(b: MeshBuilder): RenderMesh {
  b.updateMesh()
  return b.getMesh()
}

/**
 * Lathe a (radius, y) profile around +Y. Profile runs bottom -> top.
 * Quad (a=[i,j], b=[i,j+1], c=[i+1,j], d=[i+1,j+1]) -> tris (a,c,b), (b,c,d) face outward.
 */
export function buildLathe(profile: number[][], segments: number): RenderMesh {
  const b = newBuilder()
  const verts: number[] = []
  const rows = profile.length
  for (let i = 0; i < rows; i++) {
    const r = profile[i][0]
    const y = profile[i][1]
    // Approximate normal from neighbouring profile points.
    const p0 = profile[Math.max(0, i - 1)]
    const p1 = profile[Math.min(rows - 1, i + 1)]
    const dr = p1[0] - p0[0]
    const dy = p1[1] - p0[1]
    let nr = dy
    let ny = -dr
    const len = Math.sqrt(nr * nr + ny * ny) || 1
    nr /= len
    ny /= len
    for (let j = 0; j <= segments; j++) {
      const th = (j / segments) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      verts.push(r * c, y, r * s, nr * c, ny, nr * s, j / segments, i / (rows - 1))
    }
  }
  b.appendVerticesInterleaved(verts)
  const idx: number[] = []
  const stride = segments + 1
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * stride + j
      const bb = a + 1
      const c = a + stride
      const d = c + 1
      idx.push(a, c, bb, bb, c, d)
    }
  }
  b.appendIndices(idx)
  return finish(b)
}

/** 180 cm ghost player, feet at y = 0. */
export function buildFigure(heightCm: number): RenderMesh {
  const base: number[][] = [
    [0, 0], [13, 0], [14, 8], [12, 45], [15, 85], [19, 95], [17, 112],
    [22, 138], [21, 147], [9, 151], [8, 155], [11, 159], [12.5, 167], [10.5, 175], [5.5, 179], [0, 180],
  ]
  const k = heightCm / 180
  return buildLathe(base.map((p) => [p[0] * k, p[1] * k]), 20)
}

export function buildSphere(radiusCm: number, rings: number = 12, segments: number = 16): RenderMesh {
  const prof: number[][] = []
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + (i / rings) * Math.PI
    prof.push([Math.cos(a) * radiusCm, Math.sin(a) * radiusCm])
  }
  prof[0][0] = 0
  prof[rings][0] = 0
  return buildLathe(prof, segments)
}

/** Flat annulus on XZ, facing +Y. Quad (a=in_j, b=out_j, c=in_j+1, d=out_j+1) -> (a,c,b),(b,c,d). */
export function buildRing(innerCm: number, outerCm: number, segments: number = 48): RenderMesh {
  const b = newBuilder()
  const verts: number[] = []
  for (let j = 0; j <= segments; j++) {
    const th = (j / segments) * Math.PI * 2
    const c = Math.cos(th)
    const s = Math.sin(th)
    verts.push(innerCm * c, 0, innerCm * s, 0, 1, 0, j / segments, 0)
    verts.push(outerCm * c, 0, outerCm * s, 0, 1, 0, j / segments, 1)
  }
  b.appendVerticesInterleaved(verts)
  const idx: number[] = []
  for (let j = 0; j < segments; j++) {
    const a = j * 2
    const bb = a + 1
    const c = a + 2
    const d = a + 3
    idx.push(a, c, bb, bb, c, d)
  }
  b.appendIndices(idx)
  return finish(b)
}

/**
 * Unit strip on XZ facing +Y: x in [-0.5, 0.5], z in [0, 1].
 * Scale (width, 1, length) and yaw so local +Z points along the line.
 */
export function buildUnitStrip(): RenderMesh {
  return buildFlatRectXZ(-0.5, 0.5, 0, 1)
}

/** Flat rectangle on XZ facing +Y. Tris (p00,p01,p10), (p10,p01,p11). */
export function buildFlatRectXZ(x0: number, x1: number, z0: number, z1: number): RenderMesh {
  const b = newBuilder()
  b.appendVerticesInterleaved([
    x0, 0, z0, 0, 1, 0, 0, 0,
    x1, 0, z0, 0, 1, 0, 1, 0,
    x1, 0, z1, 0, 1, 0, 1, 1,
    x0, 0, z1, 0, 1, 0, 0, 1,
  ])
  // p00=0 p10=1 p11=2 p01=3
  b.appendIndices([0, 3, 1, 1, 3, 2])
  return finish(b)
}

/** Rectangle outline in the XY plane, facing +Z (toward a camera looking down -Z). */
export function buildRectOutlineXY(halfW: number, halfH: number, thick: number): RenderMesh {
  const b = newBuilder()
  const verts: number[] = []
  const idx: number[] = []
  const quad = (x0: number, y0: number, x1: number, y1: number) => {
    const o = verts.length / 8
    verts.push(x0, y0, 0, 0, 0, 1, 0, 0)
    verts.push(x1, y0, 0, 0, 0, 1, 1, 0)
    verts.push(x1, y1, 0, 0, 0, 1, 1, 1)
    verts.push(x0, y1, 0, 0, 0, 1, 0, 1)
    // (p00,p10,p11), (p00,p11,p01) -> +Z
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  quad(-halfW, halfH - thick, halfW, halfH) // top
  quad(-halfW, -halfH, halfW, -halfH + thick) // bottom
  quad(-halfW, -halfH + thick, -halfW + thick, halfH - thick) // left
  quad(halfW - thick, -halfH + thick, halfW, halfH - thick) // right
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
  return finish(b)
}

/** Perimeter of a rounded rectangle centred at the origin, counter-clockwise from the right edge. */
function roundedPerimeter(w: number, h: number, r: number, seg: number): number[][] {
  const pts: number[][] = []
  const cx = w / 2 - r
  const cy = h / 2 - r
  const corners = [[cx, cy], [-cx, cy], [-cx, -cy], [cx, -cy]]
  for (let c = 0; c < 4; c++) {
    for (let j = 0; j <= seg; j++) {
      const a = (c + j / seg) * (Math.PI / 2)
      pts.push([corners[c][0] + r * Math.cos(a), corners[c][1] + r * Math.sin(a)])
    }
  }
  return pts
}

/** Filled rounded rectangle in the XY plane facing +Z (fan, CCW). */
export function buildRoundedRectXY(w: number, h: number, r: number, seg: number = 6): RenderMesh {
  r = Math.min(r, w / 2, h / 2)
  const b = newBuilder()
  const pts = roundedPerimeter(w, h, r, seg)
  const verts: number[] = [0, 0, 0, 0, 0, 1, 0.5, 0.5]
  for (const p of pts) verts.push(p[0], p[1], 0, 0, 0, 1, p[0] / w + 0.5, p[1] / h + 0.5)
  const idx: number[] = []
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length))
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
  return finish(b)
}

/** Rounded-rectangle border of thickness `t` in the XY plane facing +Z. */
export function buildRoundedFrameXY(w: number, h: number, r: number, t: number, seg: number = 6): RenderMesh {
  r = Math.min(r, w / 2, h / 2)
  const b = newBuilder()
  const out = roundedPerimeter(w, h, r, seg)
  const inn = roundedPerimeter(w - 2 * t, h - 2 * t, Math.max(0.01, r - t), seg)
  const verts: number[] = []
  for (let i = 0; i < out.length; i++) {
    verts.push(inn[i][0], inn[i][1], 0, 0, 0, 1, 0, 0)
    verts.push(out[i][0], out[i][1], 0, 0, 0, 1, 1, 1)
  }
  const idx: number[] = []
  const n = out.length
  for (let i = 0; i < n; i++) {
    const a = i * 2
    const c = ((i + 1) % n) * 2
    // (in_i, out_i, out_i+1), (in_i, out_i+1, in_i+1) -> +Z
    idx.push(a, a + 1, c + 1, a, c + 1, c)
  }
  b.appendVerticesInterleaved(verts)
  b.appendIndices(idx)
  return finish(b)
}

/** Downward-pointing triangle in the XY plane facing +Z, tip at the origin. */
export function buildPointerXY(w: number, h: number): RenderMesh {
  const b = newBuilder()
  b.appendVerticesInterleaved([0, 0, 0, 0, 0, 1, 0.5, 0, w / 2, h, 0, 0, 0, 1, 1, 1, -w / 2, h, 0, 0, 0, 1, 0, 1])
  b.appendIndices([0, 1, 2])
  return finish(b)
}

/**
 * Many flat pieces (and boxes) merged into one mesh, so a whole set of pitch lines
 * is one draw call. Same winding as buildFlatRectXZ / buildRing (faces +Y).
 */
export class MeshBatch {
  private verts: number[] = []
  private idx: number[] = []

  get vertexCount(): number {
    return this.verts.length / 8
  }

  /** Flat rectangle on XZ at height y. */
  rectXZ(x0: number, x1: number, z0: number, z1: number, y: number = 0): void {
    const o = this.vertexCount
    this.verts.push(x0, y, z0, 0, 1, 0, 0, 0, x1, y, z0, 0, 1, 0, 1, 0, x1, y, z1, 0, 1, 0, 1, 1, x0, y, z1, 0, 1, 0, 0, 1)
    this.idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 2)
  }

  /** Flat arc band on XZ centred at (cx, cz), angles in radians (x = r cos a, z = r sin a). */
  arcXZ(cx: number, cz: number, rIn: number, rOut: number, a0: number, a1: number, segments: number, y: number = 0): void {
    const o = this.vertexCount
    for (let j = 0; j <= segments; j++) {
      const th = a0 + ((a1 - a0) * j) / segments
      const c = Math.cos(th)
      const s = Math.sin(th)
      this.verts.push(cx + rIn * c, y, cz + rIn * s, 0, 1, 0, j / segments, 0)
      this.verts.push(cx + rOut * c, y, cz + rOut * s, 0, 1, 0, j / segments, 1)
    }
    for (let j = 0; j < segments; j++) {
      const a = o + j * 2
      this.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }

  /** Axis-aligned box (use with a two-sided material; winding is not checked per face). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const faces: number[][] = [
      [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1],
      [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1],
      [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0],
      [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0],
      [x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0],
      [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0],
    ]
    for (const f of faces) this.quad(f)
  }

  /** Vertical quad from 4 corners [x,y,z]*4 + normal (use with a two-sided material). */
  quad(f: number[]): void {
    const o = this.vertexCount
    const uv = [0, 0, 1, 0, 1, 1, 0, 1]
    for (let k = 0; k < 4; k++) this.verts.push(f[k * 3], f[k * 3 + 1], f[k * 3 + 2], f[12], f[13], f[14], uv[k * 2], uv[k * 2 + 1])
    this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }

  build(): RenderMesh {
    const b = newBuilder()
    b.appendVerticesInterleaved(this.verts)
    b.appendIndices(this.idx)
    return finish(b)
  }
}

/** Clone the base unlit material and configure colour + transparency. */
export function makeMaterial(base: Material, color: vec4, translucent: boolean, twoSided: boolean = false): Material {
  const m = base.clone()
  const p = m.mainPass
  p.baseColor = color
  p.twoSided = twoSided
  if (translucent) {
    p.blendMode = BlendMode.Normal
    p.depthWrite = false
  } else {
    p.blendMode = BlendMode.Disabled
    p.depthWrite = true
  }
  p.depthTest = true
  return m
}

export function addVisual(parent: SceneObject, name: string, mesh: RenderMesh, mat: Material): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  rmv.mesh = mesh
  rmv.mainMaterial = mat
  return so
}
