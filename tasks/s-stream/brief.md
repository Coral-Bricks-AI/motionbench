# Stream the reply

1920×1080, 60 fps, **4.0 s**. Read `CONTRACT.md` (format, roles, tools) and `BRAND.md` (colours, type, motion rules) first.


A terminal on the charcoal surface (the whole frame is charcoal `#1B202A`). A model's reply streams into it at the real rate: **340 tokens per second**, starting at **0.5 s**. The reply is in `assets/tokens.json`: 250 tokens, in order; joined, they are the text (with its line breaks). Show it exactly as given, revealing whole tokens, never part of one, in the mono face at a size that fits the whole reply on screen inside title-safe.

A coral cursor (a block or bar) sits just after the last character while the reply streams. After the reply is complete it can stay or go.

Roles: `reply` (the element holding the streamed text), `cursor`.
