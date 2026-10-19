# Experimental narration task

This task adds a production constraint to the existing stepped counter: land a
number on a supplied narration cue while preserving the qualifier and source.
All copy is synthetic. The cue sheet is ground truth, not an audio alignment
or fact-checking test.

The underscore keeps this task out of `run.py`'s default task list. It does not
replace a scored task or revise any published result. To run agents on macOS,
select it explicitly:

```sh
python3 run.py --tasks _spoken-stat --models haiku,deepseek --attempts 3
```

Keep experimental results separate from published leaderboard summaries:
`report.py` aggregates all files under `results/`, including explicit experimental
runs. Move those runs to a separate results archive before producing a standard
summary. The new `experimental` track is not a leaderboard claim.

Checks reuse `count` and add `narrated_stat`: first visible final value within
two frames of the cue, exact final value throughout the reading window, exact
qualifier and source, minimum box heights, title-safe placement, no overflow
clipping, and no overlap between the three roles. These are DOM measurements;
they do not prove contrast, pixel visibility behind another layer, or whether
the composition looks good. The existing polish pass and human viewing still
matter. CSS clip paths are not modeled by the role probe.

## Validate

Install the locked kit and Chromium as described in the root README, then:

```sh
node --test selftest/narration.test.mjs
python3 selftest/narration_render.py
```

The browser controls assert a perfect reference, a naive solution that loses
craft while retaining the shared contract, and an overflow-clipped source that
fails. The browser test copies locked dependencies into disposable workspaces,
so it also works without Windows symlink privileges. This does not port the
macOS-only agent runner or weaken its isolation.

The numeric controls cover missing and changed copy, one-frame visibility
failures, early and late landing, undersized or unsafe text, overlap, and
incomplete measurements. They run without browser dependencies.
