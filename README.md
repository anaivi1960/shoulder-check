# Shoulder Check

A Snap Spectacles Lens that trains footballers to **check their shoulders before the ball arrives**. Built for the *Learn AR with SPECS* hackathon.

You stand as a central midfielder on a full-size pitch. Your centre-back plays the ball in, defenders run to mark your teammates, and exactly one teammate is left free. The glasses' narrow view hides everyone behind you until you actually turn your head. When the ball arrives, play freezes mid-stride and every player in the drill turns grey: pinch the free man from memory.

- **Demo video:** [`devpost/ShoulderCheck_demo.mp4`](devpost/ShoulderCheck_demo.mp4) (1:47, narrated)
- **Devpost write-up:** [`devpost/submission.md`](devpost/submission.md)
- **Design brief:** [`devpost/design-brief.md`](devpost/design-brief.md)

## Open it

1. Install **Lens Studio 5.24+**.
2. Open `build.esproj`. Lens Studio regenerates `Cache/` and `Support/` on first open.
3. In the Preview panel (Spectacles, Interactive), rounds start automatically. Turn the view with right-drag or Shift, and click a grey player at the freeze to pick.

## Tests

8 LEAF scenarios in `Assets/Tests/` cover every done criterion in the brief: scan counting, the freeze, all four outcomes, hidden players, and the result panel following your head. Open the LEAF panel in Lens Studio and run them in the preview. The `demo-reel` scenario plays the scripted session used for the video.

## Layout

| Path | What |
|---|---|
| `Assets/Scripts/ShoulderCheck*.ts` | Drill logic, pitch, players, animation, notifications |
| `Assets/Models/FootballerPoses.glb` | Baked poses: ready stance, 12-frame run cycle, 3-frame kick |
| `Assets/Textures/Kits/` | Palette kit textures (shirt, shorts, socks, boots, skin, hair) |
| `Assets/Tests/` | LEAF test scenarios + demo reel |
| `blender/footballer.blend` | Source model, rig and poses (Blender 5.2) |
| `devpost/` | Video, write-up, brief, and the caption/narration scripts used to build the video |
| `Packages/` | Spectacles Interaction Kit, UI Kit, LEAF |

## Status

Logic is proven in the Lens Studio preview (8/8 LEAF tests pass). The feel on real glasses (comfort, readability at 25 m, frame rate) has not been tested yet: no device was available.
