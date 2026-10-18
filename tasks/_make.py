"""Writes every task folder (brief.md, task.json, assets). Edit here, then run: python3 tasks/_make.py"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
T = {}

def task(id, track, principle, duration, roles, brief, checks, shots=None, pixels=None, oscillate=None, extra=None):
    T[id] = dict(id=id, track=track, principle=principle, duration=duration, fps=60, roles=roles, checks=checks,
                 shots=shots or [round(duration * k / 7, 3) for k in range(8)], pixels=pixels or {}, oscillate=oscillate or [], brief=brief.strip() + "\n", extra=extra or {})

HEAD = lambda title, dur: f"# {title}\n\n1920×1080, 60 fps, **{dur} s**. Read `CONTRACT.md` (format, roles, tools) and `BRAND.md` (colours, type, motion rules) first.\n\n"

# ---------------- principles ----------------
task("p-ease", "principles", "slow in and slow out", 3.0, ["card"], HEAD("Place the card", 3.0) + """
An off-white frame with a single card on it (about 360×220, white-ish `#FDFDFD` with a hairline border, a short label inside if you like).

The card rests in the middle of the left third of the frame (centred on x = 320, vertically centred). At **0.5 s** it is moved to the middle of the right third (centred on x = 1600) and comes to rest there; the move takes about a second. It should move like a real object being put down by a confident hand: never mechanical. It holds there to the end.

Roles: `card` (the card itself).
""", [
    dict(type="at", role="card", key="cx", from_=0, to=0.45, min=300, max=340),
    dict(type="still", role="card", from_=0, to=0.45),
    dict(type="move", role="card", key="cx", start=[0.45, 0.6], dur=[0.6, 1.6], ease_in=0.35, ease_out=0.35, peak_mid=[0.2, 0.8]),
    dict(type="at", role="card", key="cx", from_=2.3, to=3.0, min=1580, max=1620),
    dict(type="still", role="card", from_=2.3, to=3.0),
])

task("p-anticipation", "principles", "anticipation", 2.5, ["puck", "floor"], HEAD("Flick the puck", 2.5) + """
A floor line runs across the frame at y = 760 (a 2 px hairline). A coral puck (a 120 px circle) sits on it, centred on x = 360.

At about **1.0 s** the puck is flicked to the right and slides across to come to rest centred on x = 1560. Give the flick anticipation, so the viewer reads it coming. The puck stays on the floor the whole time (its bottom on the line).

Roles: `puck`, `floor`.
""", [
    dict(type="still", role="puck", from_=0, to=0.3),
    dict(type="anticipation", role="puck", key="cx", dir=1, min_frac=0.015, max_frac=0.3, lead=[0.1, 0.8], speed_ratio=0.5, release=[0.85, 1.4]),
    dict(type="at", role="puck", key="b", from_=0, to=2.5, min=756, max=764, id="puck: stays on the floor"),
    dict(type="at", role="puck", key="cx", from_=2.35, to=2.5, min=1540, max=1580),
    dict(type="still", role="puck", from_=2.35, to=2.5),
], oscillate=[])

task("p-follow-through", "principles", "follow-through and settle", 2.0, ["badge"], HEAD("Pop the badge", 2.0) + """
A coral badge (a 220 px circle with a check mark in `#FDFDFD`) pops into place at the centre of the frame at **0.4 s**. Before that, nothing is there.

It should land with some weight and a little springy follow-through, then settle completely and hold. Its final size is its natural size (220 px).

Roles: `badge` (the circle; the check can be inside it).
""", [
    dict(type="overshoot", role="badge", key="w", over=[0.03, 0.3], settle=1.2, max_cross=4, appear=[0.35, 0.55]),
    dict(type="at", role="badge", key="cx", t=2.0, min=954, max=966),
    dict(type="at", role="badge", key="cy", t=2.0, min=534, max=546),
    dict(type="at", role="badge", key="w", t=2.0, min=218, max=222),
    dict(type="still", role="badge", from_=1.7, to=2.0),
], oscillate=["badge"])

task("p-overlap", "principles", "overlapping action", 2.6, [f"row-{i}" for i in range(1, 6)], HEAD("Cascade the list", 2.6) + """
Five list rows (each about 900×110, `#FDFDFD` with a hairline border and a line of text, e.g. "Request 1" … "Request 5") end stacked down the frame with their left edges at x = 510 and equal spacing, the block vertically centred.

They enter from the left. The entrance should read as one motion travelling down the list: not five separate events one after the other, and not all at once. Everything has settled by **2.0 s** and holds.

Roles: `row-1` … `row-5`, top to bottom.
""", [
    dict(type="stagger", roles=[f"row-{i}" for i in range(1, 6)], key="x", gap=[0.03, 0.25], even=3, by=2.0),
    dict(type="at", role="row-1", key="x", t=2.6, min=508, max=512),
])

task("p-squash-stretch", "principles", "squash and stretch", 4.0, ["ball", "floor"], HEAD("Bounce the ball", 4.0) + """
A floor line at y = 880 (a 2 px hairline across the frame). A coral ball (a 140 px circle) is held near the top of the frame (its top at about y = 120, centred horizontally) and dropped at **0.3 s**.

It bounces, each bounce lower than the last, and comes to rest on the floor by **3.5 s**, holding there to the end. Use squash and stretch, but keep the ball's volume. It never sinks into the floor.

Roles: `ball`, `floor`.
""", [
    dict(type="bounce", role="ball", floor=880, contacts=[3, 8], rest=3.5),
], oscillate=["ball"])

task("p-arcs", "principles", "arcs", 2.4, ["dot"], HEAD("Toss the dot", 2.4) + """
A coral dot (80 px) rests at the bottom left (centred on x = 300, y = 820). Starting at about **0.4 s** it is tossed across the frame and lands at the bottom right (centred on x = 1620, y = 820) by about **1.8 s**, where it stays. It should travel like a tossed object would.

Roles: `dot`.
""", [
    dict(type="still", role="dot", from_=0, to=0.35),
    dict(type="arc", role="dot", min_dev=0.12, land=2.2),
    dict(type="at", role="dot", key="cx", t=2.4, min=1610, max=1630),
    dict(type="at", role="dot", key="cy", t=2.4, min=810, max=830),
])

task("p-secondary-action", "principles", "secondary action", 3.0, ["card", "tag"], HEAD("Swing the tag", 3.0) + """
A card (about 520×320, `#FDFDFD` with a hairline border) slides in from beyond the right edge of the frame and stops centred in the frame at about **1.2 s**.

A small tag (about 90×130, coral `#D44027` with a hole near its top) hangs down from a pin near the card's top-left corner, like a luggage tag. The card's stop is the main action. As the card stops, the tag carries on a little and swings on its pin, then comes to rest hanging straight down. The tag stays pinned to the card throughout.

Roles: `card`, `tag` (the tag must rotate about its pin).
""", [
    dict(type="move", role="card", key="cx", ease_out=0.35, name="card"),
    dict(type="at", role="card", key="cx", from_=1.7, to=3.0, min=950, max=970),
    dict(type="swing", card="card", tag="tag", amp=[4, 45], settle_by=3.0),
], oscillate=["tag"])

task("p-staging", "principles", "staging and readability", 6.0, ["line-1", "line-2", "line-3"], HEAD("Three lines, one at a time", 6.0) + """
Three short headlines are shown one after another in the same place, centred in the frame, at headline size:

1. "Clear language." 2. "Useful details." 3. "One coral accent."

Each must be easy to read: give the viewer time to take each one in, and never make two of them compete. How each one comes and goes is up to you.

Roles: `line-1`, `line-2`, `line-3` (each headline's text element).
""", [
    dict(type="holds", roles=["line-1", "line-2", "line-3"], hold=1.0, overlap=0.25, min_h=70),
])

# ---------------- studio ----------------
task("s-pan", "studio", "camera pan between stations", 6.0, ["world", "station-1", "station-2", "station-3"], HEAD("Pan between stations", 6.0) + """
One wide world, three frames across (5760×1080, off-white), holds three stations, each the width of the frame: "Request" (the first 1920 px), "Route" (the next) and "Reply" (the last). Each station is one word at headline size, centred in its own screen.

The camera moves over this world: it starts on station 1, pans to station 2, holds, pans to station 3 and holds to the end. Each hold lasts at least a second. The pans are the studio's precise camera moves: expo in-out. Nothing shakes, overshoots or drifts during the holds. Move the world, not the words.

Roles: `world` (the 5760 px wide element that moves; its left edge is the camera), `station-1`, `station-2`, `station-3` (the words).
""", [
    dict(type="stations", world="world", targets=[0, -1920, -3840], labels=["station-1", "station-2", "station-3"], hold=0.9, dur=[0.5, 1.6], edge=0.03),
])

task("s-continuity", "studio", "continuity", 4.0, ["line", "headline"], HEAD("Dot, hairline, divider", 4.0) + """
On off-white, one element carries the whole piece. A small coral dot appears at the centre of the frame, stretches into a coral hairline across the frame, then glides down to become the divider beneath a headline, "One API." (headline size, ink), which rises into place above it. It ends as a held title: the headline with its divider under it.

It is the same element from dot to divider: no cuts, no swaps, no fades between shapes.

Roles: `line` (the dot, hairline and divider: one element), `headline`.
""", [
    dict(type="continuity", line="line", headline="headline"),
])

TOKENS_TEXT = (
    "Here is the request that the gateway received, and what it did with it.\n\n"
    "POST /v1/chat/completions\nmodel: deepseek-v4.1-flash-fast\nmax_tokens: 1024\nstream: true\n\n"
    "The request was routed to the nearest replica with a warm cache for this prefix, so the first token "
    "came back in 180 milliseconds. Every token after that streamed at the model's own pace, about 340 tokens "
    "per second, which is faster than anyone can comfortably read. Reasoning was not requested, so none was "
    "generated. The reply stopped on its own, with finish_reason set to stop, after 412 output tokens.\n\n"
    "Usage: 1,208 input tokens (1,024 from cache), 412 output tokens. Nothing was stored after the response "
    "was sent, and the same request sent again would be routed the same way. If you want the request to be "
    "retried on a different replica when one is slow, set a timeout and let the client retry; the gateway "
    "will not hold a request longer than you ask it to."
)
def tokenize(s):
    out = []
    for piece in re.findall(r"\n|[ ]?[A-Za-z]+|[ ]?\d+|[ ]?[^\sA-Za-z\d]", s):
        core = piece.lstrip(" ")
        lead = piece[: len(piece) - len(core)]
        if core.isalpha() and len(core) > 6:
            parts = [core[i:i + 4] for i in range(0, len(core), 4)]
            out.append(lead + parts[0]); out.extend(parts[1:])
        else:
            out.append(piece)
    assert "".join(out) == s
    return out
TOKENS = tokenize(TOKENS_TEXT)
N = len(TOKENS)
task("s-stream", "studio", "real rates", 4.0, ["reply", "cursor"], HEAD("Stream the reply", 4.0) + f"""
A terminal on the charcoal surface (the whole frame is charcoal `#1B202A`). A model's reply streams into it at the real rate: **340 tokens per second**, starting at **0.5 s**. The reply is in `assets/tokens.json`: {N} tokens, in order; joined, they are the text (with its line breaks). Show it exactly as given, revealing whole tokens, never part of one, in the mono face at a size that fits the whole reply on screen inside title-safe.

A coral cursor (a block or bar) sits just after the last character while the reply streams. After the reply is complete it can stay or go.

Roles: `reply` (the element holding the streamed text), `cursor`.
""", [
    dict(type="stream", reply="reply", cursor="cursor", start=0.5, rate=340, tol=12),
    dict(type="surface", colour="#1B202A"),
], pixels=dict(surface=dict(t=[0.2, 2.0, 3.9], points=[[30, 30], [1890, 30], [30, 1050], [1890, 1050]], colour="#1B202A")),
   shots=[0, 0.5, 0.8, 1.1, 1.4, 1.7, 2.0, 3.9], extra=dict(tokens=TOKENS))

task("s-count", "studio", "stepped count", 3.0, ["value"], HEAD("Count the requests", 3.0) + """
On off-white, the number of requests served today counts up from 0 to **1,284**, starting at **0.4 s** and landing on 1,284 at **2.0 s**, then holding. It is the one key number on the frame, so make it big (hero size), and it is a measurement. Format it with a thousands separator. The count should feel like it is arriving at the number. A small label under it ("requests today") is welcome.

Roles: `value` (the element holding the number's text).
""", [
    dict(type="count", role="value", start=0.4, land=2.0, to=1284, mid=0.6, min_h=120),
])

task("s-curtain", "studio", "curtain between surfaces", 3.0, ["headline-a", "prompt-b"], HEAD("Curtain to the terminal", 3.0) + """
Scene A: the off-white surface with the headline "One API." (headline size, ink, wherever you like).

At **1.0 s**, scene B comes in as a curtain that rises from the bottom edge of the frame and covers scene A completely by about **1.7 s**. Scene B is the charcoal surface with one terminal line in the mono face: `$ curl https://inference.coralbricks.ai/v1/chat/completions`. It holds to the end.

A hard change of surface by a curtain; not a crossfade.

Roles: `headline-a`, `prompt-b`.
""", [
    dict(type="curtain", start=[0.95, 1.25], cover=[1.25, 1.95]),
    dict(type="at", role="headline-a", key="o", t=0.5, min=0.98, max=1),
    dict(type="at", role="prompt-b", key="o", t=2.9, min=0.98, max=1),
], pixels=dict(curtain=dict(from_=0.85, to=2.1, a="#F9F9FA", b="#1B202A")), shots=[0.5, 1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.9])

task("s-beat", "studio", "hits on the beat", 3.0, ["word-1", "word-2", "word-3", "word-4"], HEAD("Words on the beat", 3.0) + """
The score runs at **120 bpm**, with beat 1 at **0.5 s**. On off-white, the line "All models, one API." builds word by word: "All" on beat 1, "models," on beat 2, "one" on beat 3, "API." on beat 4. Each word *lands* on its beat: it arrives (finishes coming in) exactly on the beat; it is a hit, not a start. The finished line sits on one line, centred, at headline size, and holds.

Roles: `word-1` … `word-4`.
""", [
    dict(type="beats", roles=["word-1", "word-2", "word-3", "word-4"], bpm=120, beat1=0.5),
])

task("s-lockup", "studio", "the lockup", 3.0, ["mark", "wordmark"], HEAD("Build the lockup", 3.0) + """
The end card, on off-white: the CoralBricks lockup, the mark (`assets/logo-icon.svg`, used as it is) next to the wordmark "CoralBricks" (Open Sauce Two Bold, ink `#0A0C11`). It builds in and holds, centred and large, from **1.6 s** to the end.

The mark arrives first, with a little follow-through; the wordmark then reveals from the mark.

Roles: `mark`, `wordmark`.
""", [
    dict(type="lockup", mark="mark", wordmark="wordmark", hold_from=1.6),
    dict(type="coral_mark"),
    dict(type="surface", colour="#F9F9FA"),
], pixels=dict(coral_mark=dict(role="mark"), surface=dict(t=[2.9], points=[[30, 30], [1890, 30], [30, 1050], [1890, 1050]], colour="#F9F9FA")))

task("s-rise", "studio", "line-mask rise", 3.0, ["line-1", "line-2", "accent"], HEAD("Rise the headline", 3.0) + """
On off-white, a two-line headline at headline size, left-aligned on the 120 px margin in the optical upper third:

"Clear language." / "Useful details." with "details." in coral.

Each line rises into place through a line mask: it slides up from below its own line, clipped, so it is never seen outside its line. Line 2 follows shortly after line 1. Settled by **1.6 s**, holding to the end.

Roles: `line-1`, `line-2` (the moving text of each line, not its mask), `accent` (the word "details.").
""", [
    dict(type="rise", lines=["line-1", "line-2"], accent="accent", accent_text="details.", gap=[0.05, 0.4], hold_from=1.6, min_h=80),
    dict(type="mask"),
], pixels=dict(mask=dict(from_=0.0, to=1.6, lines=["line-1", "line-2"], surface="#F9F9FA")))


# ---------------- long pieces ----------------
LAUNCH_BRIEF = """# A message from the client

Hi! I run CoralBricks, a small company that gives developers fast access to lots of AI models through one API. I've never made a video and honestly know nothing about animation, but I want a launch video for our homepage, about a minute long, that feels alive and expensive, like the ones Apple or Stripe put out. I'd rather it be amazing than quick. Here's what I'm picturing, in this order:

1. A coral ball drops in from the top and bounces on the floor like a real rubber ball until it stops.
2. Someone flicks a coral puck across the floor to the other side, like in air hockey.
3. Our little coral dot gets tossed from one side of the screen to the other, like throwing a ball to a friend.
4. A pricing card slides in from the right with a small coral tag hanging from a pin near its top corner, like a luggage tag. When the card stops, the tag should keep swinging a little, like a real one would.
5. A round coral badge with a white tick pops up in the middle to say it worked. It should feel really satisfying.
6. Five things we're proud of come in as a list: "Every model", "One key", "Pay per token", "No setup", "Fast everywhere". I want it smooth, not robotic.
7. Three short lines, shown one at a time in the middle: "Clear language.", "Useful details.", "One coral accent." People should actually have time to read them.
8. A small dot appears in the middle, grows into a long line across the screen, and that same line ends up underlining a big title, "One API.", that comes up above it.
9. Show how a request travels: "Request", then "Route", then "Reply", like we're gliding sideways from one to the next and stopping on each.
10. A chat answer typing out at our model's real speed, about 340 tokens a second, so people see how fast it is. The answer is in assets/tokens.json, already split into its tokens: use them exactly. Put a little coral cursor at the end while it's typing.
11. A big counter of how many requests we served today, going up to 1,284.
12. Then the screen swipes up into a dark terminal that shows: $ curl https://inference.coralbricks.ai/v1/chat/completions
13. Our big headline: "Clear language." with "Useful details." under it, the word "details." in our coral. I'd like it to slide up into place nicely.
14. I'll put music under the whole video at 120 BPM, starting on the very first frame. "All models, one API." should come in word by word with the music.
15. End on our logo (assets/logo-icon.svg) with the name CoralBricks next to it, big in the middle, and hold it.

Our designer's brand guide is in BRAND.md. Thanks!!

---

## Tagging for the review tool (added by motionbench, not part of the client's message)

The piece is one `index.html` as in `CONTRACT.md`, 1920×1080, between 40 and 90 seconds long. Tag these elements with `data-role` (one element each, the one that moves):

| Scene | Roles |
|---|---|
| 1 | `ball` |
| 2 | `puck` |
| 3 | `toss` (the dot) |
| 4 | `card`, `tag` |
| 5 | `badge` |
| 6 | `feature-1` … `feature-5`, top to bottom |
| 7 | `read-1`, `read-2`, `read-3` |
| 8 | `line` (the dot that becomes the line), `headline` |
| 9 | `world` (whatever slides sideways), `stop-1`, `stop-2`, `stop-3` (the three words) |
| 10 | `reply` (the text), `cursor` |
| 11 | `count` (the number's text) |
| 12 | `prompt` (the terminal line) |
| 13 | `rise-1`, `rise-2` (the two lines), `accent` (the word "details.") |
| 14 | `word-1` … `word-4` |
| 15 | `mark`, `wordmark` |

A scene's elements should be off screen (or invisible) while other scenes play.
"""

seg = lambda name, roles, checks: dict(type="segment", name=name, roles=roles, checks=checks)
task("l-launch", "long", "everything, asked for in plain words", 60.0,
     ["ball", "puck", "toss", "card", "tag", "badge"] + [f"feature-{i}" for i in range(1, 6)] + ["read-1", "read-2", "read-3", "line", "headline", "world", "stop-1", "stop-2", "stop-3", "reply", "cursor", "count", "prompt", "rise-1", "rise-2", "accent"] + [f"word-{i}" for i in range(1, 5)] + ["mark", "wordmark"],
     LAUNCH_BRIEF, [
    seg("1 ball", ["ball"], [dict(type="bounce", role="ball", contacts=[3, 12])]),
    seg("2 puck", ["puck"], [dict(type="struck", role="puck", key="cx")]),  # a hit puck has no wind-up of its own
    seg("3 toss", ["toss"], [dict(type="arc", role="toss", min_dev=0.12)]),
    seg("4 card", ["card", "tag"], [dict(type="move", role="card", key="cx", ease_out=0.35, name="card"), dict(type="swing", card="card", tag="tag", amp=[4, 45])]),
    seg("5 badge", ["badge"], [dict(type="overshoot", role="badge", key="w", over=[0.03, 0.3], settle=1.2, max_cross=4)]),
    seg("6 list", [f"feature-{i}" for i in range(1, 6)], [dict(type="stagger", roles=[f"feature-{i}" for i in range(1, 6)], key="x", gap=[0.03, 0.25], even=3)]),
    seg("7 reading", ["read-1", "read-2", "read-3"], [dict(type="holds", roles=["read-1", "read-2", "read-3"], hold=1.0, overlap=0.25, min_h=50)]),
    seg("8 line", ["line", "headline"], [dict(type="continuity", line="line", headline="headline", coral=False, dot_tol=140, max_h=12, centre=False)]),
    seg("9 travel", ["world"], [dict(type="stations_auto", world="world", labels=["stop-1", "stop-2", "stop-3"], hold=0.8)]),
    seg("10 typing", ["reply"], [dict(type="stream", reply="reply", cursor="cursor", rate=340, tol=12, mono=False)]),
    seg("11 counter", ["count"], [dict(type="count", role="count", to=1284, min_h=120)]),
    dict(type="curtain"),
    seg("13 headline", ["rise-1", "rise-2"], [dict(type="rise", lines=["rise-1", "rise-2"], accent="accent", accent_text="details.", min_h=80, layout=False, only_coral=False)]),
    seg("14 music", [f"word-{i}" for i in range(1, 5)], [dict(type="beats", roles=[f"word-{i}" for i in range(1, 5)], bpm=120, centre=False)]),
    seg("15 end", ["mark", "wordmark"], [dict(type="lockup", mark="mark", wordmark="wordmark", choreography=False)]),
    dict(type="coral_mark"),
], pixels=dict(curtain=dict(role="prompt", b="#1B202A"), coral_mark=dict(role="mark")), oscillate=["ball", "badge", "tag"],
   shots=[1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 59.9], extra=dict(tokens=TOKENS, long=True))

OD_PROMPT = "Make a 14-second Dribbble-level UI motion piece at 120 BPM, 7 bars, something happening on every beat. One shape, never cut: it morphs from a Generate button into a loader, a check, a dynamic island, a music player with a play/pause morph, a scrubbed progress bar, a volume slider that stretches when dragged past max, a toggle, a liquid tab indicator, a chart that draws itself with a hover tooltip, a ⌘K palette you type into, a toast, and back to the button. A cursor drives every change with real clicks and drags. Light warm-gray canvas, black and white components, one clean UI font (Geist). Springs everywhere, a tiny overshoot at most. The last frame is the first frame, so it loops."
OD_BRIEF = f"""# The brief

{OD_PROMPT}

---

This is the starter prompt of Open Design's "One-Shape UI Motion" example, used unchanged. Open Design's motion skill is installed at `skills/open-design-hyperframes/` (start with its `SKILL.md`); Geist is in `assets/fonts/`. There is no music file: the beat is the 120 BPM grid from the first frame.

## Tagging for the review tool (added by motionbench)

Deliver `index.html` as in `CONTRACT.md`, 1920×1080, exactly 14 seconds. Tag the one shape `data-role="shape"` and the cursor `data-role="cursor"`.
"""
task("l-opendesign", "long", "a real user's brief, with a skill", 14.0, ["shape", "cursor"], OD_BRIEF, [
    dict(type="one_shape", role="shape", states=10),
    dict(type="cursor_drives", shape="shape", cursor="cursor"),
    dict(type="springs", role="shape", max=0.1),
    dict(type="beat_activity", bpm=120),
    dict(type="loop"),
    dict(type="surface_light_warm"),
], pixels=dict(beats=dict(bpm=120), loop=True, surface=dict(t=[0.2, 7.0, 13.9], points=[[30, 30], [1890, 30], [30, 1050], [1890, 1050]], colour="#EDEDE8")),
   shots=[0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.99], extra=dict(od=True))


FREE_BRIEF = """# The brief

Make a motion graphic. Anything you like: it's yours. Show what you can do.

---

## For the review tool (added by motionbench)

Deliver `index.html` as in `CONTRACT.md`: 1920×1080, between 10 and 30 seconds long. Nothing needs tagging. Fonts are in `assets/fonts/` if you want them; you don't have to use them.
"""
task("u-free", "free", "unguided", 20.0, [], FREE_BRIEF, [], extra=dict(free=True),
     shots=[1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23])

def fix(d):
    if isinstance(d, dict): return {k.rstrip("_"): fix(v) for k, v in d.items()}
    if isinstance(d, list): return [fix(x) for x in d]
    return d

for id, t in T.items():
    d = os.path.join(HERE, id); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "brief.md"), "w").write(t.pop("brief"))
    extra = t.pop("extra")
    if extra.get("long"):
        t.update(duration_range=[40, 90], timeout=3600)
    if extra.get("free"):
        t.update(duration_range=[10, 30], timeout=3600, brand=False, fonts="any", palette="any", free=True,
                 prompt=("Read BRIEF.md and CONTRACT.md in this folder, then make index.html. Check your work with the tools "
                         "described in CONTRACT.md. When index.html is finished, stop."))
    if extra.get("od"):
        t.update(timeout=3600, brand=False, fonts=["Geist"], palette="neutral", ui=True,
                 prompt=("Read BRIEF.md and CONTRACT.md in this folder. A motion skill is installed at skills/open-design-hyperframes/: "
                         "use it. Then make index.html as the brief asks. Check your work with the tools described in CONTRACT.md. "
                         "When index.html is finished, stop."))
    if "tokens" in extra:
        json.dump(extra["tokens"], open(os.path.join(d, "tokens.json"), "w"), indent=0)
    json.dump(fix(t), open(os.path.join(d, "task.json"), "w"), indent=1)
print(len(T), "tasks;", N, "tokens in s-stream")
