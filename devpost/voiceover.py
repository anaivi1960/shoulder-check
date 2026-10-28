"""Add a narrated voice-over (Microsoft neural TTS via edge-tts) plus the game's own SFX to
ShoulderCheck_demo.mp4. Lines are anchored to the same Lens Studio log beats compose.py uses,
so they land on the right moments. Writes ShoulderCheck_demo_vo.mp4.
"""
import asyncio, glob, os, re, subprocess, sys
from datetime import datetime

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
FF = r"C:\Users\MSI LAPTOP\AppData\Local\Programs\ffmpeg\bin\ffmpeg.exe"
FP = r"C:\Users\MSI LAPTOP\AppData\Local\Programs\ffmpeg\bin\ffprobe.exe"
LOGDIR = r"C:\Users\MSI LAPTOP\AppData\Local\Snap\Lens Studio\logs"
SFX = r"C:\Users\MSI LAPTOP\Desktop\Kam\shoulder-check\build\Assets\GeneratedSFX"
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+4%"
TITLE_SEC = 5.0
END_SEC = 6.0


def wall(ts):
    return datetime.strptime(ts[:15], "%H:%M:%S.%f")


rec0 = wall(open(os.path.join(HERE, "rec_start.txt")).read().strip()[:15])
log = max(glob.glob(os.path.join(LOGDIR, "LensStudioLog-*.txt")), key=os.path.getmtime)
lines = open(log, encoding="utf-8", errors="replace").read().splitlines()
start_idx = max(i for i, l in enumerate(lines) if "RUNS: demo-reel" in l)
runs_t = (wall(re.match(r"I (\d\d:\d\d:\d\d\.\d+)", lines[start_idx]).group(1)) - rec0).total_seconds()
clip_in = runs_t + 1.2

beats = []  # (video time, kind, text)
for l in lines[start_idx:]:
    m = re.match(r"I (\d\d:\d\d:\d\d\.\d+) .*\[SC-DEMO\] t=[\d.]+ (\S+)(.*)$", l)
    if m:
        beats.append((TITLE_SEC + (wall(m.group(1)) - rec0).total_seconds() - clip_in, m.group(2), m.group(3).strip()))
    m2 = re.match(r"I (\d\d:\d\d:\d\d\.\d+) .*\[ShoulderCheck\] (PASS struck|OUTCOME (\w+))", l)
    if m2:
        kind = "SFX_PASS" if m2.group(2).startswith("PASS") else ("SFX_GOOD" if m2.group(3) == "correct" else "SFX_BAD")
        beats.append((TITLE_SEC + (wall(m2.group(1)) - rec0).total_seconds() - clip_in, kind, ""))
beats.sort()
end_beat = [t for t, k, _ in beats if k == "END"][0]
gameplay_end = end_beat + 2.0
total = gameplay_end + END_SEC


def nth(kind, n):
    return [t for t, k, _ in beats if k == kind][n - 1]


# (start time in video seconds, line)
SCRIPT = [
    (0.6, "Shoulder Check. A scanning trainer for Spectacles."),
    (nth("ROUND", 1) + 0.3, "The best midfielders check their shoulders before the ball arrives. This time, I don't. Eyes locked on the ball..."),
    (nth("OUTCOME", 1) + 0.4, "Too slow. The presser takes it, and one short card tells me who I never looked at."),
    # Head turns land ~0.6 s and ~1.4 s after the round beat; start early so the words match them.
    (nth("ROUND", 2) - 0.5, "Round two. Check left. Check right."),
    (nth("OUTCOME", 2) + 0.3, "Free man found. The tag sits right on the player, not in a menu floating in front of my face."),
    (nth("ROUND", 3) + 0.2, "Just one look this time."),
    (nth("OUTCOME", 3) + 0.3, "Wrong man. He was marked, and the tags show exactly who by."),
    (nth("ROUND", 4) + 0.2, "Now I turn into trouble."),
    (nth("OUTCOME", 4) + 0.3, "That's an opponent. The worst outcome on the pitch."),
    (nth("ROUND", 5) + 0.4, "This is the habit it trains. Scan before every pass, so when play freezes, you already know the answer."),
    (nth("ROUND", 7) + 0.3, "Every level adds a player and speeds up the pass. The glasses' narrow view hides what's behind you, just like a real pitch. The only way to see it is to turn your head."),
    (gameplay_end + 0.4, "Shoulder Check. Know the answer before the ball arrives."),
]


def dur(path):
    return float(subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())


async def synth():
    os.makedirs(os.path.join(HERE, "vo"), exist_ok=True)
    out = []
    for i, (t, text) in enumerate(SCRIPT):
        p = os.path.join(HERE, "vo", "line%02d.mp3" % i)
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(p)
        out.append((t, p, text))
    return out


vo = asyncio.run(synth())
ok = True
for i, (t, p, text) in enumerate(vo):
    d = dur(p)
    nxt = vo[i + 1][0] if i + 1 < len(vo) else total
    flag = "" if t + d <= nxt - 0.15 else "  <-- OVERLAPS next (%.2f s over)" % (t + d - nxt)
    ok = ok and not flag
    print("%6.2f-%6.2f  %s%s" % (t, t + d, text[:70], flag))
if not ok:
    sys.exit("Fix the script timing first.")

sfx = [(t, {"SFX_PASS": "PassKick.wav", "SFX_GOOD": "ResultGood.wav", "SFX_BAD": "ResultBad.wav"}[k])
       for t, k, _ in beats if k.startswith("SFX") and TITLE_SEC <= t <= gameplay_end]

inputs = ["-i", os.path.join(HERE, "ShoulderCheck_demo.mp4")]
filt = []
labels = []
n = 1
for t, p, _ in vo:
    inputs += ["-i", p]
    ms = int(t * 1000)
    filt.append("[%d:a]aresample=48000,aformat=channel_layouts=stereo,adelay=%d|%d,volume=1.0[a%d]" % (n, ms, ms, n))
    labels.append("[a%d]" % n)
    n += 1
for t, f in sfx:
    inputs += ["-i", os.path.join(SFX, f)]
    ms = int(t * 1000)
    filt.append("[%d:a]aresample=48000,aformat=channel_layouts=stereo,adelay=%d|%d,volume=0.32[a%d]" % (n, ms, ms, n))
    labels.append("[a%d]" % n)
    n += 1
filt.append("%samix=inputs=%d:normalize=0:dropout_transition=0,apad,atrim=0:%.3f,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]" % ("".join(labels), len(labels), total))
fg = os.path.join(HERE, "vo_filter.txt")
open(fg, "w", encoding="utf-8").write(";\n".join(filt))
out = os.path.join(HERE, "ShoulderCheck_demo_vo.mp4")
cmd = [FF, "-hide_banner", "-loglevel", "error", "-y"] + inputs + ["-filter_complex_script", fg, "-map", "0:v", "-map", "[aout]",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
r = subprocess.run(cmd)
print("exit", r.returncode, "sfx", len(sfx), "lines", len(vo), "total %.1fs" % total)
