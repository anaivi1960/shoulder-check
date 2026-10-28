---
status: approved
---

# Design brief: Shoulder Check (working title, default)

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I'm alone on an empty pitch, standing as a central midfielder, side-on and half-turned, waiting for a pass from my centre-back. Life-size ghost players stand around me on the grass, some behind me where I can only see them if I turn my head. Before the ball arrives I flick my head over my left shoulder, then my right, then back to the front. When the ball reaches me everything freezes into identical grey silhouettes, and I have to pinch the one that was my free teammate from memory. By round five I'm checking my shoulders before the ball is even played, without thinking about it, and when it freezes I already know the answer before I pinch.

## Why it belongs on glasses
- Uses: draws in the world (life-size players on the pitch at real distances), leaves your body free (feet planted, head does the work, eyes up).
- Why it's better than the phone or laptop version: the skill is physically turning your head to check your shoulders. A screen shows you everything at once. The glasses' narrow view hides anything behind you until you actually turn, which is exactly what a real pitch does. It builds the habit coaches keep shouting for.

## Product or overlay
- Type: product. The ghost players, ball and game are the experience.
- What the real version would sense: head direction only (no recognition). On real glasses the ghosts stand on your real pitch, back garden or five-a-side cage.
- Stand-in for the preview: a virtual grass pitch under the players, since the preview can't see a real pitch. Head turns come from mouse-look in the preview.

## Where things live
Clock positions are relative to the way the player faces at the start of each round (12 o'clock = straight ahead, toward the passer). All players are about 1.8 m tall, standing on the grass.

- Where the user is looking during the main task: forward at the passer and the incoming ball, with quick head turns over each shoulder. After the freeze, wherever the silhouette they're looking for is (often behind them).
- The pitch: virtual grass plane, at least 60 m x 60 m (default), centred on the player at floor level.
- The player (me): central midfield, just inside my own half near the centre circle. Feet stay mostly planted.

| # | Who | Colour | Where | Distance | Why it's there |
|---|---|---|---|---|---|
| 1 | Passer (my centre-back) | Blue | 12 o'clock | 15 m in front | Starts each round. The only player I can see without turning |
| 2 | Opponent striker | Red | 11 o'clock | 8 m, between me and the passer | Real-looking pressure in front |
| 3 | Presser (opponent) | Red | 5 o'clock, behind right | 3 m (closest) | Closes in while I'm facing the ball. If I don't check, I turn into him |
| 4 | Left winger (teammate) | Blue | 9 o'clock | 12 m | Wide option. Visible only on a hard left check |
| 5 | Right winger (teammate) | Blue | 3 o'clock | 12 m | Wide option. Visible only on a hard right check |
| 6 | Striker (teammate) | Blue | 6 o'clock, behind me | 25 m (furthest) | The forward pass if I can turn |
| 7 | Opponent midfielder | Red | 7 o'clock | 6 m | Shadows the left side |
| 8 | Opponent full-back | Red | 2 o'clock | 10 m | Drifts to mark the right winger |

- Players are translucent: teammates blue, opponents red. They're shapes and colours only, with no text labels on the pitch (unreadable at 12 to 25 m).
- Far players get a strong outline or ground ring so they register on a quick glance. A 1.8 m figure at 25 m is only about 4° tall.
- Ball: life-size football (about 22 cm, default), rolling along the ground from the passer to my feet in about 1.5 to 2 s at 15 m.
- Level + scan count strip ("Level 3 · Scans: 2"): small and dim, 1 m away, about 15° below eye level, centred.
- Result panel: 1 m away, about 10° below eye level. It follows my head with a lag, gliding into view about 0.3 s after I stop turning. It never snaps. Top line is the result, large. Under it is the readout, smaller, 2 to 3 lines maximum.
- Panel style: bold, larger-than-expected white text with a subtle outline, so it carries itself on the additive display. A very faint light backing (low-opacity grey-blue) groups the lines as a soft glow. If it looks muddy in testing, drop it and use text only. The ✔/✘ icon alone is green, or amber/red.
- On-pitch feedback: green ring on the free man, amber or red flash on my pick, a short line from a marker to the man they were marking, and a ghost pass line from me to the free man.

## Hands and input
- Answer at the freeze: pinch one grey silhouette (in the preview, click it). No pinching spots on the grass.
- All 8 silhouettes look identical: same grey, same height, no shirt colours, no numbers.
- Targets are big (the whole silhouette) and get a thin outline highlight when the pointer or gaze is on them.
- Head turns (scans) are the main input during live play. No hand action is needed until the freeze.
- Voice: none.

### What counts as one scan
- My head turns at least 60° away from the ball (the passer direction) and comes back toward it within 1.5 s.
  - 60° because the glasses show about 18° either side of centre, so at 60° the edge of view reaches about 78°, enough to catch a player at 3 or 9 o'clock.
  - If the turn is held longer than 1.5 s, it isn't counted.
- Only counts during the pass window: from the passer shaping up to the ball reaching me. Turns between rounds don't count.
- No double counting: my head must come back within 30° of the ball before the next turn counts.
- Either side counts. The readout splits them, e.g. "Scans: 3 (L1 · R2)".
- The Lens also records which players were inside the central view window during the pass window. That allows result lines like "You never looked at the left winger."

## When things show

### One round
1. **Between rounds:** the level strip shows. It hides once the passer shapes to pass.
2. **Pass window (live play):** no text at all. The passer plays the ball. While it travels, 2 or 3 players shift: for example the full-back steps onto the right winger and leaves the left winger free, or the presser commits and opens the turn toward the striker. Exactly one teammate is unmarked at the freeze, and which one changes every round.
3. **Freeze:** the instant the ball reaches me, everything stops and every player turns into an identical grey silhouette within one frame. The freeze doesn't stop the clock: a pick timer starts (4 s in the preview, 3 s on real glasses).
4. **Outcome:** colours return.

| Outcome | What I see | Result line |
|---|---|---|
| Right teammate | Silhouette turns into a solid blue teammate with a green ring, and a ghost pass line runs from me to them | ✔ "Free man found", plus scan stats |
| Wrong teammate (marked) | Mine flashes amber, and the opponent marking them is highlighted with a short line between the two. The real free man gets the green ring | ✘ "He was marked by the full-back" (names the actual marker) |
| An opponent | Mine flashes red. The real free man gets the green ring | ✘ "That's an opponent" (the worst outcome) |
| Nothing in time | The presser (3 m behind me) steps in and the ball drops at my feet. The free man is ringed | ✘ "Lost the ball, too slow" |

5. **Replay + readout:** every result ends with a 2 to 3 s replay showing the free man ringed. The result panel glides into view with the readout: "Scans before the ball: 2 · Last check: 0.6 s before reception · Decision: 1.4 s".
6. **Next round** starts automatically. The panel fades out as it starts, and the level strip fades in. The panel is fully gone before the passer shapes to pass. At 1 m it would otherwise block the passer.

### Levels
- Level 1 starts with five players: the passer, the presser, both wingers and the opponent full-back. The full-back marks one winger, chosen at random each round, so the free man switches sides and can't be learned by rote. There is always exactly one right answer.
- Players are added one per level after that:
  - Level 2 adds the opponent midfielder, who can also pick up a winger.
  - Level 3 adds the striker (teammate), a new free-man candidate behind me.
  - Level 4 adds the opponent striker.
- Each level speeds the pass about 10% (default), with a floor: the pass never arrives in less than 1.0 s (about 15 m/s over 15 m, a firm pass). Anything faster leaves time for only one scan. Once all 8 players are on, further levels only push the pace toward that floor.
- Two correct answers move up a level (default).
- Two wrong answers in a row drop me back a level. One mistake never ends the session.

- If something needs attention out of view: deliberately no arrow or hint during live play. Finding out-of-view players by turning is the skill being trained. A soft pass sound when the ball is struck (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. **Scan counting:** during a pass, turning more than 60° left and back within 1.5 s adds exactly one scan to the readout. A 40° turn adds nothing, and holding a 90° turn for 3 s adds nothing.
2. **The freeze:** when the ball reaches me, every player turns into an identical grey silhouette within one frame and the 4 s pick timer starts.
3. **The four outcomes:** clicking the free teammate shows the green ring and "✔ Free man found". Clicking a marked teammate shows the amber flash plus the marker line. Clicking an opponent shows the red flash. Not clicking for 4 s makes the presser step in with "Lost the ball, too slow".
4. **Hidden players stay hidden:** facing straight at the passer, I can't see the left winger, right winger or striker inside the glasses-view frame (the 37° x 32° outline shown in the preview). I only see them by turning.
5. **The panel follows my head:** after clicking a silhouette behind me, the result panel glides into view about 1 m ahead and slightly below eye level. It's fully gone before the next passer shapes to pass.

## Out of scope
- Kicking, dribbling or touching the ball. The round ends at reception.
- Recognizing a real pitch, real players, cones or a real ball.
- Saving levels or scan history between sessions.
- Multiple real players sharing one session.
- Text labels on the ghost players.

## Risks and open questions
- **Scan counting with mouse-look (the riskiest check):** mouse-look may turn faster or slower than a real head. LEAF tests should feed exact yaw values (60°, 40°, a 3 s hold) instead of relying on dragging by hand. If LEAF can't set camera yaw directly, CLAD may need a small test hook that feeds head yaw into the scan counter.
- **Pick timer in the preview:** 4 s in the preview, 3 s on real glasses. Reaching a silhouette behind you with mouse-look may still feel tight. Tune in testing.
- **Hidden players in the preview:** the preview camera may show a wider view than the glasses' roughly 37° x 32° window. Mitigation: add a glasses-view frame to the preview, an outline or mask of the 37° x 32° window, so done criterion 4 tests what the glasses actually show, not the wider preview window.
- **Faint panel backing:** may look muddy on the additive display. Fall back to text only.
- **Feel unproven:** quick real head checks, comfort over a long session, and how readable 25 m figures are on real glasses.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
