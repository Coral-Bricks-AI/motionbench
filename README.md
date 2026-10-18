# motionbench

Can a model animate? Sixteen short motion-graphics briefs, each built by a model as an HTML/GSAP
composition in an agent harness, then measured frame by frame and scored by code. No model judges
anything.

Results and live players: **[motionbench.sh](https://motionbench.sh)** · every run (compositions, grades
and run records): **[huggingface.co/datasets/coral-bricks-ai/motionbench](https://huggingface.co/datasets/coral-bricks-ai/motionbench)**

## Results (2026-10-18, 3 attempts per task)

| Model | Harness | **Score** (95% CI) | Launch film | Open Design | 16 tasks | Cost/task | Out tokens | Steps | Minutes |
|---|---|---|---|---|---|---|---|---|---|
| GPT-6.1 Sol | Codex CLI | **0.931** (0.911–0.950) | 0.890 | 0.967 | 0.981 | $0.130 | 5,380 | 10 | 2.1 |
| GLM-5.3 | Claude Code | **0.919** (0.907–0.929) | 0.862 | 1.000 | 0.939 | $0.262 | 26,520 | 20 | 3.1 |
| Claude Opus 5.5 | Claude Code | **0.913** (0.883–0.943) | 0.890 | 0.900 | 0.987 | $0.559 | 13,120 | 13 | 2.8 |
| Grok 4.7 | Claude Code | **0.884** (0.861–0.904) | 0.817 | 0.967 | 0.925 | $0.762 | 13,555 | 44 | 8.0 |
| Claude Haiku 5.5 | Claude Code | **0.879** (0.850–0.906) | 0.874 | 0.867 | 0.911 | $0.027 | 28,541 | 14 | 2.6 |
| Claude Sonnet 5.5 | Claude Code | **0.877** (0.856–0.901) | 0.817 | 0.933 | 0.945 | $0.281 | 14,633 | 12 | 2.3 |
| DeepSeek V4.1 Flash | Claude Code | **0.865** (0.843–0.887) | 0.843 | 0.833 | 0.968 | $0.071 | 43,836 | 38 | 7.7 |
| DeepSeek V4.1 Flash, no reasoning | Claude Code | **0.830** (0.754–0.886) | 0.785 | 0.933 | 0.790 | $0.043 | 21,802 | 50 | 6.3 |

Score = 50% the launch film (a founder's plain-words brief) + 30% Open Design's one-shape brief + 20% the 16 short tasks, each the share of its motion checks passed (3 attempts). The interval resamples tasks and attempts.

Cost/task = each run's tokens at the provider's list price (CoralBricks standard plan for DeepSeek and GLM), averaged; the Claude and GPT runs actually used subscriptions. Steps = tool calls. Minutes = wall time in the harness.

Craft = share of each task's own motion checks passed, averaged over tasks; 95% bootstrap interval over tasks. Contract = the shared format, determinism and brand checks.

## What it tests

**Two long briefs** (80% of the score):

| Task | Weight | What it is |
|---|---|---|
| `l-launch` | 50% | A founder who knows nothing about animation asks, in plain words, for a one-minute launch film: a ball that bounces "like a real rubber ball", a puck flicked "like in air hockey", a dot "tossed to a friend", a card whose luggage tag "keeps swinging", a list that comes in "smooth, not robotic", typing "at our model's real speed", a counter, a swipe to a terminal, words "with the music", the logo. No technique is named. The grader finds each scene by its tagged elements and applies the short tasks' checks without positions or timings the founder never gave. |
| `l-opendesign` | 30% | The starter prompt of Open Design's "One-Shape UI Motion" example ([nexu-io/open-design](https://github.com/nexu-io/open-design), Apache-2.0), verbatim, with Open Design's motion skill (`design-templates/hyperframes`) installed in the workspace and its Geist fonts. Checked: one shape on screen throughout and never cut, at least 10 forms, the cursor on the shape when each change begins, a tiny overshoot on at least 85% of changes (the brief's slider stretches on purpose), pixels moving on every beat at 120 BPM, the last frame equal to the first, black/white/warm-gray only, Geist only. |

The sixteen short tasks below make up the other 20%.

**One unguided piece** (`u-free`): "Make a motion graphic. Anything you like: it's yours. Show what you can do."
No brand, no brief, 10–30 seconds, the same toolkit. It has no task checks; it is read for polish and taste
(below), reported for how easily each model gets a working piece (working runs, minutes, tool calls), and it
goes into the blind vote.

**Polish and taste, on every run** (`grader/polish.mjs`), over every element on the page, tagged or not,
sampled at 30 fps. Reported beside the score, not inside it.

- Polish (a share of seven glitch checks): no tooling words on screen (export, render, MP4, fps or BPM
  counters, undefined…), nothing that flashes for one or two frames, no text sitting on other text for 0.3 s or
  more, no text cut off at rest by the frame or its box, every character present in its font (measured by
  canvas widths against bare fallbacks, in the text's own weight once its face has loaded), no empty screen of a second or more between the first and last thing
  shown, no text under 12 px held on screen.
- Taste (the mean of the rules that apply): Emil Kowalski's written rules
  ([7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips),
  [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations),
  [Agents with Taste](https://emilkowal.ski/ui/agents-with-taste)): scale-ins start at half size or more
  (his number is 0.9), entrances do not speed up into place, exits are no slower than entrances, UI changes
  stay within 400 ms (his 300) on the UI brief, the ellipsis character, tracked-out capitals, tabular figures
  for numbers that change, lines near 65 characters.

**The blind vote** (motionbench.sh/vote): two models' versions of the same long or free piece, unnamed, side by
side on one clock; names revealed after the vote; a vote within 8 s of the pair is not counted. The votes
become Elo ratings (Bradley–Terry strengths on Elo's scale: 1000 the average model, 400 points ten-to-one
odds) with 95% intervals from resampling the votes. The site's **overall** is 70% the invited panel's vote and
30% the checks, both as the chance of beating an average other model (preferred in the vote; on the checks, the
score coming out higher when both models' runs are resampled). Open votes
are recorded but do not count. It is preliminary until every model has 30 panel votes.

**Principles** (eight of the twelve animation principles that can be measured on a 2D frame):

| Task | Principle | What is measured |
|---|---|---|
| `p-ease` | slow in and slow out | speed at the start and end of a rest-to-rest move, against its peak |
| `p-anticipation` | anticipation | a wind-up the other way before the throw: depth, length, slower than the release |
| `p-follow-through` | follow-through and settle | overshoot of the final size, settle time, no ringing |
| `p-overlap` | overlapping action | five items: order, rhythm, each starting before the last has settled |
| `p-squash-stretch` | squash and stretch | flattening at contact, stretch along the fall, volume kept, gravity timing, decaying bounces |
| `p-arcs` | arcs | bulge of the path, one smooth turn, apex near the middle and slow, no corners |
| `p-secondary-action` | secondary action | a hanging tag swings forward as its card stops, lags, dies down, stays attached |
| `p-staging` | staging and readability | three lines one at a time: readable holds, never two competing, centred and safe |

**Studio** (the CoralBricks motion studio's own moves and rules, from its operating manual, brand frame
and client review notes):

| Task | Rule | What is measured |
|---|---|---|
| `s-pan` | precise camera pans between stations | exact holds, no drift or overshoot, expo-strength easing |
| `s-continuity` | continuity over cuts | one element from dot to hairline to divider, no jumps, the headline rising after |
| `s-stream` | real rates | 340 tokens/s against the clock, whole tokens only, a coral cursor at the end of the text |
| `s-count` | stepped counts | whole numbers with separators, never backwards, lands on time, ease-out, tabular digits |
| `s-curtain` | curtain wipes between surfaces | (pixels) rises from the bottom, one way, hard edge (no crossfade), eased |
| `s-beat` | every hit on the beat grid | each word *arrives* on its beat at 120 bpm (±2 frames) |
| `s-lockup` | the lockup | the real mark, the wordmark, centred and large, mark first with follow-through |
| `s-rise` | line-mask rises | (pixels) never seen outside its line, eased, staggered, one coral word |

Every task also checks the contract and the brand: it loads with no errors, works offline, has the
right duration, tags every role once, draws the same frame whatever order it is seeked in (roles exact,
pixels differing on under 0.5% of the frame), uses no clocks/randomness/CSS animation, no glow, blur or
gradients, only the palette's colours, only the brand fonts, ends with text inside title-safe, and has no
jitter or shake.

A task's score is the share of its checks passed. `craft` is the share of the task's own checks;
`contract` the share of the shared ones.

## How a run works

`run.py` builds a workspace per run (`workspace.py`): `BRIEF.md`, `CONTRACT.md`, `BRAND.md`, the brand fonts,
the CoralBricks mark, GSAP 3.15 and two tools: `tools/probe.mjs` prints exactly what the grader measures
(boxes, opacity, rotation, visible text, colours, effects) at chosen times, and `tools/snap.mjs` saves
frames as PNGs. The checks and their thresholds are never in the workspace.

Each short task gets 30 minutes (the long briefs and the free piece 60) and effort high, and every harness runs inside the same macOS `sandbox-exec`
profile (`run.py: seatbelt()`): reads and writes only in the run's workspace and a throwaway harness
config (plus the toolchain, the kit and the headless browser), nothing else in the home folder or the
shared temp folders, and network only to localhost, where `connect_proxy.py` tunnels to the model
provider's hosts and nothing else.

- **Claude Code 2.1** (`--safe-mode`: no CLAUDE.md, skills, plugins, hooks or MCP; a fresh
  `CLAUDE_CONFIG_DIR`; tools Bash/Read/Write/Edit/Glob/Grep; credentials scrubbed from the shell) for Claude
  Opus 5.5, Sonnet 5.5 and Haiku 5.5 (the Claude subscription's OAuth token, read from Claude Code's own
  keychain entry at launch), and for DeepSeek V4.1 Flash and GLM-5.3 on CoralBricks (`deepseek-v4.1-flash-fast`,
  `glm-5.3-fast`) through its Anthropic Messages API with `CORALBRICKS_API_KEY`. The gateway ignored Claude
  Code's `thinking: {type: "adaptive"}` + `output_config.effort` for DeepSeek (2026-10-18), so `deepseek` and
  `glm` go through `thinking_proxy.py`, which rewrites that into `thinking: {type: "enabled", budget_tokens:
  24576}`; `deepseek-plain` keeps Claude Code's request as sent (no reasoning). The gateway also refused
  images inside a `tool_result` (an agent opening its own snapshot ended the session), so the proxy moves
  them into the same user turn for every gateway run; GLM-5.3 takes no images at all there, so its images
  are replaced by a note saying so. Grok 4.7 runs through xAI's Messages API, which rejects Claude Code's
  mid-conversation system-role messages, so the proxy folds those into the neighbouring user turn.
- **Codex CLI 0.162** for GPT-6.1 Sol (its own harness) on a ChatGPT login (`MOTIONBENCH_CODEX_AUTH` = a Codex
  `auth.json`, copied into a throwaway `CODEX_HOME`).

Claude Code's own sandbox was tried first and dropped: Chromium cannot register its Mach port inside it,
so the agents' probe and snap tools failed in almost every run while Codex's worked. All Claude Code runs
were redone in the shared profile.

`grader/grade.mjs` opens `index.html` in headless Chromium (Playwright 1.63, blocked network), seeks the
timeline to every frame at 60 fps, measures every role, scans colours and effects four times a second,
takes the pixels a task needs, and checks seeking out of order and after a fresh load.

## Commands

```sh
cd kit && npm install && npx playwright-core install chromium-headless-shell   # gsap 3.15, playwright-core 1.63, pngjs
python3 tasks/_make.py                     # (re)write the task folders
python3 selftest/_make.py && python3 selftest/run.py   # oracle must be 1.000 everywhere; naive must lose craft only
CORALBRICKS_API_KEY=… MOTIONBENCH_CODEX_AUTH=… python3 run.py --models opus,gpt-sol,sonnet,glm,deepseek,haiku,deepseek-plain --attempts 3
python3 report.py --json results/summary.json
```

## Self-test

`selftest/oracle/` holds a reference solution per task (all 1.000). `selftest/naive/` holds the classic
mistake per task (linear moves, no wind-up, no overshoot, all rows at once, no squash, a straight path, a
rigid tag, everything on screen at once, sine pans, cuts between shapes, a readable 90 tok/s, a linear
proportional count, a crossfade, moves that start on the beat, a redrawn mark, a fade without a mask):
each loses its task's craft checks and keeps a full contract score. `selftest/broken/` checks that the
contract catches shake, randomness, glow and gradients, off-palette colours and a CDN dependency.

## Checks changed after models ran (2026-10-18)

The pass marks were set, and the self-test passed, before any model ran. Looking at the first model runs
showed checks that measured the wrong thing; each was fixed, the self-test re-run, and **every** saved run
re-graded from its `index.html` (`regrade.py`), so all runs are judged by the same checks:

- `p-anticipation`: the puck had to be still from 2.1 s, which the brief never says; now at rest over the last 0.15 s.
- `p-secondary-action`: "each swing smaller" counted a backward lag during the card's acceleration as the
  first swing; now only swings after the biggest must shrink.
- `s-continuity`: a masked headline counted as visible from frame 0; its entrance is now when it starts to
  move. A full-width divider under a left-aligned headline now counts as "under it". A cut is an edge jump of
  400 px or more in one frame (was 140, which a fast stretch exceeds).
- `s-rise`: the rise is measured from where the line is parked before it rises (a model whose first `set`
  is not applied at frame 0 measured as not rising at all).
- `s-curtain`: the start window is 0.95–1.25 s (was 1.15): a strong ease-in on a curtain started at 1.0 s
  shows nothing until about 1.18 s.
- Determinism: Chrome rasters text and rescaled images slightly differently depending on compositor layers
  and seek history. Text is now drawn with grayscale antialiasing, roles must match exactly, and pixels may
  differ on at most 0.5% of the frame (a stuck mask or a missing layer is far more).
- Jitter: only motion that both opposite edges of an element share counts (layout rounding in a resize
  nudged one edge at a time and was flagged as shake).

After the first long-brief runs (same rule: every run re-graded, the self-test re-run):

- A scene in a film leaves. Its checks now stop at its last stretch of stillness (≥ 0.15 s with one of its
  elements fully shown) instead of its last visible frame, which had read exit animations as final states.
- The founder's puck is "flicked… like in air hockey": a struck puck has no wind-up of its own, so it is
  judged as struck (fast off the hit, gliding to a stop), with a pull-back allowed but not required.
- Plain words get plain tolerances: "a small dot in the middle" within 140 px of the centre, "a long line" up
  to 12 px thick and anywhere, the music line not required to be centred, the chat answer not required in
  mono (the brand sheet keeps mono for code and figures, not long copy).
- An arc is judged on the flight, from the toss to the first touch back at landing height, so a hop after
  landing is not counted as a second arc (this applies to `p-arcs` too).
- Open Design's brief: the canvas must be "a light warm gray" (the exact hex was from Open Design's example,
  not the prompt), and a dark drop shadow of any tint is allowed (its art direction asks for one).
- Claude Code's per-reply output cap was raised from 32k to 64k tokens for every model after one GLM run ended
  on it (a 24k reasoning budget plus a whole page in one write); runs that ended on the cap were run again.

After the first polish and taste pass (2026-10-19, every run re-graded):

- Missing glyphs: the check measured every text at weight 400 and without waiting for its face to load, so a
  page that declared a font only at other weights read as drawing every letter in a fallback (11 of 24
  free runs failed it, all falsely). Each text is now measured in its own style and weight once that face has
  loaded; the planted glitch (a character the font lacks) is still caught.
- A new contract check: every tagged role is on screen at some moment (half its width and height visible,
  or half the frame's for a strip wider than it), after clipping by the frame and by overflow-clipping
  ancestors. One run (Grok, `s-rise` a3) had put each line in a zero-width `overflow: hidden` mask: its
  measured boxes rose exactly as briefed and nothing was ever drawn, so it had passed every motion check. A page
  that never shows any of its tagged elements now fails its motion checks too (only that run).
- Grading moved from a Mac to Linux (`cloud_grade.py`, Modal, Playwright's image with the same Chromium
  build), which is what a render machine runs. 437 of 456 runs grade identically. The rest: Geist lacks ⌘,
  ↵, ↑, ↓ and arrows, which macOS font fallback had hidden (13 more Open Design runs now fail "every character is
  in its font", 15 in all); one page asked for `OpenSauceTwo-Semibold.ttf` (the file is `SemiBold`), which only a
  case-insensitive Mac finds; one text overlap from a fallback glyph; two Grok runs that drifted on a fresh
  load on the Mac do not on Linux.

Kept as set, though a reader may disagree: `s-beat` scores when a word visibly *arrives* (within 3% of its
travel), so an ease-out that ends on the beat lands early. The brief's own words ("arrives (finishes coming
in) exactly on the beat") lean the other way; most models ended an ease-out on the beat.

## Limits

- Four of the twelve principles are not here (exaggeration, solid drawing, appeal, straight-ahead vs
  pose-to-pose): none has a measurement that would not be a matter of taste.
- The checks measure what the motion does, not whether it is beautiful. A piece can pass every check
  and still be dull; look at the contact sheets (`results/<model>/<task>/a<N>/sheet.png`).
- Harnesses differ: GPT runs in Codex, everything else in Claude Code, which is Anthropic's and tuned for
  Claude. The workspace, brief, tools and grading are identical.
- macOS only as written (the sandbox is `sandbox-exec`).

## License

MIT (see LICENSE). The fonts in `kit/assets/fonts` and `tasks/l-opendesign/ws/assets/fonts` are under the SIL Open
Font License (texts alongside). `tasks/l-opendesign/ws/skills/open-design-hyperframes/` is Open Design's motion skill,
unchanged, under Apache-2.0 (its LICENSE and SOURCE.md alongside).
The CoralBricks mark in `kit/assets/logo-icon.svg` is Coral Bricks AI's and is here only for the lockup task.
