"""Run models on motionbench tasks in Claude Code and grade what they make.

    python3 run.py --models opus,sonnet,haiku,deepseek [--tasks p-ease,s-pan] [--attempts 1] [--start 1] [--jobs 6]

Every model gets the same harness: Claude Code in --safe-mode (no CLAUDE.md, skills, plugins, hooks or MCP),
the tools Bash, Read, Write, Edit, Glob and Grep, effort high, and a sandbox that confines it to its
workspace with no network. The Claude models use this machine's Claude subscription (Claude Code's own
login); DeepSeek V4.1 Flash and GLM-5.3 go through the CoralBricks gateway's Anthropic Messages API with
CORALBRICKS_API_KEY (scrubbed from the agent's shell); Grok 4.7 through xAI's Messages API with XAI_TOKEN. GPT runs in Codex CLI with the ChatGPT login in
MOTIONBENCH_CODEX_AUTH, inside a macOS sandbox-exec profile (seatbelt()). Results land in
results/<model>/<task>/a<N>/.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(ROOT, "kit")
sys.path.insert(0, ROOT)
from workspace import make_workspace

MODELS = {
    "opus": {"model": "claude-opus-5-5"},
    "sonnet": {"model": "claude-sonnet-5-5"},
    "haiku": {"model": "claude-haiku-5-5"},
    # The gateway ignores Claude Code's adaptive-thinking request for DeepSeek, so "deepseek" goes through
    # thinking_proxy.py (reasoning on, budget 24k) and "deepseek-plain" goes direct, as Claude Code users get it.
    "deepseek": {"model": "deepseek-v4.1-flash-fast", "gateway": "proxy"},
    "deepseek-plain": {"model": "deepseek-v4.1-flash-fast", "gateway": "plain"},
    "glm": {"model": "glm-5.3-fast", "gateway": "noimage"},  # text-only on CoralBricks
    # xAI's API speaks the Anthropic Messages protocol and Grok always reasons there.
    "grok": {"model": "grok-4.7", "base_url": "http://127.0.0.1:8796", "key_env": "XAI_TOKEN", "upstream": "https://api.x.ai"},
    # GPT runs in its own harness, Codex CLI, on the ChatGPT subscription Pi is logged in with.
    "gpt-sol": {"model": "gpt-6.1-sol", "harness": "codex"},
}
PROXY_PORT = 8793
PLAIN_PORT = 8798  # same gateway fixes, thinking request untouched
NOIMAGE_PORT = 8799  # gateway fixes for a text-only model: images replaced by a note
CONNECT_PORT = 8795
PROMPT = ("Read BRIEF.md, CONTRACT.md and BRAND.md in this folder, then make index.html as the brief asks. "
          "Check your work with the tools described in CONTRACT.md. When index.html is finished, stop.")
TIMEOUT = 30 * 60
WORK = os.environ.get("MOTIONBENCH_WORK") or os.path.join(tempfile.gettempdir(), "motionbench-work")


def gateway_key():
    key = os.environ.get("CORALBRICKS_API_KEY")
    if not key:
        sys.exit("set CORALBRICKS_API_KEY for the CoralBricks models")
    return key


def codex_home():
    """A throwaway CODEX_HOME holding a copy of the Codex auth.json named by MOTIONBENCH_CODEX_AUTH. It sits
    in a folder that cannot be listed, so a sandboxed agent cannot find it. Give it an auth.json whose
    refresh token is not your real one if you do not want Codex to rotate your login."""
    import uuid
    src = os.environ.get("MOTIONBENCH_CODEX_AUTH")
    if not src:
        sys.exit("set MOTIONBENCH_CODEX_AUTH to a Codex auth.json for the GPT models")
    hide = os.path.join(WORK, "hide")
    os.makedirs(hide, exist_ok=True)
    os.chmod(hide, 0o711)
    home = os.path.join(hide, uuid.uuid4().hex)
    os.makedirs(home, mode=0o700)
    shutil.copy(src, os.path.join(home, "auth.json"))
    os.chmod(os.path.join(home, "auth.json"), 0o600)
    return home


def seatbelt(ws, conf):
    """The one macOS sandbox every harness runs in (sandbox-exec around the whole harness process).
    Reads: nothing in the home folder except the toolchain, the kit and the browser; nothing in the shared
    temp folders except this run's workspace and its harness config. Writes: only those two. Network: only
    localhost, where the local proxies forward to the model provider's hosts."""
    home = os.path.expanduser("~")
    troot = os.path.realpath(tempfile.gettempdir())
    allow = [home + "/.local", home + "/.codex/packages", home + "/Library/Caches/ms-playwright", os.path.realpath(KIT), ws, conf]
    hidden = [home, "/private/tmp", troot]
    return "\n".join([
        "(version 1)", "(allow default)",
        "(deny file-read* " + " ".join(f'(subpath "{h}")' for h in hidden) + ")", "(allow file-read-metadata)",
        "(allow file-read* " + " ".join(f'(subpath "{a}")' for a in allow) + ")",
        "(deny file-write* " + " ".join(f'(subpath "{h}")' for h in hidden) + ")",
        f'(allow file-write* (subpath "{ws}") (subpath "{conf}"))',
        '(deny network-outbound (remote ip "*:*"))', '(allow network-outbound (remote ip "localhost:*"))',
        "(allow network-outbound (remote unix-socket))", ""])


def claude_token():
    """The Claude subscription's current OAuth access token from the keychain (Claude Code's own login).
    If it is close to expiring, one tiny ordinary Claude Code call makes Claude Code refresh it."""
    def read():
        raw = subprocess.run(["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"], capture_output=True, text=True).stdout
        o = json.loads(raw)["claudeAiOauth"]
        return o["accessToken"], o["expiresAt"] / 1000 - time.time()
    tok, left = read()
    if left < 40 * 60:
        subprocess.run(["claude", "-p", "--model", "claude-haiku-5-5", "reply ok"], capture_output=True, stdin=subprocess.DEVNULL, timeout=120)
        tok, left = read()
    if left < 35 * 60:
        sys.exit("the Claude subscription token could not be refreshed")
    return tok


def base_env():
    keep = ("PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "TERM")
    env = {k: os.environ[k] for k in keep if k in os.environ}
    env["CLAUDE_CODE_SUBPROCESS_ENV_SCRUB"] = "1"
    env["DISABLE_AUTOUPDATER"] = "1"
    return env


def run_one(name, task, attempt, key, chome=None):
    import uuid
    cfg = MODELS[name]
    out = out_dir(name, task, attempt)
    if os.path.exists(os.path.join(out, "result.json")):
        return name, task, attempt, json.load(open(os.path.join(out, "result.json"))), "cached"
    ws = os.path.join(WORK, name, f"{task}-a{attempt}")
    shutil.rmtree(ws, ignore_errors=True)
    make_workspace(task, ws)
    ws = os.path.realpath(ws)
    os.makedirs(os.path.join(ws, ".tmp"))
    hide = os.path.join(WORK, "hide")
    os.makedirs(hide, exist_ok=True)
    os.chmod(hide, 0o711)
    conf = os.path.realpath(os.path.join(hide, uuid.uuid4().hex))
    os.makedirs(conf, mode=0o700)
    sb = os.path.join(conf, "sandbox.sb")
    open(sb, "w").write(seatbelt(ws, conf))
    env = {k: os.environ[k] for k in ("PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM") if k in os.environ}
    env.update({"TMPDIR": os.path.join(ws, ".tmp"), "HTTPS_PROXY": f"http://127.0.0.1:{CONNECT_PORT}", "HTTP_PROXY": f"http://127.0.0.1:{CONNECT_PORT}",
                "NO_PROXY": "127.0.0.1,localhost", "DISABLE_AUTOUPDATER": "1"})
    if cfg.get("harness") == "codex":
        shutil.copytree(chome, os.path.join(conf, "codex"))
        env["CODEX_HOME"] = os.path.join(conf, "codex")
        harness = ["codex", "exec", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox", "-C", ws,
                   "-m", cfg["model"], "-c", "model_reasoning_effort=high", "-c", "shell_environment_policy.inherit=core", "--json", PROMPT]
    else:
        os.makedirs(os.path.join(conf, "tmp"))
        env.update({"CLAUDE_CONFIG_DIR": os.path.join(conf, "claude"), "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "1",
                    "CLAUDE_CODE_TMPDIR": os.path.join(conf, "tmp"), "CLAUDE_TMPDIR": os.path.join(conf, "tmp")})
        if cfg.get("gateway"):
            env["ANTHROPIC_BASE_URL"] = f"http://127.0.0.1:{dict(proxy=PROXY_PORT, plain=PLAIN_PORT, noimage=NOIMAGE_PORT)[cfg['gateway']]}"
            env["ANTHROPIC_AUTH_TOKEN"] = key
        elif cfg.get("base_url"):
            if not os.environ.get(cfg["key_env"]):
                sys.exit(f"set {cfg['key_env']} for {name}")
            env["ANTHROPIC_BASE_URL"] = cfg["base_url"]
            env["ANTHROPIC_AUTH_TOKEN"] = os.environ[cfg["key_env"]]
        else:
            env["CLAUDE_CODE_OAUTH_TOKEN"] = claude_token()
        harness = ["claude", "-p", "--safe-mode", "--model", cfg["model"], "--effort", "high", "--tools", "Bash,Read,Write,Edit,Glob,Grep",
                   "--allowedTools", "Bash", "Read", "Write", "Edit", "Glob", "Grep",
                   "--no-session-persistence", "--output-format", "stream-json", "--verbose", PROMPT]
    cmd = ["perl", "-e", "alarm shift; exec @ARGV", str(TIMEOUT), "sandbox-exec", "-f", sb] + harness
    try:
        return finish(name, cfg, task, attempt, ws, out, cmd, env, codex=cfg.get("harness") == "codex")
    finally:
        shutil.rmtree(conf, ignore_errors=True)


def out_dir(name, task, attempt):
    return os.path.join(ROOT, "results", name, task, f"a{attempt}")


def finish(name, cfg, task, attempt, ws, out, cmd, env, codex=False):
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    with open(os.path.join(out, "transcript.jsonl"), "w") as tr, open(os.path.join(out, "stderr.txt"), "w") as er:
        p = subprocess.run(cmd, cwd=ws, env=env, stdin=subprocess.DEVNULL, stdout=tr, stderr=er)
    wall = time.time() - t0
    info = {"model": cfg["model"], "task": task, "attempt": attempt, "exit": p.returncode, "wall_s": round(wall, 1), "timed_out": p.returncode == 142 or wall >= TIMEOUT - 5}
    for line in open(os.path.join(out, "transcript.jsonl")):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("type") == "result":
            info.update({k: d.get(k) for k in ("subtype", "num_turns", "total_cost_usd", "duration_api_ms", "is_error")})
            info["usage"] = d.get("usage")
        if codex:
            u = info.setdefault("usage", {"input_tokens": 0, "cache_read_input_tokens": 0, "output_tokens": 0, "reasoning_output_tokens": 0})
            if d.get("type") == "turn.completed":
                du = d.get("usage") or {}
                u["input_tokens"] += (du.get("input_tokens") or 0) - (du.get("cached_input_tokens") or 0)
                u["cache_read_input_tokens"] += du.get("cached_input_tokens") or 0
                u["output_tokens"] += du.get("output_tokens") or 0
                u["reasoning_output_tokens"] += du.get("reasoning_output_tokens") or 0
            if d.get("type") == "item.completed" and (d.get("item") or {}).get("type") in ("command_execution", "file_change"):
                info["num_turns"] = (info.get("num_turns") or 0) + 1
            if d.get("type") in ("turn.failed", "error"):
                msg = str((d.get("error") or {}).get("message") or d.get("message") or "")
                if re.search(r"usage limit|rate limit|quota|too many requests", msg, re.I):
                    info["quota"] = msg[:300]
    if info.get("quota"):
        # Out of subscription quota: not the model's fault; throw the run away so it can be run again.
        shutil.rmtree(out, ignore_errors=True)
        shutil.rmtree(ws, ignore_errors=True)
        return name, task, attempt, None, "QUOTA " + info["quota"][:120]
    if os.path.exists(os.path.join(ws, "index.html")):
        shutil.copy(os.path.join(ws, "index.html"), os.path.join(out, "index.html"))
    g = subprocess.run(["node", os.path.join(ROOT, "grader", "grade.mjs"), ws, os.path.join(ROOT, "tasks", task), "--out", out], capture_output=True, text=True)
    if g.returncode:
        info["grader_error"] = g.stderr[-1500:]
    json.dump(info, open(os.path.join(out, "run.json"), "w"), indent=1)
    for f in ("measure.json",):
        if os.path.exists(os.path.join(out, f)):
            os.remove(os.path.join(out, f))  # large; regenerate with grade.mjs from index.html when needed
    r = json.load(open(os.path.join(out, "result.json"))) if os.path.exists(os.path.join(out, "result.json")) else None
    shutil.rmtree(ws, ignore_errors=True)
    return name, task, attempt, r, f"{wall:.0f}s"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="opus,sonnet,haiku,deepseek")
    ap.add_argument("--tasks", default="")
    ap.add_argument("--attempts", type=int, default=1)
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    tasks = a.tasks.split(",") if a.tasks else sorted(t for t in os.listdir(os.path.join(ROOT, "tasks")) if not t.startswith("_"))
    models = a.models.split(",")
    key = gateway_key() if any(MODELS[m].get("gateway") for m in models) else None
    # Interleave models so each one's runs are spread over the whole session.
    jobs = [(m, t, n) for n in range(a.start, a.start + a.attempts) for t in tasks for m in models]
    procs, chome = [], None
    if any(MODELS[m].get("gateway") == "proxy" for m in models):
        procs.append(subprocess.Popen([sys.executable, os.path.join(ROOT, "thinking_proxy.py"), str(PROXY_PORT)]))
    if any(MODELS[m].get("gateway") == "noimage" for m in models):
        procs.append(subprocess.Popen([sys.executable, os.path.join(ROOT, "thinking_proxy.py"), str(NOIMAGE_PORT), "24576", "https://inference.coralbricks.ai", "noimage"]))
    if any(MODELS[m].get("gateway") == "plain" for m in models):
        procs.append(subprocess.Popen([sys.executable, os.path.join(ROOT, "thinking_proxy.py"), str(PLAIN_PORT), "0", "https://inference.coralbricks.ai", "plain"]))
    procs.append(subprocess.Popen([sys.executable, os.path.join(ROOT, "connect_proxy.py"), str(CONNECT_PORT),
                                   "chatgpt.com", "openai.com", "anthropic.com", "claude.ai", "claude.com", "inference.coralbricks.ai", "api.x.ai"]))
    if any(MODELS[m].get("harness") == "codex" for m in models):
        chome = codex_home()
    if "grok" in models:
        procs.append(subprocess.Popen([sys.executable, os.path.join(ROOT, "thinking_proxy.py"), "8796", "0", "https://api.x.ai"]))
    time.sleep(1)
    try:
        with ThreadPoolExecutor(a.jobs) as ex:
            for name, task, attempt, r, how in ex.map(lambda j: run_one(*j, key, chome), jobs):
                s = f"{r['score']:.3f} craft {r['craft']:.2f} contract {r['contract']:.2f}" if r else "no result"
                print(f"{name:14} {task:20} a{attempt}  {s}  ({how})", flush=True)
    finally:
        for p in procs:
            p.terminate()
        if chome:
            shutil.rmtree(chome, ignore_errors=True)


if __name__ == "__main__":
    main()
