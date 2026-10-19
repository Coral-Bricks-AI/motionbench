"""Browser controls for the opt-in task: python selftest/narration_render.py.

Copies the three locked kit packages into disposable workspaces, avoiding the
symlink privilege required by make_workspace on Windows. No model calls.
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from workspace import make_workspace


def grade(html):
    with tempfile.TemporaryDirectory(prefix="motionbench narration %- ") as temp:
        ws = Path(temp) / "ws"
        shutil.copytree(ROOT / "kit/node_modules", ws / "node_modules")
        make_workspace("_spoken-stat", str(ws))
        (ws / "index.html").write_text(html, encoding="utf-8")
        out = Path(temp) / "grade"
        completed = subprocess.run(
            ["node", str(ROOT / "grader/grade.mjs"), str(ws),
             str(ROOT / "tasks/_spoken-stat"), "--out", str(out)],
            capture_output=True, text=True, encoding="utf-8", timeout=180,
        )
        if completed.returncode:
            raise RuntimeError(completed.stderr)
        return json.loads((out / "result.json").read_text(encoding="utf-8"))


class NarrationRender(unittest.TestCase):
    def test_reference(self):
        html = (ROOT / "selftest/oracle/_spoken-stat/index.html").read_text(encoding="utf-8")
        r = grade(html)
        self.assertEqual(r["score"], 1, [c for c in r["checks"] if not c["pass"]])
        self.assertEqual(r["contract"], 1)
        self.assertEqual(r["craft"], 1)

    def test_naive_loses_craft_only(self):
        html = (ROOT / "selftest/naive/_spoken-stat/index.html").read_text(encoding="utf-8")
        r = grade(html)
        self.assertEqual(r["contract"], 1, [c for c in r["checks"] if c["kind"] == "contract" and not c["pass"]])
        self.assertLess(r["craft"], 1)
        failed = [c["id"] for c in r["checks"] if not c["pass"]]
        for text in ["spoken cue", "qualifier stays", "source stays"]:
            self.assertTrue(any(text in name for name in failed), failed)

    def test_clipped_source_fails(self):
        html = (ROOT / "selftest/oracle/_spoken-stat/index.html").read_text(encoding="utf-8")
        html = html.replace('</style>', '[data-role="source"]{width:1px;overflow:hidden}</style>')
        r = grade(html)
        check = next(c for c in r["checks"] if c["id"].startswith("narration: source stays"))
        self.assertFalse(check["pass"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
