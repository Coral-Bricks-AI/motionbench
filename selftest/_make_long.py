"""Reference solutions for the two long tasks: the launch film stitched from the short references as timed
scenes, and a one-shape UI piece for the Open Design brief. Run after _make.py."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))

import sys
KIND = sys.argv[1] if len(sys.argv) > 1 else "oracle"

def parts(tid):
    html = open(os.path.join(HERE, KIND, tid, "index.html")).read()
    body = re.search(r'<div id="stage">(.*)</div>\n<script src', html, re.S).group(1)
    script = re.search(r"const tl = gsap\.timeline\(\{paused:true\}\);\n(.*)\ntl\.set\(\{\}, \{\}, [\d.]+\);", html, re.S).group(1)
    css = re.search(r"\.h\{[^}]*\}\n(.*)\n</style>", html, re.S).group(1)
    return body, script, css

REN = {  # short-task roles → launch-film roles
    "p-squash-stretch": {'data-role="floor"': 'data-x="floor"'},
    "p-anticipation": {'data-role="floor"': 'data-x="floor"'},
    "p-arcs": {"data-role=\"dot\"": "data-role=\"toss\"", "[data-role=dot]": "[data-role=toss]"},
    "p-overlap": {"row-": "feature-", "[data-role^=row]": "[data-role^=feature]"},
    "p-staging": {"line-": "read-"},
    "s-pan": {"station-": "stop-"},
    "s-count": {'data-role="value"': 'data-role="count"', "[data-role=value]": "[data-role=count]"},
    "s-curtain": {'data-role="prompt-b"': 'data-role="prompt"', ' data-role="headline-a"': ""},
    "s-rise": {"line-1": "rise-1", "line-2": "rise-2"},
}
SCENES = [  # (task, start, length, background)
    ("p-squash-stretch", 0.0, 4.0, "#F9F9FA"), ("p-anticipation", 4.0, 2.5, "#F9F9FA"), ("p-arcs", 6.5, 2.5, "#F9F9FA"),
    ("p-secondary-action", 9.0, 3.0, "#F9F9FA"), ("p-follow-through", 12.0, 2.0, "#F9F9FA"), ("p-overlap", 14.0, 2.6, "#F9F9FA"),
    ("p-staging", 16.6, 6.0, "#F9F9FA"), ("s-continuity", 22.6, 4.0, "#F9F9FA"), ("s-pan", 26.6, 6.0, "#F9F9FA"),
    ("s-stream", 32.6, 4.0, "#1B202A"), ("s-count", 36.6, 3.0, "#F9F9FA"), ("s-curtain", 39.6, 3.0, "#F9F9FA"),
    ("s-rise", 42.6, 3.0, "#F9F9FA"), ("s-beat", 45.6 - 0.1, 3.0, "#F9F9FA"), ("s-lockup", 48.5, 3.5, "#F9F9FA"),
]
TOTAL = 52.0
head = open(os.path.join(HERE, "oracle", "p-ease", "index.html")).read().split('<div id="stage">')[0]
head = head.replace("{{", "{").replace("}}", "}")
css_all, bodies, scripts = [], [], []
for k, (tid, start, length, bg) in enumerate(SCENES):
    body, script, css = parts(tid)
    for a, b in REN.get(tid, {}).items():
        body, script = body.replace(a, b), script.replace(a, b)
    if css.strip() and css not in css_all:
        css_all.append(css)
    bodies.append(f'<div class="scene" id="sc{k}" style="background:{bg}">{body}</div>')
    last = k == len(SCENES) - 1
    scripts.append(f"""(function(){{ const tl = gsap.timeline();
{script}
MAIN.add(tl, {start});
MAIN.set("#sc{k}", {{autoAlpha:1}}, {start});
{'' if last else f'MAIN.set("#sc{k}", {{autoAlpha:0}}, {start + length});'}
}})();""")
# The beat words land on 46.0, 46.5, 47.0, 47.5 (the grid from 0): the short reference lands them 0.5 s apart from 0.5 s.
page = head.replace("</style>", ".scene{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;visibility:hidden}\n" + "\n".join(css_all) + "\n</style>")
page += '<div id="stage">' + "".join(bodies) + "</div>\n<script src=\"assets/gsap.min.js\"></script>\n<script>(function(){\nconst MAIN = gsap.timeline({paused:true});\n"
page += "\n".join(scripts) + f"\nMAIN.set({{}}, {{}}, {TOTAL});\nwindow.__timelines = window.__timelines || {{}};\nwindow.__timelines.main = MAIN;\n}})();</script></body></html>\n"
os.makedirs(os.path.join(HERE, KIND, "l-launch"), exist_ok=True)
open(os.path.join(HERE, KIND, "l-launch", "index.html"), "w").write(page)

# ---- the Open Design one-shape piece ----
STATES = [  # w, h, radius, label
    (280, 72, 36, "Generate"), (72, 72, 36, ""), (96, 96, 48, "✓"), (360, 88, 44, "Live"), (520, 120, 28, "Now playing"),
    (520, 24, 12, ""), (420, 40, 20, ""), (120, 64, 32, ""), (440, 64, 32, "Week · Month"), (560, 320, 24, "Chart"),
    (640, 96, 20, "frame"), (420, 80, 16, "Saved"), (280, 72, 36, "Generate"),
]
js = ["const S = document.querySelector('[data-role=shape]'), L = document.querySelector('#lbl'), C = document.querySelector('[data-role=cursor]');",
      "const tl = gsap.timeline({paused:true});",
      "const geo = (w,h) => ({left:960-w/2, top:540-h/2, width:w, height:h});",
      "gsap.set(C, {x:1260, y:700});"]
# State changes on the odd half-beats 0.5 … 11.5, a click on each whole beat between, then clicks and the
# cursor's way home fill the last beats; labels are a function of time (a GSAP set of textContent does not
# reliably revert on a backward seek).
times = [0.5 + (i - 1) * 1.0 for i in range(1, len(STATES))]
js.append(f"const LABELS = {json.dumps([s_[3] for s_ in STATES])}, TIMES = {json.dumps(times)};")
js.append("tl.eventCallback('onUpdate', () => { let k = 0; for (let i = 0; i < TIMES.length; i++) if (tl.time() >= TIMES[i] + 0.1) k = i + 1; if (L.textContent !== LABELS[k]) L.textContent = LABELS[k]; });")
for i in range(1, len(STATES)):
    w, h, r, lab = STATES[i]
    t = times[i - 1]
    pw, ph = STATES[i - 1][0], STATES[i - 1][1]
    cx, cy = 960 + pw * 0.25, 540 + ph * 0.2
    js.append(f"tl.to(C, {{x:{cx - 9}, y:{cy - 9}, duration:0.4, ease:'power2.inOut'}}, {t - 0.45:.2f});")
    js.append(f"tl.to(S, {{scale:0.96, duration:0.08, ease:'power2.out'}}, {t - 0.08:.2f}).to(S, {{scale:1, duration:0.3, ease:'power2.out'}}, {t:.2f});")
    js.append(f"tl.to(S, {{...geo({w},{h}), borderRadius:{r}, duration:0.42, ease:'back.out(0.6)'}}, {t:.2f});")
    js.append(f"tl.to(S, {{scale:0.97, duration:0.08, ease:'power2.out'}}, {t + 0.42:.2f}).to(S, {{scale:1, duration:0.3, ease:'power2.out'}}, {t + 0.5:.2f});")
js.append("tl.to(C, {x:1260, y:700, duration:1.2, ease:'power2.inOut'}, 12.45);")
js.append("tl.set({}, {}, 14);")
js.append("window.__timelines = {main: tl};")
w0, h0, r0, l0 = STATES[0]
od = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:"Geist";src:url(assets/fonts/geist-medium.ttf);font-weight:500}}
html,body{{margin:0;width:1920px;height:1080px;overflow:hidden;background:#EDEDE8}}
#stage{{position:absolute;inset:0;background:#EDEDE8;font-family:"Geist"}}
[data-role=shape]{{position:absolute;left:{960 - w0 / 2}px;top:{540 - h0 / 2}px;width:{w0}px;height:{h0}px;border-radius:{r0}px;background:#0A0A0A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:26px;overflow:hidden}}
[data-role=cursor]{{position:absolute;left:0;top:0;width:18px;height:18px;border-radius:50%;background:#0A0A0A;border:3px solid #FFFFFF;box-sizing:border-box}}
</style></head><body><div id="stage"><div data-role="shape"><span id="lbl">{l0}</span></div><div data-role="cursor"></div></div>
<script src="assets/gsap.min.js"></script><script>(function(){{
{chr(10).join(js)}
}})();</script></body></html>
"""
if KIND == "naive":
    # Hard cuts between states, a cursor parked in a corner, and an ending that is not the opening.
    od = re.sub(r"duration:0\.42, ease:'back\.out\(0\.6\)'", "duration:0.0", od)
    od = od.replace("gsap.set(C, {x:1260, y:700});", "gsap.set(C, {x:1700, y:900});").replace("tl.to(C, {x:", "tl.set(C, {x:1700, y:900, _x:")
    od = od.replace('(280, 72, 36, "Generate")]', '(420, 80, 16, "Saved")]')
os.makedirs(os.path.join(HERE, KIND, "l-opendesign"), exist_ok=True)
open(os.path.join(HERE, KIND, "l-opendesign", "index.html"), "w").write(od)
print("written")
