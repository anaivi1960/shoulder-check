"""Build the Shoulder Check demo video: title card + captioned gameplay + end card (1920x1080).

Caption timing comes from the [SC-DEMO] beats in the Lens Studio log (wall-clock), mapped
onto the raw recording via rec_start.txt.
"""
import glob, os, re, subprocess, sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
FF = r"C:\Users\MSI LAPTOP\AppData\Local\Programs\ffmpeg\bin\ffmpeg.exe"
FONT = "C\\:/Windows/Fonts/segoeui.ttf"
FONTB = "C\\:/Windows/Fonts/segoeuib.ttf"
LOGDIR = r"C:\Users\MSI LAPTOP\AppData\Local\Snap\Lens Studio\logs"
BG = "0x101820"
TITLE_SEC = 5.0
END_SEC = 6.0


def wall(ts):
    return datetime.strptime(ts[:15], "%H:%M:%S.%f")


rec0 = wall(open(os.path.join(HERE, "rec_start.txt")).read().strip()[:15])
log = max(glob.glob(os.path.join(LOGDIR, "LensStudioLog-*.txt")), key=os.path.getmtime)
lines = open(log, encoding="utf-8", errors="replace").read().splitlines()

# Last demo-reel run only.
start_idx = max(i for i, l in enumerate(lines) if "RUNS: demo-reel" in l)
beats = []
for l in lines[start_idx:]:
    m = re.match(r"I (\d\d:\d\d:\d\d\.\d+) .*\[SC-DEMO\] t=[\d.]+ (.*)$", l)
    if m:
        beats.append(((wall(m.group(1)) - rec0).total_seconds(), m.group(2)))
    m2 = re.match(r"I (\d\d:\d\d:\d\d\.\d+) .*\[ShoulderCheck\] (SCAN counted.*|OUTCOME.*)$", l)
    if m2:
        beats.append(((wall(m2.group(1)) - rec0).total_seconds(), "GAME " + m2.group(2)))
runs_t = (wall(re.match(r"I (\d\d:\d\d:\d\d\.\d+)", lines[start_idx]).group(1)) - rec0).total_seconds()
beats.sort()
for b in beats:
    print("%7.2f  %s" % b)

clip_in = runs_t + 1.2
end_beat = [t for t, s in beats if s.startswith("END")]
clip_out = (end_beat[0] if end_beat else beats[-1][0]) + 2.0
dur = clip_out - clip_in
print("clip", clip_in, clip_out, dur)

# ── Captions: (start, end, headline, body) in gameplay-clip time ─────────────
rounds = [(t - clip_in, s) for t, s in beats if s.startswith("ROUND")]
round_t = [t for t, _ in rounds] + [dur]


def first(prefix, after, before):
    for t, s in beats:
        tt = t - clip_in
        if s.startswith(prefix) and after <= tt < before:
            return tt
    return None


caps = []
STORY = {
    1: ("No shoulder checks", "Eyes locked on the ball. When it arrives, play freezes\nmid-stride and the players in the drill turn grey. Who was free?"),
    2: ("Check left, check right", "Two quick head turns while the ball travels.\nEach turn of 60\u00b0+ and back counts as a scan."),
    3: ("Only one look", "A left check only. I pick a winger from memory,\nbut he was marked."),
    4: ("Turning into trouble", "Picked the presser behind me: an opponent."),
    5: ("Scan every pass", "Two checks before the ball, then pick the free man."),
}
OUTCOME_BODY = {
    "Lost the ball, too slow": "No pick in time: the presser steps in and takes it.\nOne short card, one tip: who I never looked at.",
    "Free man found": "FREE MAN tag on the player himself, ghost pass line to him.\nThe card shows scans, decision time and one tip.",
    "He was marked": "MARKED and MARKER tags sit on the players themselves,\nand the real free man is tagged in green.",
    "That's an opponent": "Red OPPONENT tag on my pick: the worst outcome.\nThe free man is tagged in green.",
}
for i, (t0, s) in enumerate(rounds):
    n = i + 1
    t1 = round_t[i + 1]
    lvl = re.search(r"level=(\d+)", s).group(1)
    head, body = STORY.get(n, STORY[5])
    out_t = first("OUTCOME", t0, t1)
    freeze_t = first("FREEZE", t0, t1)
    mid = freeze_t if freeze_t is not None else t0 + 3
    caps.append((t0, mid, "Round %d \u00b7 Level %s" % (n, lvl), head, body))
    if out_t is not None:
        res = [s2 for tt, s2 in beats if s2.startswith("OUTCOME") and abs((tt - clip_in) - out_t) < 0.01][0][len("OUTCOME "):]
        caps.append((mid, out_t, "Round %d \u00b7 Level %s" % (n, lvl), "The freeze", "Pick the free teammate from memory.\nOnly the grey players can be picked."))
        body = OUTCOME_BODY.get(res, OUTCOME_BODY["He was marked"] if res.startswith("He was marked") else "")
        caps.append((out_t, t1, "Round %d \u00b7 Level %s" % (n, lvl), res, body))

# Short "SCAN" pops in clip time.
scans = [t - clip_in for t, s in beats if s.startswith("GAME SCAN counted")]

os.makedirs(os.path.join(HERE, "txt"), exist_ok=True)


def tfile(name, text):
    p = os.path.join(HERE, "txt", name)
    # newline="\n": a Windows "\r\n" renders as an extra blank line in drawtext.
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return p.replace("\\", "/").replace(":", "\\:")


X = 1010
f = []
f.append("[0:v]drawbox=x=0:y=10:w=iw:h=46:color=0x626164@1:t=fill,scale=-2:1000,setsar=1[g]")
f.append("color=c=%s:s=1920x1080:d=%.3f[bg]" % (BG, dur))
f.append("[bg][g]overlay=x=60:y=40[v0]")
cur = "v0"
k = 0


def add(expr):
    global cur, k
    k += 1
    f.append("[%s]%s[v%d]" % (cur, expr, k))
    cur = "v%d" % k


add("drawtext=fontfile='%s':text='SHOULDER CHECK':fontsize=30:fontcolor=0x7FB4FF:x=%d:y=60" % (FONTB, X))
add("drawtext=fontfile='%s':textfile='%s':fontsize=24:fontcolor=0x8A99AA:x=%d:y=100" % (FONT, tfile("sub.txt", "A scanning trainer for Specs \u00b7 Lens Studio preview, SPECS 27"), X))
for i, (a, b, tag, head, body) in enumerate(caps):
    en = "enable='between(t,%.2f,%.2f)'" % (a, b)
    add("drawtext=fontfile='%s':textfile='%s':fontsize=30:fontcolor=0x9FB0C0:x=%d:y=330:%s" % (FONT, tfile("tag%d.txt" % i, tag), X, en))
    add("drawtext=fontfile='%s':textfile='%s':fontsize=54:fontcolor=white:x=%d:y=380:%s" % (FONTB, tfile("head%d.txt" % i, head), X, en))
    if body:
        add("drawtext=fontfile='%s':textfile='%s':fontsize=32:fontcolor=0xD6DEE8:line_spacing=2:x=%d:y=470:%s" % (FONT, tfile("body%d.txt" % i, body), X, en))
for i, t in enumerate(scans):
    add("drawtext=fontfile='%s':text='SCAN +1':fontsize=44:fontcolor=0x5BE37D:x=%d:y=700:enable='between(t,%.2f,%.2f)'" % (FONTB, X, t, t + 0.9))
add("drawtext=fontfile='%s':textfile='%s':fontsize=22:fontcolor=0x6F7F90:line_spacing=0:x=%d:y=960" % (
    FONT, tfile("foot.txt", "White lines = the glasses' 37\u00b0 x 32\u00b0 view. Players behind you only\nappear when you turn your head. Head turns and picks are scripted for this demo."), X))
f.append("[%s]format=yuv420p[gv]" % cur)

# Title + end cards.
title = tfile("title.txt", "Shoulder Check")
t_sub = tfile("tsub.txt", "Train the habit of checking your shoulders before the ball arrives.\nA full 22-player pitch around you. A Specs Lens built for Learn AR with SPECS.")
end1 = tfile("end1.txt", "Glasses hide what's behind you, just like a real pitch.")
end2 = tfile("end2.txt", "Check your shoulders. Know the answer before the ball arrives.\n\nLogic proven in Lens Studio preview with 8 LEAF tests.\nFeel on real glasses still to be tested.")
f.append("color=c=%s:s=1920x1080:d=%.1f,drawtext=fontfile='%s':textfile='%s':fontsize=110:fontcolor=white:x=(w-tw)/2:y=380,"
         "drawtext=fontfile='%s':textfile='%s':fontsize=36:fontcolor=0xB8C6D6:line_spacing=4:x=(w-tw)/2:y=560,format=yuv420p[tv]" % (BG, TITLE_SEC, FONTB, title, FONT, t_sub))
f.append("color=c=%s:s=1920x1080:d=%.1f,drawtext=fontfile='%s':textfile='%s':fontsize=56:fontcolor=white:x=(w-tw)/2:y=360,"
         "drawtext=fontfile='%s':textfile='%s':fontsize=34:fontcolor=0xB8C6D6:line_spacing=4:x=(w-tw)/2:y=480,format=yuv420p[ev]" % (BG, END_SEC, FONTB, end1, FONT, end2))
f.append("[tv][gv][ev]concat=n=3:v=1:a=0[out]")

fg = os.path.join(HERE, "filter.txt")
open(fg, "w", encoding="utf-8").write(";\n".join(f))
out = os.path.join(HERE, "ShoulderCheck_demo.mp4")
cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", "-ss", "%.3f" % clip_in, "-t", "%.3f" % dur, "-i", os.path.join(HERE, "raw.mp4"),
       "-filter_complex_script", fg, "-map", "[out]", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", out]
print(" ".join(cmd))
r = subprocess.run(cmd)
print("exit", r.returncode, "total %.1fs" % (TITLE_SEC + dur + END_SEC))
