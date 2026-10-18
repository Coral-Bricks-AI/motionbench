# Brand (CoralBricks motion studio)

"Clear language. Useful details. Familiar type. Neutral surfaces. One coral accent."

## Frame

1920×1080 at 60 fps. Margins 120 px; keep text inside title-safe (96 px left/right, 54 px top/bottom). Left-aligned type on a shared baseline, anchored to the left margin and an optical upper third, unless a brief asks for something centred.

## Colour (use only these)

- Surfaces: off-white `#F9F9FA` (claim, proof, brand beats); charcoal `#1B202A` only for code and terminals.
- Ink: `#0A0C11` for headlines and the wordmark on off-white. Secondary text `#5B616D`. Hairlines `#DDDFE4`.
- On charcoal: text `#FDFDFD` or `#F9F9FA`, secondary `#8A909C`, raised panel `#232937`, hairlines `#2C3342`.
- Coral is the single accent: a word, the one key number, the cursor, the call to action. Fills, dots and the CTA use `#D44027`; coral text on light surfaces uses `#BB3822`. Never a coral background block. At most one or two coral things per frame.
- Full ramps, if you need a step: coral 50 `#FCF4F2` · 100 `#FAE8E5` · 200 `#F5D1CB` · 300 `#EAA397` · 400 `#E07563` · 500 `#D44027` · 600 `#BB3822` · 700 `#A1311E` · 800 `#882919` · 900 `#6E2114` · 950 `#4C170E`; grays 50 `#F9F9FA` · 300 `#DDDFE4` · 400 `#C3C6CC` · 500 `#AFB3BB` · 600 `#8C929C` · 700 `#5B616D` · 900 `#1B202A` · 950 `#0A0C11`.

## Type

- Open Sauce Two for everything (`assets/fonts/OpenSauceTwo-{Regular,Medium,SemiBold,Bold}.ttf`; weights 400, 500, 600, 700). Contrast by weight (400 against 600); 700 for the wordmark. Display tracking −0.025em. Sizes: hero 200 px, headline 104 px, sub 56 px, body 36 px.
- JetBrains Mono (`assets/fonts/JetBrainsMono-{Regular,Medium}.woff2`; 400, 500) only for code, keys, model IDs and measurements. Sizes: code 32 px, label 22 px.
- One idea per frame; at most three text elements in a frame.

## Motion

Motion-led, not a slideshow, but exact, never sloppy.

- Continuity over cuts: elements carry across (a dot becomes a hairline becomes a divider; a pane slides to take the frame; a curtain of the next surface rises).
- Real rates: inference is shown at its true speed, 340 tokens per second (about 6 tokens per frame). It should be barely possible to keep up.
- Allowed moves: line-mask rises, character and word staggers, stepped counts, per-digit odometers, SVG path draws, clip-path reveals, precise camera pans (expo in-out) between stations of one world, curtain wipes between surfaces.
- Every hit lands on the beat grid.
- Banned: glow, decorative gradients, camera shake or jolts, blur smears, drifting or scaling grids, jitter, HUD clutter, registration marks or rulers as decoration. Elevation, if you need it, is a soft charcoal shadow at a few percent opacity, never a coloured one.

## The mark

`assets/logo-icon.svg` is the CoralBricks mark (a coral magnifier). Use the file as it is; never redraw it. The lockup is the mark next to "CoralBricks" in Open Sauce Two Bold, ink `#0A0C11`, centred and large.
