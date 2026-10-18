# The contract

You are making one short motion graphic as an HTML composition. Deliver **`index.html` in this folder**.

## Format

- One 1920×1080 frame (`body` margin 0, the stage exactly 1920×1080, nothing scrolls).
- Animate with GSAP: `assets/gsap.min.js` (plugins `assets/CustomEase.min.js` and `assets/MotionPathPlugin.min.js` are there if you want them). Load them with relative paths.
- Build **one paused timeline**, synchronously on load, and register it:

  ```js
  const tl = gsap.timeline({ paused: true });
  // ... tweens ...
  window.__timelines = window.__timelines || {};
  window.__timelines.main = tl;
  ```

  The timeline's duration must equal the brief's duration (pad the end with an empty tween or `tl.set({}, {}, duration)` if needed).
- The picture must be a pure function of timeline time. The renderer seeks the timeline to any time, in any order, and captures the frame. So: no `Date.now()`, `Math.random()`, `performance.now()`, `requestAnimationFrame` loops, timers, `repeat: -1`, CSS animations or CSS transitions. Anything computed from time goes in a tween's `onUpdate` or a proxy object tweened by the timeline.
- Offline: everything comes from this folder. Requests to anywhere else are blocked. The page is opened from `file://`, where scripts cannot `fetch` or `XMLHttpRequest` local files, so put any data you need (for example a JSON file from `assets/`) into `index.html` itself.
- Fonts are in `assets/fonts/` (load them with `@font-face`). Brand rules are in `BRAND.md`.

## Roles

The brief names the elements that matter and gives each a role. Put `data-role="<name>"` on that element, once per role. Put the role on the element that actually moves, not on a wrapper or mask that stays put.

For each role the renderer measures, at every frame (60 fps):

- its box on screen (`getBoundingClientRect`), so position, size and scale;
- its effective opacity (its own times all its ancestors'; `display:none` and `visibility:hidden` count as 0);
- its rotation on screen;
- its visible text: the text of its descendant text nodes whose element is shown at opacity ≥ 0.5. Text that is in the DOM but hidden by a clip or mask still counts as visible, so reveal text by adding it or by hiding the rest with opacity, visibility or display;
- its colours and font.

The whole frame is also captured as pixels.

## Tools

- `node tools/probe.mjs --at 0,0.5,1` or `--every 0.1` (optionally `--roles a,b`, `--json`): prints what is measured for each role at those times, plus page errors, blocked requests, the timeline's duration, and the colours, fonts and effects on screen.
- `node tools/snap.mjs --at 0.5,1.2` or `--every 0.25` (`--sheet` for one contact sheet): saves PNG frames to `snaps/`, which you can open to look at.

When `index.html` is finished, stop.
