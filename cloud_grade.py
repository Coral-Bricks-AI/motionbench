"""Grade saved runs on Modal, one container per run: modal run cloud_grade.py [--tasks a,b] [--selftest]
The same grader as regrade.py (the run's index.html in a fresh workspace, grader/grade.mjs), in Playwright's own
image for the same Chromium build; result.json and sheet.png are written back beside the run."""
import glob, json, os
import modal

ROOT = os.path.dirname(os.path.abspath(__file__))
image = (
    modal.Image.from_registry("mcr.microsoft.com/playwright:v1.63.0-noble", add_python="3.12")
    .add_local_file(os.path.join(ROOT, "kit", "package.json"), "/mb/kit/package.json", copy=True)
    .add_local_file(os.path.join(ROOT, "kit", "package-lock.json"), "/mb/kit/package-lock.json", copy=True)
    .run_commands("cd /mb/kit && npm ci --no-audit --no-fund")
    .add_local_dir(os.path.join(ROOT, "kit"), "/mb/kit", ignore=["node_modules", "**/node_modules"])
    .add_local_dir(os.path.join(ROOT, "grader"), "/mb/grader")
    .add_local_dir(os.path.join(ROOT, "tasks"), "/mb/tasks")
    .add_local_file(os.path.join(ROOT, "workspace.py"), "/mb/workspace.py")
)
app = modal.App("motionbench-grade", image=image)


@app.function(cpu=2, memory=4096, timeout=1800, retries=1)
def grade(key: str, task: str, html: str) -> dict:
    import shutil, subprocess, sys, tempfile
    sys.path.insert(0, "/mb")
    from workspace import make_workspace
    ws = make_workspace(task, tempfile.mkdtemp(prefix="mb-"))
    open(os.path.join(ws, "index.html"), "w").write(html)
    out = tempfile.mkdtemp(prefix="mb-out-")
    p = subprocess.run(["node", "/mb/grader/grade.mjs", ws, f"/mb/tasks/{task}", "--out", out], capture_output=True, text=True)
    shutil.rmtree(ws, ignore_errors=True)
    res = os.path.join(out, "result.json")
    if p.returncode or not os.path.exists(res):
        return {"key": key, "error": (p.stderr or p.stdout)[-1200:]}
    sheet = os.path.join(out, "sheet.png")
    return {"key": key, "result": open(res).read(), "sheet": open(sheet, "rb").read() if os.path.exists(sheet) else None}


@app.local_entrypoint()
def main(tasks: str = "", selftest: bool = False):
    only = [t for t in tasks.split(",") if t]
    jobs = []  # (local folder to write into, task, html)
    if selftest:
        for kind in ("oracle", "naive"):
            for t in sorted(os.listdir(os.path.join(ROOT, "selftest", kind))):
                if not only or t in only:
                    jobs.append((os.path.join(ROOT, "selftest", "out", kind, t), t, os.path.join(ROOT, "selftest", kind, t, "index.html")))
    else:
        for d in sorted(glob.glob(os.path.join(ROOT, "results", "*", "*", "a*"))):
            t = d.split(os.sep)[-2]
            if os.path.exists(os.path.join(d, "run.json")) and os.path.exists(os.path.join(d, "index.html")) and (not only or t in only):
                jobs.append((d, t, os.path.join(d, "index.html")))
    print(f"grading {len(jobs)} on Modal", flush=True)
    done = errors = 0
    for r in grade.starmap([(d, t, open(h).read()) for d, t, h in jobs], order_outputs=False, return_exceptions=True):
        if isinstance(r, Exception) or "error" in r:
            errors += 1
            print("ERROR", getattr(r, "get", lambda *_: None)("key") if not isinstance(r, Exception) else "", str(r if isinstance(r, Exception) else r["error"])[-600:], flush=True)
            continue
        d = r["key"]
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "result.json"), "w").write(r["result"])
        if r["sheet"]:
            open(os.path.join(d, "sheet.png"), "wb").write(r["sheet"])
        done += 1
        g = json.loads(r["result"])
        print(f"{os.path.relpath(d, ROOT):44} {g['score']:.3f}  contract {g['contract']:.2f}", flush=True)
    print(f"done {done}, errors {errors}", flush=True)
