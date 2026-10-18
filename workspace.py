"""Build the folder an agent works in: the brief, the contract, the brand sheet, assets and tools.
Nothing from tasks/<id>/task.json (the checks) goes in."""
import os, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(ROOT, "kit")

def make_workspace(task_id, ws):
    os.makedirs(ws, exist_ok=True)
    for f in ("CONTRACT.md", "BRAND.md"):
        shutil.copy(os.path.join(KIT, f), os.path.join(ws, f))
    shutil.copy(os.path.join(ROOT, "tasks", task_id, "brief.md"), os.path.join(ws, "BRIEF.md"))
    shutil.copytree(os.path.join(KIT, "assets"), os.path.join(ws, "assets"), dirs_exist_ok=True)
    gsap = os.path.join(KIT, "node_modules", "gsap", "dist")
    for f in ("gsap.min.js", "CustomEase.min.js", "MotionPathPlugin.min.js"):
        shutil.copy(os.path.join(gsap, f), os.path.join(ws, "assets", f))
    tokens = os.path.join(ROOT, "tasks", task_id, "tokens.json")
    if os.path.exists(tokens):
        shutil.copy(tokens, os.path.join(ws, "assets", "tokens.json"))
    os.makedirs(os.path.join(ws, "tools"), exist_ok=True)
    for f in ("lib.mjs", "probe.mjs", "snap.mjs"):
        shutil.copy(os.path.join(KIT, "tools", f), os.path.join(ws, "tools", f))
    open(os.path.join(ws, "package.json"), "w").write('{"private": true, "type": "module"}\n')
    link = os.path.join(ws, "node_modules")
    if not os.path.exists(link):
        os.symlink(os.path.join(KIT, "node_modules"), link)
    return ws
