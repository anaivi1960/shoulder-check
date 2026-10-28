/**
 * ShoulderCheckMain — orchestrates the Shoulder Check scanning drill.
 *
 * Owns: the round loop (between -> shaping -> pass -> freeze -> outcome -> replay -> result),
 * scan counting (via ScanCounter), the "seen in the view window" record, level progression,
 * outcome feedback, audio, and the global test hook `global.shoulderCheck` (feed exact head
 * yaw, pick a player, read state). Player/ball movement lives in ShoulderCheckRoundMotion and
 * the result wording in ShoulderCheckResultText.
 *
 * Size note: about a fifth of this file is the tunable @input block (pace, scan rules, timing,
 * colours), kept here so every design knob from the brief sits on one Inspector component.
 *
 * Expects @inputs (wired by the bootstrap): 8 ShoulderCheckPlayerFigure components, the two
 * UI modules, the Pitch root, the Ball and Feedback SceneObjects.
 *
 * Must NOT: author UI text/components (UI modules do), or create semantic scene roots
 * (players/pitch/ball/feedback/UI are authored in the scene).
 */
import {Feedback} from "./ShoulderCheckFeedback"
import {HeadTracker} from "./ShoulderCheckHeadTracker"
import {LevelProgress, planRound, passDuration, Role, ROLE_INFO, RoundPlan} from "./ShoulderCheckLevels"
import {ShoulderCheckLevelStripUI} from "./ShoulderCheckLevelStripUI"
import {BodyStyle, bodyScale} from "./ShoulderCheckBody"
import {Extras} from "./ShoulderCheckExtras"
import {ShoulderCheckPlayerFigure, FigureShared} from "./ShoulderCheckPlayerFigure"
import {PlayerTags, TagSpec} from "./ShoulderCheckPlayerTags"
import {PALETTE} from "./ShoulderCheckUIStyle"
import {addVisual, buildFigure, buildRing, buildSphere, buildUnitStrip, makeMaterial} from "./ShoulderCheckProcMesh"
import {ShoulderCheckResultPanelUI} from "./ShoulderCheckResultPanelUI"
import {composeResult, OutcomeKind} from "./ShoulderCheckResultText"
import {BALL_RADIUS_CM, RoundMotion, smooth, toward} from "./ShoulderCheckRoundMotion"
import {ScanCounter} from "./ShoulderCheckScanCounter"

const BASE_MAT = requireAsset("../Materials/ShoulderCheckGhost.mat") as Material
const SFX_PASS = requireAsset("../GeneratedSFX/PassKick.wav") as AudioTrackAsset
const SFX_GOOD = requireAsset("../GeneratedSFX/ResultGood.wav") as AudioTrackAsset
const SFX_BAD = requireAsset("../GeneratedSFX/ResultBad.wav") as AudioTrackAsset
const PLAYER_MAT = requireAsset("../Materials/ShoulderCheckPlayer.mat") as Material
// Palette kits (shirt, shorts, socks, boots, skin, hair) in three skin/hair variants per team.
// requireAsset needs literal paths (resolved at build time).
const KITS_BLUE = [
  requireAsset("../Textures/Kits/SC_Kit_blue_0.png") as Texture,
  requireAsset("../Textures/Kits/SC_Kit_blue_1.png") as Texture,
  requireAsset("../Textures/Kits/SC_Kit_blue_2.png") as Texture,
]
const KITS_RED = [
  requireAsset("../Textures/Kits/SC_Kit_red_0.png") as Texture,
  requireAsset("../Textures/Kits/SC_Kit_red_1.png") as Texture,
  requireAsset("../Textures/Kits/SC_Kit_red_2.png") as Texture,
]
const KIT_GREY = requireAsset("../Textures/Kits/SC_Kit_grey.png") as Texture
const KIT_GK_BLUE = requireAsset("../Textures/Kits/SC_Kit_gkblue_0.png") as Texture
const KIT_GK_RED = requireAsset("../Textures/Kits/SC_Kit_gkred_0.png") as Texture

type Phase = "idle" | "between" | "shaping" | "pass" | "frozen" | "outcome" | "replay" | "result"

@component
export class ShoulderCheckMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ShoulderCheckMain – scanning drill orchestrator</span>')
  @ui.separator

  // ── References ──────────────────────────────────
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input @hint("Passer (centre-back), 12 o'clock") passer!: ShoulderCheckPlayerFigure
  @input @hint("Opponent striker, 11 o'clock") oppStriker!: ShoulderCheckPlayerFigure
  @input @hint("Presser (opponent), 5 o'clock") presser!: ShoulderCheckPlayerFigure
  @input @hint("Left winger (teammate), 9 o'clock") leftWinger!: ShoulderCheckPlayerFigure
  @input @hint("Right winger (teammate), 3 o'clock") rightWinger!: ShoulderCheckPlayerFigure
  @input @hint("Striker (teammate), 6 o'clock") striker!: ShoulderCheckPlayerFigure
  @input @hint("Opponent midfielder, 7 o'clock") oppMidfielder!: ShoulderCheckPlayerFigure
  @input @hint("Opponent full-back, 2 o'clock") fullBack!: ShoulderCheckPlayerFigure
  @input @hint("Level + scan strip UI module") levelStrip!: ShoulderCheckLevelStripUI
  @input @hint("Result panel UI module") resultPanel!: ShoulderCheckResultPanelUI
  @input @hint("Pitch root (floor level, centred on the receiver). Players, Ball and Feedback live under it.") pitchRoot!: SceneObject
  @input @hint("Ball SceneObject (child of the Pitch root); the ball visual is built under it.") ball!: SceneObject
  @input @hint("Feedback SceneObject (child of the Pitch root); rings and lines are built under it.") feedbackRoot!: SceneObject
  @ui.group_end

  // ── Players' look ───────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Players\' look</span>')
  @ui.group_start("Players' look")
  @input @hint("Footballer ready-stance mesh (Footballer_idle in Assets/Models/FootballerPoses.glb, built in Blender). Empty = old ghost figures.") @allowUndefined footballerMesh: RenderMesh
  @input @hint("Run cycle frames in order (Footballer_run_00..11). Empty = players glide.") @allowUndefined runPoses: RenderMesh[]
  @input @hint("Kick frames: wind-up, strike, follow-through (Footballer_kick_0..2). Played by the passer.") @allowUndefined kickPoses: RenderMesh[]
  @input @hint("Fill the pitch to 22 with background players (never pickable, keep their kits at the freeze).") showExtras: boolean = true
  @ui.group_end

  // ── Pace & levels ───────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Pace and levels</span>')
  @ui.group_start("Pace and levels")
  @input @hint("Ball travel time at level 1, s (brief: 1.5-2 s over 15 m).") @widget(new SliderWidget(1, 3, 0.05)) basePassSec: number = 2.0
  @input @hint("Pass gets this fraction faster each level (0.1 = 10%).") @widget(new SliderWidget(0, 0.3, 0.01)) speedupPerLevel: number = 0.1
  @input @hint("Fastest allowed pass, s (brief floor: 1.0 s).") @widget(new SliderWidget(0.6, 2, 0.05)) minPassSec: number = 1.0
  @input @hint("Correct answers needed to move up a level.") @widget(new SliderWidget(1, 5, 1)) correctToLevelUp: number = 2
  @input @hint("Wrong answers in a row that drop you a level.") @widget(new SliderWidget(1, 5, 1)) wrongInRowToLevelDown: number = 2
  @input @hint("Pick timer in the Lens Studio preview, s.") @widget(new SliderWidget(1, 10, 0.5)) pickTimeEditorSec: number = 4
  @input @hint("Pick timer on real glasses, s.") @widget(new SliderWidget(1, 10, 0.5)) pickTimeDeviceSec: number = 3
  @ui.group_end

  // ── Scan rules ──────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scan rules</span>')
  @ui.group_start("Scan rules")
  @input @hint("Head must turn at least this far from the ball for a scan, deg.") @widget(new SliderWidget(30, 120, 1)) scanMinYawDeg: number = 60
  @input @hint("Head must come back within this angle of the ball (also re-arms the next scan), deg.") @widget(new SliderWidget(5, 50, 1)) scanReturnDeg: number = 30
  @input @hint("Turns held longer than this (from crossing the min angle to coming back) don't count, s.") @widget(new SliderWidget(0.5, 4, 0.1)) scanMaxHoldSec: number = 1.5
  @input @hint("Half-width of the central view window used for 'did you look at him', deg.") @widget(new SliderWidget(5, 40, 0.5)) viewHalfWidthDeg: number = 18.5
  @input @hint("Half-height of the central view window, deg.") @widget(new SliderWidget(5, 40, 0.5)) viewHalfHeightDeg: number = 16
  @ui.group_end

  // ── Round timing & movement ─────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Round timing and movement</span>')
  @ui.group_start("Round timing and movement")
  @input @hint("Pause between rounds with the level strip showing, s.") @widget(new SliderWidget(0.5, 6, 0.1)) betweenRoundsSec: number = 2.0
  @input @hint("Passer shapes to pass for this long before striking the ball, s (scan window opens here).") @widget(new SliderWidget(0.2, 2, 0.05)) shapingSec: number = 0.6
  @input @hint("Outcome feedback hold before the replay, s.") @widget(new SliderWidget(0.3, 4, 0.1)) outcomeHoldSec: number = 1.2
  @input @hint("Replay length (free man ringed), s.") @widget(new SliderWidget(1, 4, 0.1)) replaySec: number = 2.5
  @input @hint("Result stays up this long after the replay, s.") @widget(new SliderWidget(0.5, 6, 0.1)) resultHoldSec: number = 1.5
  @input @hint("How close a marker ends up to his man, goal-side, cm.") @widget(new SliderWidget(50, 400, 10)) markGapCm: number = 150
  @input @hint("Fraction of the way a marker already is at round start (0 = at home, 1 = already marking).") @widget(new SliderWidget(0, 1, 0.05)) markerHeadStart: number = 0.5
  @input @hint("When not marking, the presser closes to this distance behind you, cm.") @widget(new SliderWidget(60, 300, 10)) presserCloseCm: number = 160
  @input @hint("Free man steps wider to show for the ball, cm.") @widget(new SliderWidget(0, 400, 10)) freeManShowCm: number = 120
  @ui.group_end

  // ── Colours ─────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Colours</span>')
  @ui.group_start("Colours")
  @input("vec4", "{0.3,0.6,1,0.6}") @hint("Teammates (translucent blue).") @widget(new ColorWidget()) teammateColor: vec4
  @input("vec4", "{1,0.3,0.25,0.6}") @hint("Opponents (translucent red).") @widget(new ColorWidget()) opponentColor: vec4
  @input("vec4", "{0.72,0.72,0.75,0.6}") @hint("Identical grey silhouette at the freeze.") @widget(new ColorWidget()) silhouetteColor: vec4
  @input("vec4", "{1,1,1,0.85}") @hint("Thin hover outline on the silhouette under the pointer.") @widget(new ColorWidget()) hoverColor: vec4
  @input("vec4", "{0.35,0.65,1,0.95}") @hint("Solid blue on the free man when found.") @widget(new ColorWidget()) foundColor: vec4
  @input("vec4", "{1,0.72,0.15,0.9}") @hint("Amber flash for a marked teammate.") @widget(new ColorWidget()) amberColor: vec4
  @input("vec4", "{1,0.2,0.15,0.95}") @hint("Red flash for an opponent pick / marker highlight.") @widget(new ColorWidget()) redColor: vec4
  @input("vec4", "{0.3,1,0.4,0.9}") @hint("Green ring on the free man.") @widget(new ColorWidget()) freeRingColor: vec4
  @input("vec4", "{1,0.45,0.35,0.85}") @hint("Line from a marker to the man he marks.") @widget(new ColorWidget()) markerLineColor: vec4
  @input("vec4", "{0.75,0.95,1,0.55}") @hint("Ghost pass line from you to the free man.") @widget(new ColorWidget()) passLineColor: vec4
  @input("vec4", "{0.95,0.95,0.95,1}") @hint("Ball colour.") @widget(new ColorWidget()) ballColor: vec4
  @input @hint("Ground ring radius at 0 m, cm.") @widget(new SliderWidget(20, 120, 1)) ringBaseRadiusCm: number = 45
  @input @hint("Ground ring grows this much per metre of distance, cm (far players read on a glance).") @widget(new SliderWidget(0, 6, 0.1)) ringGrowthPerMeterCm: number = 2.2
  @ui.group_end

  // ── Audio ───────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Audio</span>')
  @ui.group_start("Audio")
  @input @hint("Volume of the soft pass sound.") @widget(new SliderWidget(0, 1, 0.05)) passVolume: number = 0.8
  @input @hint("Volume of the result chimes.") @widget(new SliderWidget(0, 1, 0.05)) resultVolume: number = 0.6
  @ui.group_end

  // ── Debug ───────────────────────────────────────
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input @hint("Run the scan-counter self-test at start and print PASS/FAIL to the log.") runScanSelfTest: boolean = true
  @input @hint("Print round events (freeze, picks, scans, outcomes) to the log.") logEvents: boolean = true
  @input @hint("Wireframe the pick colliders (takes effect on preview restart).") debugColliders: boolean = false
  @input @hint("Start rounds automatically. Off = wait for global.shoulderCheck.start().") autoStart: boolean = true
  @ui.group_end

  private extras: Extras | null = null
  private tags!: PlayerTags
  private figs: ShoulderCheckPlayerFigure[] = []
  private byRole = new Map<Role, ShoulderCheckPlayerFigure>()
  private head!: HeadTracker
  private scans!: ScanCounter
  private progress!: LevelProgress
  private feedback!: Feedback
  private motion!: RoundMotion
  private audioPass!: AudioComponent
  private audioGood!: AudioComponent
  private audioBad!: AudioComponent

  private phase: Phase = "idle"
  private phaseStart = 0
  private plan: RoundPlan | null = null
  private passSec = 2
  private meLocal = vec3.zero()
  private freezeTime = 0
  private pickTimeSec = 4
  private seen = new Set<Role>()
  private outcome: OutcomeKind | null = null
  private picked: ShoulderCheckPlayerFigure | null = null
  private markerOfPicked: ShoulderCheckPlayerFigure | null = null
  private decisionSec = -1
  private flashColor: vec4 | null = null
  private lastRoundScans = 0
  private presserStepFrom = vec3.zero()
  private presserStepTo = vec3.zero()
  private lastResultTitle = ""
  private roundIndex = 0

  onAwake(): void {
    const req: [string, unknown][] = [
      ["passer", this.passer], ["oppStriker", this.oppStriker], ["presser", this.presser],
      ["leftWinger", this.leftWinger], ["rightWinger", this.rightWinger], ["striker", this.striker],
      ["oppMidfielder", this.oppMidfielder], ["fullBack", this.fullBack], ["levelStrip", this.levelStrip],
      ["resultPanel", this.resultPanel], ["pitchRoot", this.pitchRoot], ["ball", this.ball], ["feedbackRoot", this.feedbackRoot],
    ]
    const missing = req.filter((r) => !r[1]).map((r) => r[0])
    if (missing.length > 0) {
      print("[ShoulderCheck] ERROR: @input not wired: " + missing.join(", "))
      return
    }
    this.scans = new ScanCounter({minYawDeg: this.scanMinYawDeg, returnDeg: this.scanReturnDeg, maxHoldSec: this.scanMaxHoldSec})
    this.progress = new LevelProgress({correctToLevelUp: this.correctToLevelUp, wrongInRowToLevelDown: this.wrongInRowToLevelDown})
    this.pickTimeSec = global.deviceInfoSystem.isEditor() ? this.pickTimeEditorSec : this.pickTimeDeviceSec

    this.audioPass = this.makeAudio("PassSfx", SFX_PASS, this.passVolume)
    this.audioGood = this.makeAudio("GoodSfx", SFX_GOOD, this.resultVolume)
    this.audioBad = this.makeAudio("BadSfx", SFX_BAD, this.resultVolume)

    if (this.runScanSelfTest) {
      const r = ScanCounter.runSelfTest({minYawDeg: this.scanMinYawDeg, returnDeg: this.scanReturnDeg, maxHoldSec: this.scanMaxHoldSec})
      for (const l of r.lines) print("[ShoulderCheck] SCAN SELFTEST " + l)
      print("[ShoulderCheck] SCAN SELFTEST " + (r.allPassed ? "ALL PASS" : "SOME FAILED"))
    }

    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    this.head = new HeadTracker()
    this.figs = [this.passer, this.oppStriker, this.presser, this.leftWinger, this.rightWinger, this.striker, this.oppMidfielder, this.fullBack]
    const figureMesh = buildFigure(180)
    const ringMesh = buildRing(0.78, 1.0, 48)
    const body: BodyStyle | null = this.footballerMesh
      ? {
          mesh: this.footballerMesh, run: (this.runPoses || []).filter((m) => !!m), kick: (this.kickPoses || []).filter((m) => !!m),
          material: PLAYER_MAT, greyKit: KIT_GREY, scale: bodyScale(this.footballerMesh, 180),
        }
      : null
    let blueKit = 0
    let redKit = 0
    for (const f of this.figs) {
      const team = ROLE_INFO[f.roleId] ? ROLE_INFO[f.roleId].teammate : false
      if (!ROLE_INFO[f.roleId]) print("[ShoulderCheck] ERROR: unknown role '" + f.role + "' on " + f.getSceneObject().name)
      const kit = team ? KITS_BLUE[blueKit++ % KITS_BLUE.length] : KITS_RED[redKit++ % KITS_RED.length]
      const shared: FigureShared = {
        baseMaterial: BASE_MAT, figureMesh, ringMesh, body, kit,
        teamColor: team ? this.teammateColor : this.opponentColor,
        silhouetteColor: this.silhouetteColor, hoverColor: this.hoverColor,
        ringBaseRadiusCm: this.ringBaseRadiusCm, ringGrowthPerMeterCm: this.ringGrowthPerMeterCm,
        proxyDistanceCm: 450, proxyPadding: 1.0,
      }
      f.build(shared)
      this.byRole.set(f.roleId, f)
      f.onPicked.add((p) => this.onPick(p))
    }
    if (body && this.showExtras) {
      this.extras = new Extras(this.pitchRoot, body, {
        teammate: KITS_BLUE, opponent: KITS_RED, teammateKeeper: KIT_GK_BLUE, opponentKeeper: KIT_GK_RED,
      })
    }
    this.log("PLAYERS body=" + (body ? "footballer x" + body.scale.toFixed(2) + " run=" + body.run.length + " kick=" + body.kick.length : "ghost") +
      " extras=" + (this.extras ? this.extras.count : 0))
    const ballVisual = addVisual(this.ball, "BallMesh", buildSphere(BALL_RADIUS_CM), makeMaterial(BASE_MAT, this.ballColor, false))
    ballVisual.getTransform().setLocalPosition(new vec3(0, BALL_RADIUS_CM, 0))
    this.motion = new RoundMotion(this.ball, ballVisual)
    this.feedback = new Feedback(this.feedbackRoot, {
      baseMaterial: BASE_MAT, ringMesh: buildRing(0.8, 1.0, 64), stripMesh: buildUnitStrip(),
      freeRingColor: this.freeRingColor, markerLineColor: this.markerLineColor, passLineColor: this.passLineColor, lineWidthCm: 14,
    })
    this.tags = new PlayerTags(this.getSceneObject())
    if (this.debugColliders) this.setColliderDebugAll(this.pitchRoot, true)
    this.installTestHook()
    if (this.autoStart) this.enterBetween()
  }

  // ── Round flow ──────────────────────────────────

  private setPhase(p: Phase): void {
    this.phase = p
    this.phaseStart = getTime()
  }

  private log(msg: string): void {
    if (this.logEvents) print("[ShoulderCheck] " + msg)
  }

  private activeRoles(): Role[] {
    const lvl = this.progress.level
    return this.figs.filter((f) => f.minLevel <= lvl).map((f) => f.roleId)
  }

  private enterBetween(): void {
    this.roundIndex++
    this.feedback.hideAll()
    this.resultPanel.hide()
    this.tags.hideAll()
    const active = this.activeRoles()
    for (const f of this.figs) {
      f.setActive(active.indexOf(f.roleId) >= 0)
      f.setSilhouette(false)
      f.setTint(null)
      f.setPickable(false)
      f.setRingVisible(true)
    }
    this.updateMe()
    this.plan = planRound(active)
    this.passSec = passDuration(this.progress.level, {basePassSec: this.basePassSec, speedupPerLevel: this.speedupPerLevel, minPassSec: this.minPassSec})
    this.motion.build(this.plan, this.figs, this.byRole, this.meLocal,
      {markGapCm: this.markGapCm, markerHeadStart: this.markerHeadStart, presserCloseCm: this.presserCloseCm, freeManShowCm: this.freeManShowCm})
    this.motion.applyMoves(0)
    this.placeBall(0)
    for (const f of this.figs) {
      f.resetMotion()
      f.setKickFrame(-1)
    }
    this.levelStrip.setStatus(this.progress.level, this.lastRoundScans)
    this.levelStrip.show()
    this.ball.enabled = true
    this.log("ROUND " + this.roundIndex + " level=" + this.progress.level + " free=" + (this.plan ? this.plan.free : "none") +
      " marks=" + (this.plan ? this.plan.marks.map((m) => m.marker + "->" + m.marked).join(",") : "") + " passSec=" + this.passSec.toFixed(2))
    this.setPhase("between")
  }

  private updateMe(): void {
    const inv = this.pitchRoot.getTransform().getInvertedWorldTransform()
    const e = inv.multiplyPoint(this.head.eyeWorld)
    this.meLocal = new vec3(e.x, 0, e.z)
  }

  private placeBall(u: number): void {
    this.motion.placeBall(u, this.passer.home, this.meLocal)
  }

  private startShaping(): void {
    this.levelStrip.hide()
    this.scans.setConfig({minYawDeg: this.scanMinYawDeg, returnDeg: this.scanReturnDeg, maxHoldSec: this.scanMaxHoldSec})
    this.scans.beginWindow(getTime())
    this.seen.clear()
    this.log("SHAPING pass window open")
    this.setPhase("shaping")
  }

  private strikeBall(): void {
    this.audioPass.play(1)
    this.log("PASS struck, travel " + this.passSec.toFixed(2) + " s")
    this.setPhase("pass")
  }

  private freeze(): void {
    this.scans.endWindow()
    this.freezeTime = getTime()
    // Every player becomes an identical grey silhouette in this same frame.
    for (const f of this.figs) {
      if (!f.isActive) continue
      f.setTint(null)
      f.setSilhouette(true)
      f.setPickable(true)
    }
    this.passer.setLocalPos(this.passer.home)
    this.log("FREEZE silhouettes=grey pickTimer=" + this.pickTimeSec + "s scans=" + this.scans.total +
      " (L" + this.scans.left + " R" + this.scans.right + ") seen=" + Array.from(this.seen).join(",") +
      " poses=" + this.figs.filter((f) => f.isActive).map((f) => f.roleId + ":" + f.poseName).join(","))
    this.setPhase("frozen")
  }

  private onPick(f: ShoulderCheckPlayerFigure): void {
    if (this.phase !== "frozen" || !this.plan) return
    this.decisionSec = getTime() - this.freezeTime
    this.picked = f
    const role = f.roleId
    if (role === this.plan.free) this.resolve("correct")
    else if (ROLE_INFO[role].teammate) this.resolve("markedTeammate")
    else this.resolve("opponent")
  }

  private resolve(kind: OutcomeKind): void {
    if (!this.plan) return
    this.outcome = kind
    this.lastRoundScans = this.scans.total
    for (const f of this.figs) {
      f.setPickable(false)
      f.setSilhouette(false)
      f.setTint(null)
    }
    const free = this.byRole.get(this.plan.free) as ShoulderCheckPlayerFigure
    this.markerOfPicked = null
    this.flashColor = null
    if (kind === "correct") {
      free.setTint(this.foundColor)
    } else if (kind === "markedTeammate" && this.picked) {
      this.flashColor = this.amberColor
      const pair = this.plan.marks.find((m) => m.marked === this.picked!.roleId)
      if (pair) this.markerOfPicked = this.byRole.get(pair.marker) || null
      if (this.markerOfPicked) this.markerOfPicked.setTint(this.redColor)
    } else if (kind === "opponent") {
      this.flashColor = this.redColor
    } else if (kind === "tooSlow") {
      this.presserStepFrom = this.presser.getLocalPos()
      this.presserStepTo = toward(this.meLocal, this.presser.home, 75)
    }
    this.showOutcomeFeedback()
    const levelChange = this.progress.record(kind === "correct")
    ;(kind === "correct" ? this.audioGood : this.audioBad).play(1)
    const {severity, title, label, tip} = composeResult({
      kind, marker: this.markerOfPicked ? this.markerOfPicked.roleId : null,
      scans: {total: this.scans.total, left: this.scans.left, right: this.scans.right, lastCheckTime: this.scans.lastCheckTime},
      freezeTime: this.freezeTime, decisionSec: this.decisionSec, free: this.plan.free,
      activeRoles: this.activeRoles(), seen: this.seen,
    })
    this.lastResultTitle = title
    this.resultPanel.showResult(severity, title, label, tip)
    this.tags.show(this.tagsFor(kind, free))
    this.log("OUTCOME " + kind + " picked=" + (this.picked ? this.picked.roleId : "none") + " title='" + title + "' decision=" +
      (this.decisionSec >= 0 ? this.decisionSec.toFixed(2) : "-") + " levelChange=" + levelChange + " -> level " + this.progress.level +
      " tags=" + this.tags.labels.join("|") + " card='" + label + " / " + tip + "'")
    this.setPhase("outcome")
  }

  /** Labels pinned on the players the outcome is about (the card only carries the summary). */
  private tagsFor(kind: OutcomeKind, free: ShoulderCheckPlayerFigure): TagSpec[] {
    const tag = (f: ShoulderCheckPlayerFigure, text: string, color: vec4): TagSpec => ({target: f.getSceneObject(), text, color})
    const out: TagSpec[] = []
    if (kind === "markedTeammate" && this.picked) {
      out.push(tag(this.picked, "MARKED", PALETTE.warn))
      if (this.markerOfPicked) out.push(tag(this.markerOfPicked, "MARKER", PALETTE.bad))
    } else if (kind === "opponent" && this.picked) {
      out.push(tag(this.picked, "OPPONENT", PALETTE.bad))
    } else if (kind === "tooSlow") {
      out.push(tag(this.presser, "WON THE BALL", PALETTE.bad))
    }
    out.push(tag(free, "FREE MAN", PALETTE.good))
    return out
  }

  private showOutcomeFeedback(): void {
    if (!this.plan) return
    const free = this.byRole.get(this.plan.free) as ShoulderCheckPlayerFigure
    const fp = free.getLocalPos()
    this.feedback.showFreeRing(fp, fp.sub(this.meLocal).length)
    this.feedback.hideLines()
    if (this.outcome === "correct") this.feedback.showPassLine(this.meLocal, fp)
    if (this.outcome === "markedTeammate" && this.markerOfPicked && this.picked) {
      this.feedback.showMarkerLine(this.markerOfPicked.getLocalPos(), this.picked.getLocalPos())
    }
  }

  private startReplay(): void {
    this.feedback.hideLines()
    for (const f of this.figs) if (f !== this.picked && f !== this.markerOfPicked && (!this.plan || f.roleId !== this.plan.free)) f.setTint(null)
    // The replay is about the free man; a light ball rolling straight up the middle would sit behind the
    // result text (light on light is unreadable, especially on the additive display). Back at round start.
    this.ball.enabled = false
    this.log("REPLAY")
    this.setPhase("replay")
  }

  // ── Per-frame ───────────────────────────────────

  /**
   * Everyone watches the ball (whoever has it at his feet, the passer, looks at you instead)
   * and runs or stands by his own speed. Skipped while frozen, so poses hold mid-stride.
   */
  private animatePlayers(): void {
    const dt = getDeltaTime()
    const b = this.ball.getTransform().getLocalPosition()
    for (const f of this.figs) {
      if (!f.isActive) continue
      f.faceToward(f.getLocalPos().sub(b).length < 150 ? this.meLocal : b, dt)
      f.animate(dt)
    }
    if (this.extras) this.extras.faceToward(b, dt)
  }

  private onUpdate(): void {
    if (!this.head || this.phase === "idle") return
    const now = getTime()
    const t = now - this.phaseStart
    const passerPos = this.passer.getWorldPos().add(new vec3(0, 90, 0))
    const yaw = this.head.yawFrom(passerPos)
    if (this.scans.feed(yaw, now)) {
      this.log("SCAN counted total=" + this.scans.total + " (L" + this.scans.left + " R" + this.scans.right + ") yaw=" + yaw.toFixed(1))
    }
    if (this.phase === "shaping" || this.phase === "pass") this.recordSeen(passerPos)
    if (this.phase !== "frozen") this.animatePlayers()
    this.tags.update(this.head.eyeWorld, getDeltaTime())

    switch (this.phase) {
      case "between":
        if (t >= this.betweenRoundsSec) this.startShaping()
        break
      case "shaping": {
        // Passer shapes: small step back then forward into the strike.
        const k = Math.sin(Math.min(1, t / this.shapingSec) * Math.PI)
        this.passer.setLocalPos(this.passer.home.add(new vec3(0, 0, -25 * k)))
        // Kick: wind-up, then the strike pose as the foot meets the ball.
        this.passer.setKickFrame(t < this.shapingSec * 0.7 ? 0 : 1)
        if (t >= this.shapingSec) this.strikeBall()
        break
      }
      case "pass": {
        // Follow-through just after the strike, then back to standing.
        this.passer.setKickFrame(t < 0.35 ? 2 : -1)
        const u = Math.min(1, t / this.passSec)
        this.placeBall(u)
        this.motion.applyMoves(u)
        if (u >= 1) this.freeze()
        break
      }
      case "frozen": {
        const eye = this.head.eyeWorld
        for (const f of this.figs) if (f.isActive) f.updateProxy(eye)
        if (t >= this.pickTimeSec) {
          this.picked = null
          this.decisionSec = -1
          this.resolve("tooSlow")
        }
        break
      }
      case "outcome": {
        this.tickFlash(t)
        if (this.outcome === "tooSlow") {
          const k = smooth(t / 0.5)
          this.presser.setLocalPos(vec3.lerp(this.presserStepFrom, this.presserStepTo, k))
          this.motion.dropBall(t)
        }
        if (t >= this.outcomeHoldSec) this.startReplay()
        break
      }
      case "replay": {
        const u = Math.min(1, t / this.replaySec)
        this.motion.applyMoves(u)
        this.placeBall(u)
        if (this.plan) {
          const free = this.byRole.get(this.plan.free) as ShoulderCheckPlayerFigure
          this.feedback.moveFreeRing(free.getLocalPos())
        }
        if (u >= 1) {
          this.showOutcomeFeedback()
          this.setPhase("result")
        }
        break
      }
      case "result":
        if (t >= this.resultHoldSec) this.enterBetween()
        break
    }
  }

  private tickFlash(t: number): void {
    if (!this.picked || !this.flashColor) return
    const flashing = t < 0.9
    const on = flashing ? Math.floor(t * 7) % 2 === 0 : true
    this.picked.setTint(on ? this.flashColor : null)
  }

  private recordSeen(ballTarget: vec3): void {
    for (const f of this.figs) {
      if (!f.isActive || this.seen.has(f.roleId)) continue
      const c = f.getWorldPos().add(new vec3(0, 90, 0))
      if (this.head.inView(c, ballTarget, this.viewHalfWidthDeg, this.viewHalfHeightDeg)) this.seen.add(f.roleId)
    }
  }

  // ── Helpers ─────────────────────────────────────

  private makeAudio(name: string, track: AudioTrackAsset, volume: number): AudioComponent {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.getSceneObject())
    const a = so.createComponent("Component.AudioComponent") as AudioComponent
    a.audioTrack = track
    a.volume = volume
    a.playbackMode = Audio.PlaybackMode.LowLatency
    return a
  }

  private setColliderDebugAll(root: SceneObject, on: boolean): void {
    const cols = root.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const c of cols) c.debugDrawEnabled = on
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebugAll(root.getChild(i), on)
  }

  /** Test hook for LEAF / manual testing: global.shoulderCheck.* */
  private installTestHook(): void {
    const self = this
    ;(global as any).shoulderCheck = {
      setTestYaw(deg: number) {
        self.head.setTestYaw(deg)
      },
      clearTestYaw() {
        self.head.setTestYaw(null)
      },
      start() {
        if (self.phase === "idle") self.enterBetween()
      },
      pick(role: string) {
        const f = self.byRole.get(role as Role)
        if (f) self.onPick(f)
      },
      pickFree() {
        if (self.plan) this.pick(self.plan.free)
      },
      getState() {
        return {
          phase: self.phase,
          level: self.progress.level,
          scans: self.scans.total,
          left: self.scans.left,
          right: self.scans.right,
          free: self.plan ? self.plan.free : null,
          marks: self.plan ? self.plan.marks : [],
          pickTimeSec: self.pickTimeSec,
          passSec: self.passSec,
          lastResult: self.lastResultTitle,
          panelVisible: self.resultPanel.isVisible,
          stripVisible: self.levelStrip.isVisible,
          seen: Array.from(self.seen),
        }
      },
    }
  }
}
