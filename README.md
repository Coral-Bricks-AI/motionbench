# motionbench

Can a model animate? Sixteen short motion-graphics briefs, each built by a model as an HTML/GSAP
composition in an agent harness, then measured frame by frame and scored by code. No model judges
anything.

Results and live players: **[motionbench.sh](https://motionbench.sh)** · every run (compositions, grades
and run records): **[huggingface.co/datasets/coral-bricks-ai/motionbench](https://huggingface.co/datasets/coral-bricks-ai/motionbench)**

## Results (2026-10-18, 3 attempts per task)

| Model | Harness | Craft (95% CI) | Contract | Perfect runs | Cost/task | Out tokens | Steps | Minutes |
|---|---|---|---|---|---|---|---|---|
| Claude Opus 5.5 | Claude Code | **0.987** (0.969–1.000) | 1.000 | 44/48 | $0.277 | 6,198 | 9 | 1.4 |
| GPT-6.1 Sol | Codex CLI | **0.981** (0.956–1.000) | 1.000 | 42/48 | $0.084 | 2,496 | 8 | 1.2 |
| DeepSeek V4.1 Flash | Claude Code | **0.968** (0.944–0.989) | 0.996 | 37/48 | $0.044 | 27,748 | 27 | 4.8 |
| Grok 4.7 | Claude Code | **0.946** (0.907–0.980) | 0.989 | 28/48 | $0.502 | 10,268 | 32 | 7.3 |
| Claude Sonnet 5.5 | Claude Code | **0.945** (0.906–0.978) | 0.996 | 33/48 | $0.102 | 4,682 | 9 | 0.8 |
| GLM-5.3 | Claude Code | **0.937** (0.895–0.972) | 0.992 | 30/48 | $0.150 | 16,486 | 16 | 2.0 |
| Claude Haiku 5.5 | Claude Code | **0.911** (0.863–0.956) | 0.992 | 26/48 | $0.017 | 16,691 | 12 | 1.6 |
| DeepSeek V4.1 Flash, no reasoning | Claude Code | **0.787** (0.725–0.855) | 0.977 | 15/48 | $0.018 | 8,028 | 34 | 2.7 |

Cost/task = each run's tokens at the provider's list price (CoralBricks standard plan for DeepSeek and GLM), averaged; the Claude and GPT runs actually used subscriptions. Steps = tool calls. Minutes = wall time in the harness.

Craft = share of each task's own motion checks passed, averaged over tasks; 95% bootstrap interval over tasks. Contract = the shared format, determinism and brand checks.

## What it tests

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

Each run gets 30 minutes and effort high, and every harness runs inside the same macOS `sandbox-exec`
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

MIT (see LICENSE). The fonts in `kit/assets/fonts` are under the SIL Open Font License (texts alongside).
The CoralBricks mark in `kit/assets/logo-icon.svg` is Coral Bricks AI's and is here only for the lockup task.
