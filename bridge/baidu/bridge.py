import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

BASE = pathlib.Path(__file__).resolve().parent
JOB_TEMPLATE = BASE / "job" / "run.py"
ALLOWED_OPS = {"SUBMIT", "CHECK", "FETCH", "CANCEL"}
RESULT_CANDIDATES = [
    "/home/aistudio/output/three-center-result.json",
    "./output/three-center-result.json",
    "output/three-center-result.json",
]


def env(name, required=True):
    value = os.environ.get(name, "").strip()
    if required and not value:
        raise RuntimeError(f"MISSING_{name}")
    return value


def api(method, path, body=None):
    base = env("COMPUTE_CALLBACK_URL").rstrip("/")
    secret = env("BAIDU_BRIDGE_SHARED_SECRET")
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    req = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "x-three-center-bridge-secret": secret,
            "user-agent": "three-center-baidu-circleci-bridge/2026-08",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"CALLBACK_HTTP_{e.code}:{text}") from e


def run(args, check=True):
    p = subprocess.run(args, text=True, capture_output=True, timeout=120, shell=False)
    if check and p.returncode != 0:
        tail = (p.stderr or p.stdout or "")[-800:].replace(env("BAIDU_AISTUDIO_ACCESS_TOKEN"), "[REDACTED]")
        raise RuntimeError(f"CLI_FAILED_{p.returncode}:{tail}")
    return p


def auth():
    token = env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    run(["aistudio", "config", "--token", token])


def parse_job_id(text):
    text = text or ""
    try:
        obj = json.loads(text)
        for key in ("pipeline_id", "job_id", "id"):
            if obj.get(key):
                return str(obj[key])
    except Exception:
        pass
    patterns = [r"pipeline_id\s*[:=]\s*['\"]?([A-Za-z0-9._:-]+)", r"job_id\s*[:=]\s*['\"]?([A-Za-z0-9._:-]+)"]
    for pattern in patterns:
        m = re.search(pattern, text, re.I)
        if m:
            return m.group(1)
    raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")


def callback(task_id, op, status, **extra):
    payload = {"task_id": task_id, "op": op, "status": status, **extra}
    return api("POST", "/v1/providers/baidu/bridge/callback", payload)


def fetch_result(task_id, job_id, dest):
    for remote in RESULT_CANDIDATES:
        p = run(["aistudio", "job", job_id, "cp", remote, str(dest)], check=False)
        if p.returncode == 0 and dest.exists() and dest.stat().st_size <= 65536:
            try:
                return json.loads(dest.read_text(encoding="utf-8"))
            except Exception:
                dest.unlink(missing_ok=True)
    return None


def soft_cancel_requested(task_id):
    try:
        obj = api("GET", f"/v1/providers/baidu/bridge/control/{task_id}")
        return bool(obj.get("cancel_requested"))
    except Exception:
        return False


def submit_and_wait(task_id):
    manifest = api("GET", f"/v1/providers/baidu/bridge/task/{task_id}")
    timeout_seconds = max(60, min(900, int(manifest.get("timeout_seconds") or 300)))
    with tempfile.TemporaryDirectory(prefix="three-center-baidu-") as td:
        work = pathlib.Path(td)
        shutil.copy2(JOB_TEMPLATE, work / "run.py")
        (work / "task.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
        p = run([
            "aistudio", "submit", "job",
            "--name", f"three-center-{re.sub(r'[^A-Za-z0-9._-]+', '-', task_id)[:48]}",
            "--path", str(work),
            "--cmd", "python run.py",
            "--env", "paddle2.6_py3.10",
            "--device", "v100",
            "--gpus", "1",
            "--payment", "coupon",
        ])
        job_id = parse_job_id((p.stdout or "") + "\n" + (p.stderr or ""))
        callback(task_id, "SUBMIT", "running", baidu_job_id=job_id, payment="coupon", device="v100", gpus=1)
        deadline = time.time() + timeout_seconds + 180
        result_path = work / "three-center-result.json"
        cancelled = False
        while time.time() < deadline:
            cancelled = cancelled or soft_cancel_requested(task_id)
            result = fetch_result(task_id, job_id, result_path)
            if result is not None:
                if cancelled:
                    callback(task_id, "CANCEL", "cancelled", baidu_job_id=job_id, result_discarded=True)
                else:
                    callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result)
                return 0
            print("bridge_poll pending", flush=True)
            time.sleep(20)
        callback(task_id, "FETCH", "failed", baidu_job_id=job_id, error="BAIDU_RESULT_TIMEOUT")
        return 2


def one_shot(op, task_id, job_id):
    if op in {"CHECK", "FETCH"}:
        if not job_id:
            raise RuntimeError("MISSING_BAIDU_JOB_ID")
        with tempfile.TemporaryDirectory(prefix="three-center-fetch-") as td:
            result = fetch_result(task_id, job_id, pathlib.Path(td) / "three-center-result.json")
        if result is None:
            callback(task_id, op, "running", baidu_job_id=job_id)
            return 0
        callback(task_id, op, "completed", baidu_job_id=job_id, result=result)
        return 0
    if op == "CANCEL":
        callback(task_id, "CANCEL", "cancel_requested", baidu_job_id=job_id, native_cancel=False, bounded_timeout=True)
        return 0
    raise RuntimeError("UNSUPPORTED_OPERATION")


def main():
    op = env("BRIDGE_OP").upper()
    task_id = env("BRIDGE_TASK_ID")
    job_id = env("BRIDGE_BAIDU_JOB_ID", required=False)
    if op not in ALLOWED_OPS:
        raise RuntimeError("BRIDGE_OPERATION_DENIED")
    if not re.fullmatch(r"[A-Za-z0-9._:-]{1,96}", task_id):
        raise RuntimeError("TASK_ID_INVALID")
    auth()
    if op == "SUBMIT":
        return submit_and_wait(task_id)
    return one_shot(op, task_id, job_id)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        task = os.environ.get("BRIDGE_TASK_ID", "").strip()
        op = os.environ.get("BRIDGE_OP", "UNKNOWN").strip().upper()
        if task:
            try:
                callback(task, op, "failed", error=str(exc)[:500])
            except Exception:
                pass
        print(f"bridge_failed:{type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
