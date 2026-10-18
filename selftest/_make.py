"""Reference ("oracle") and naive solutions for every task. The oracle must pass every check;
each naive one makes the classic mistake its task is about and must fail the craft checks."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
TASKS = os.path.join(HERE, "..", "tasks")

def page(body, script, dur, css="", bg="#F9F9FA"):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:"Open Sauce Two";src:url(assets/fonts/OpenSauceTwo-Regular.ttf);font-weight:400}}
@font-face{{font-family:"Open Sauce Two";src:url(assets/fonts/OpenSauceTwo-SemiBold.ttf);font-weight:600}}
@font-face{{font-family:"Open Sauce Two";src:url(assets/fonts/OpenSauceTwo-Bold.ttf);font-weight:700}}
@font-face{{font-family:"JetBrains Mono";src:url(assets/fonts/JetBrainsMono-Regular.woff2);font-weight:400}}
html,body{{margin:0;width:1920px;height:1080px;overflow:hidden;background:{bg}}}
#stage{{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;background:{bg};font-family:"Open Sauce Two";color:#0A0C11}}
.abs{{position:absolute}}
.card{{background:#FDFDFD;border:2px solid #DDDFE4;border-radius:24px;box-sizing:border-box}}
.h{{font-size:104px;font-weight:600;letter-spacing:-0.025em;white-space:nowrap}}
{css}
</style></head><body><div id="stage">{body}</div>
<script src="assets/gsap.min.js"></script>
<script>(function(){{
const tl = gsap.timeline({{paused:true}});
{script}
tl.set({{}}, {{}}, {dur});
window.__timelines = window.__timelines || {{}};
window.__timelines.main = tl;
}})();</script></body></html>
"""

O, N = {}, {}

# p-ease
card = '<div class="abs card" data-role="card" style="left:140px;top:430px;width:360px;height:220px"></div>'
O["p-ease"] = page(card, 'tl.to("[data-role=card]",{x:1280,duration:1.0,ease:"power2.inOut"},0.5);', 3.0)
N["p-ease"] = page(card, 'tl.to("[data-role=card]",{x:1280,duration:1.0,ease:"none"},0.5);', 3.0)

# p-anticipation
pk = ('<div class="abs" data-role="floor" style="left:0;top:759px;width:1920px;height:2px;background:#DDDFE4"></div>'
      '<div class="abs" data-role="puck" style="left:300px;top:640px;width:120px;height:120px;border-radius:50%;background:#D44027"></div>')
O["p-anticipation"] = page(pk, 'tl.to("[data-role=puck]",{x:-40,duration:0.35,ease:"power2.inOut"},0.6).to("[data-role=puck]",{x:1200,duration:0.9,ease:"power3.out"},0.95);', 2.5)
N["p-anticipation"] = page(pk, 'tl.to("[data-role=puck]",{x:1200,duration:0.9,ease:"power3.out"},0.95);', 2.5)

# p-follow-through
bd = '<div class="abs" data-role="badge" style="left:850px;top:430px;width:220px;height:220px;border-radius:50%;background:#D44027;transform:scale(0)"><svg viewBox="0 0 220 220" width="220" height="220"><path d="M66 112 L98 144 L156 82" fill="none" stroke="#FDFDFD" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
O["p-follow-through"] = page(bd, 'tl.fromTo("[data-role=badge]",{scale:0},{scale:1,duration:0.8,ease:"back.out(2.2)"},0.4);', 2.0)
N["p-follow-through"] = page(bd, 'tl.fromTo("[data-role=badge]",{scale:0},{scale:1,duration:0.5,ease:"power2.out"},0.4);', 2.0)

# p-overlap
rows = "".join(f'<div class="abs card" data-role="row-{i+1}" style="left:510px;top:{225+i*130}px;width:900px;height:110px;font-size:36px;line-height:106px;padding-left:40px">Request {i+1}</div>' for i in range(5))
O["p-overlap"] = page(rows, 'tl.from("[data-role^=row]",{x:-700,opacity:0,duration:0.7,ease:"power3.out",stagger:0.09},0.4);', 2.6)
N["p-overlap"] = page(rows, 'tl.from("[data-role^=row]",{x:-700,opacity:0,duration:0.7,ease:"power3.out"},0.4);', 2.6)

# p-squash-stretch: drop 620 px, bounces of 300, 140, 60 px.
ball = ('<div class="abs" data-role="floor" style="left:0;top:879px;width:1920px;height:2px;background:#DDDFE4"></div>'
        '<div class="abs" data-role="ball" style="left:890px;top:740px;width:140px;height:140px;border-radius:50%;background:#D44027;transform-origin:50% 100%"></div>')
sq = """
const b = "[data-role=ball]";
gsap.set(b, {y:-620, transformOrigin:"50% 100%"});
let t = 0.3; const H = [620, 300, 140, 60];
const fall = (h) => 0.45 * Math.sqrt(h / 620);
for (let k = 0; k < H.length; k++) {
  const d = fall(H[k]);
  if (k > 0) { tl.to(b, {y:-H[k], duration:d, ease:"power2.out"}, t); t += d; }
  tl.to(b, {y:0, duration:d, ease:"power2.in"}, t);
  tl.to(b, {scaleY:1 + 0.12 * H[k] / 620, scaleX:1 / (1 + 0.12 * H[k] / 620), duration:d * 0.35, ease:"sine.in"}, t + d * 0.65);
  t += d;
  const s = 0.2 * Math.sqrt(H[k] / 620) + 0.05;
  tl.to(b, {scaleY:1 - s, scaleX:1 / (1 - s), duration:0.04, ease:"power2.out"}, t);
  tl.to(b, {scaleY:1, scaleX:1, duration:0.06, ease:"power2.inOut"}, t + 0.04);
  t += 0.06;
}
"""
O["p-squash-stretch"] = page(ball, sq, 4.0)
N["p-squash-stretch"] = page(ball, sq.replace("scaleY:1 + 0.12 * H[k] / 620, scaleX:1 / (1 + 0.12 * H[k] / 620)", "scaleY:1, scaleX:1").replace("scaleY:1 - s, scaleX:1 / (1 - s)", "scaleY:1, scaleX:1"), 4.0)

# p-arcs
dot = '<div class="abs" data-role="dot" style="left:260px;top:780px;width:80px;height:80px;border-radius:50%;background:#D44027"></div>'
O["p-arcs"] = page(dot, 'const d="[data-role=dot]"; tl.to(d,{x:1320,duration:1.3,ease:"power1.inOut"},0.4).to(d,{y:-420,duration:0.65,ease:"power2.out"},0.4).to(d,{y:0,duration:0.65,ease:"power2.in"},1.05);', 2.4)
N["p-arcs"] = page(dot, 'tl.to("[data-role=dot]",{x:1320,duration:1.3,ease:"power2.inOut"},0.4);', 2.4)

# p-secondary-action
sc = ('<div class="abs card" data-role="card" style="left:700px;top:380px;width:520px;height:320px">'
      '<div class="abs" data-role="tag" style="left:24px;top:-24px;width:90px;height:130px;background:#D44027;border-radius:12px;transform-origin:45px 18px">'
      '<div class="abs" style="left:37px;top:10px;width:16px;height:16px;border-radius:50%;background:#FDFDFD"></div></div></div>')
O["p-secondary-action"] = page(sc, '''tl.from("[data-role=card]",{x:1300,duration:1.0,ease:"power3.out"},0.2);
const g="[data-role=tag]";
tl.to(g,{rotation:9,duration:0.55,ease:"sine.inOut"},0.45).to(g,{rotation:16,duration:0.3,ease:"sine.out"})
  .to(g,{rotation:-8,duration:0.4,ease:"sine.inOut"}).to(g,{rotation:4,duration:0.35,ease:"sine.inOut"})
  .to(g,{rotation:-1.5,duration:0.3,ease:"sine.inOut"}).to(g,{rotation:0,duration:0.3,ease:"sine.inOut"});''', 3.0)
N["p-secondary-action"] = page(sc, 'tl.from("[data-role=card]",{x:1300,duration:1.0,ease:"power3.out"},0.2);', 3.0)

# p-staging
words = ["Clear language.", "Useful details.", "One coral accent."]
lines = "".join(f'<div class="abs h" data-role="line-{i+1}" style="left:0;width:1920px;top:478px;text-align:center;opacity:0"><span style="display:inline-block">{w}</span></div>' for i, w in enumerate(words))
lines_inline = "".join(f'<div class="abs" style="left:0;width:1920px;top:478px;text-align:center"><span class="h" data-role="line-{i+1}" style="display:inline-block;opacity:0">{w}</span></div>' for i, w in enumerate(words))
O["p-staging"] = page(lines_inline, '''const L=[1,2,3].map(i=>`[data-role=line-${i}]`);
tl.fromTo(L[0],{opacity:0,y:24},{opacity:1,y:0,duration:0.4,ease:"power2.out"},0.2).to(L[0],{opacity:0,duration:0.3},1.8)
  .fromTo(L[1],{opacity:0,y:24},{opacity:1,y:0,duration:0.4,ease:"power2.out"},2.1).to(L[1],{opacity:0,duration:0.3},3.7)
  .fromTo(L[2],{opacity:0,y:24},{opacity:1,y:0,duration:0.4,ease:"power2.out"},4.0);''', 6.0)
N["p-staging"] = page(lines_inline, '''const L=[1,2,3].map(i=>`[data-role=line-${i}]`);
tl.to(L[0],{opacity:1,duration:0.2},0.2).to(L[1],{opacity:1,duration:0.2},0.6).to(L[2],{opacity:1,duration:0.2},1.0);''', 6.0)

# s-pan
world = ('<div class="abs" data-role="world" style="left:0;top:0;width:5760px;height:1080px;background:#F9F9FA">' +
         "".join(f'<div class="abs" style="left:{i*1920}px;top:0;width:1920px;height:1080px;display:flex;align-items:center;justify-content:center"><span class="h" data-role="station-{i+1}">{w}</span></div>' for i, w in enumerate(["Request", "Route", "Reply"])) + '</div>')
O["s-pan"] = page(world, 'const w="[data-role=world]"; tl.to(w,{x:-1920,duration:1.2,ease:"expo.inOut"},1.2).to(w,{x:-3840,duration:1.2,ease:"expo.inOut"},3.6);', 6.0)
N["s-pan"] = page(world, 'const w="[data-role=world]"; tl.to(w,{x:-1920,duration:1.2,ease:"sine.inOut"},1.2).to(w,{x:-3840,duration:1.2,ease:"sine.inOut"},3.6);', 6.0)

# s-continuity
cont = ('<div class="abs" data-role="line" style="left:952px;top:532px;width:16px;height:16px;border-radius:8px;background:#D44027;transform:scale(0)"></div>'
        '<div class="abs" style="left:0;width:1920px;top:452px;text-align:center"><span class="h" data-role="headline" style="display:inline-block;opacity:0">One API.</span></div>')
O["s-continuity"] = page(cont, '''const l="[data-role=line]", h="[data-role=headline]";
tl.to(l,{scale:1,duration:0.35,ease:"back.out(2)"},0.2)
  .to(l,{left:120,width:1680,top:539,height:2,borderRadius:1,duration:0.7,ease:"power3.inOut"},0.75)
  .to(l,{top:619,left:700,width:520,duration:0.8,ease:"power3.inOut"},1.6)
  .fromTo(h,{y:60,opacity:0},{y:0,opacity:1,duration:0.7,ease:"power3.out"},1.85);''', 4.0)
N["s-continuity"] = page(cont, '''const l="[data-role=line]", h="[data-role=headline]";
tl.to(l,{scale:1,duration:0.35,ease:"back.out(2)"},0.2)
  .set(l,{left:120,width:1680,top:539,height:2,borderRadius:1},0.9)
  .set(l,{top:619,left:700,width:520},1.6)
  .fromTo(h,{opacity:0},{opacity:1,duration:0.4},1.85);''', 4.0)

# s-stream
toks = json.load(open(os.path.join(TASKS, "s-stream", "tokens.json")))
stream = ('<pre class="abs" style="left:120px;top:96px;width:1680px;margin:0;font-family:\'JetBrains Mono\';font-size:30px;line-height:44px;color:#FDFDFD;white-space:pre-wrap">'
          '<span data-role="reply"></span><span data-role="cursor" style="display:inline-block;width:16px;height:34px;vertical-align:-6px;background:#D44027"></span></pre>')
def stream_js(rate):
    return f'''const T={json.dumps(toks)};
const r=document.querySelector("[data-role=reply]"), c=document.querySelector("[data-role=cursor]");
const p={{k:0}};
const draw=()=>{{ r.textContent=T.slice(0,Math.floor(p.k+1e-6)).join(""); }};
draw();
tl.to(p,{{k:T.length,duration:T.length/{rate},ease:"none",onUpdate:draw}},0.5);'''
O["s-stream"] = page(stream, stream_js(340), 4.0, bg="#1B202A")
N["s-stream"] = page(stream, stream_js(90), 4.0, bg="#1B202A")

# s-count
cnt = ('<div class="abs" style="left:0;top:330px;width:1920px;text-align:center">'
       '<div data-role="value" style="display:inline-block;font-family:\'JetBrains Mono\';font-size:220px;line-height:1;color:#BB3822">0</div>'
       '<div style="font-size:36px;color:#5B616D;margin-top:24px">requests today</div></div>')
def count_js(ease, fn):
    return f'''const v=document.querySelector("[data-role=value]"), p={{n:0}};
tl.to(p,{{n:1284,duration:1.6,ease:"{ease}",onUpdate:()=>{{v.textContent={fn}(p.n).toLocaleString("en-US");}}}},0.4);'''
O["s-count"] = page(cnt, count_js("power3.out", "Math.floor"), 3.0)
N["s-count"] = page(cnt.replace("'JetBrains Mono'", "'Open Sauce Two'"), count_js("none", "Math.round"), 3.0)

# s-curtain
cur = ('<div class="abs" style="inset:0;background:#F9F9FA;display:flex;align-items:center;justify-content:center"><span class="h" data-role="headline-a">One API.</span></div>'
       '<div class="abs" id="b" style="inset:0;background:#1B202A"><div class="abs" data-role="prompt-b" style="left:120px;top:516px;font-family:\'JetBrains Mono\';font-size:32px;color:#FDFDFD;white-space:nowrap">$ curl https://inference.coralbricks.ai/v1/chat/completions</div></div>')
O["s-curtain"] = page(cur, 'gsap.set("#b",{y:1080}); tl.to("#b",{y:0,duration:0.7,ease:"power3.inOut"},1.0);', 3.0)
N["s-curtain"] = page(cur, 'gsap.set("#b",{opacity:0}); tl.to("#b",{opacity:1,duration:0.7},1.0);', 3.0)

# s-beat
bw = ["All", "models,", "one", "API."]
beat = ('<div class="abs h" style="left:0;top:478px;width:1920px;display:flex;justify-content:center;gap:28px">' +
        "".join(f'<span data-role="word-{i+1}" style="display:inline-block;opacity:0">{w}</span>' for i, w in enumerate(bw)) + '</div>')
O["s-beat"] = page(beat, '''for (let i=0;i<4;i++){ const w=`[data-role=word-${i+1}]`, beat=0.5+i*0.5;
  tl.fromTo(w,{y:-90,opacity:0},{y:0,duration:0.22,ease:"power2.in"},beat-0.22).to(w,{opacity:1,duration:0.08,ease:"none"},beat-0.22); }''', 3.0)
N["s-beat"] = page(beat, '''for (let i=0;i<4;i++){ const w=`[data-role=word-${i+1}]`, beat=0.5+i*0.5;
  tl.fromTo(w,{y:60,opacity:0},{y:0,opacity:1,duration:0.35,ease:"power3.out"},beat); }''', 3.0)

# s-lockup
lk = ('<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center;gap:56px">'
      '<img data-role="mark" src="assets/logo-icon.svg" style="height:260px;width:auto;transform:scale(0)">'
      '<span data-role="wordmark" style="font-weight:700;font-size:150px;letter-spacing:-0.025em;line-height:1;color:#0A0C11;opacity:0">CoralBricks</span></div>')
O["s-lockup"] = page(lk, '''tl.to("[data-role=mark]",{scale:1,duration:0.7,ease:"back.out(2)"},0.3)
  .set("[data-role=wordmark]",{opacity:1},0.85)
  .fromTo("[data-role=wordmark]",{x:-60,clipPath:"inset(0% 100% 0% 0%)"},{x:0,clipPath:"inset(0% 0% 0% 0%)",duration:0.6,ease:"power3.out",immediateRender:false},0.85);''', 3.0)
N["s-lockup"] = page(lk.replace('<img data-role="mark" src="assets/logo-icon.svg" style="height:260px;width:auto;transform:scale(0)">', '<div data-role="mark" style="width:260px;height:260px;border-radius:50%;background:#D44027;transform:scale(0)"></div>').replace("font-weight:700", "font-weight:600"),
    '''tl.to("[data-role=mark]",{scale:1,duration:0.5,ease:"power2.out"},0.3).to("[data-role=wordmark]",{opacity:1,duration:0.4},0.3);''', 3.0)

# s-rise
rise = ('<div class="abs" style="left:120px;top:300px;height:125px;overflow:hidden"><span class="h" data-role="line-1" style="display:inline-block;line-height:125px">Clear language.</span></div>'
        '<div class="abs" style="left:120px;top:425px;height:125px;overflow:hidden"><span class="h" data-role="line-2" style="display:inline-block;line-height:125px">Useful <span data-role="accent" style="color:#BB3822">details.</span></span></div>')
O["s-rise"] = page(rise, 'tl.from("[data-role=line-1]",{y:125,duration:0.8,ease:"power3.out"},0.3).from("[data-role=line-2]",{y:125,duration:0.8,ease:"power3.out"},0.45);', 3.0)
N["s-rise"] = page(rise.replace("overflow:hidden", "overflow:visible"), 'tl.from("[data-role=line-1]",{y:125,opacity:0,duration:0.8,ease:"power3.out"},0.3).from("[data-role=line-2]",{y:125,opacity:0,duration:0.8,ease:"power3.out"},0.45);', 3.0)

for kind, D in (("oracle", O), ("naive", N)):
    for tid, html in D.items():
        d = os.path.join(HERE, kind, tid); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w").write(html)
print(len(O), "oracle,", len(N), "naive")

# Broken pieces: each must fail the contract check named in its folder.
B = {}
base = 'tl.to("[data-role=card]",{x:1280,duration:1.0,ease:"power2.inOut"},0.5);'
B["shake"] = page(card, base + ''' for (let i=0;i<8;i++) tl.to("#stage",{x:(i%2?-2:2),duration:0.05,ease:"none"},2.3+i*0.05); tl.to("#stage",{x:0,duration:0.05},2.7);''', 3.0)
B["random"] = page(card, base + ''' const p={v:0}; tl.to(p,{v:1,duration:3,onUpdate:()=>{document.querySelector("[data-role=card]").style.marginTop=(Math.random()*6)+"px";}},0);''', 3.0)
B["glow"] = page(card.replace('class="abs card"', 'class="abs card" style2'), base, 3.0, css=".card{box-shadow:0 0 40px rgba(212,64,39,0.6);background-image:linear-gradient(#FDFDFD,#F5D1CB)}")
B["palette"] = page(card.replace('class="abs card"', 'class="abs card" ') + '<div class="abs" style="left:120px;top:120px;font-size:36px;color:#000">Hello</div>', base, 3.0, css=".card{background:#FFFFFF}")
B["cdn"] = page(card, base, 3.0).replace('src="assets/gsap.min.js"', 'src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"')
for tid, html in B.items():
    d = os.path.join(HERE, "broken", tid); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w").write(html)
