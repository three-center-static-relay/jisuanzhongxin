import json
import pathlib
import sys
import tempfile
import time

import bridge as impl

RUNTIME = "paddle2.5_py3.10"
START_COMMAND = "sh run.sh"
DIAGNOSTIC = "paddle25-v100-e2e"


def run_script():
    return "#!/bin/sh\nset -eu\nexec python3 /home/aistudio/canary.py\n"


def canary_script(task_id):
    return f'''import hashlib
import json
import os
import subprocess

TASK_ID = {task_id!r}
RUNTIME = {RUNTIME!r}
DIAGNOSTIC = {DIAGNOSTIC!r}

names = subprocess.check_output(
    ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
    text=True,
    timeout=30,
).strip().splitlines()
if not names:
    raise RuntimeError("V100_NAME_MISSING")
device_name = names[0].strip()
if "V100" not in device_name.upper():
    raise RuntimeError("V100_NOT_VISIBLE:" + device_name)

import paddle

if not bool(paddle.device.is_compiled_with_cuda()):
    raise RuntimeError("PADDLE_CUDA_NOT_COMPILED")
paddle_device = str(paddle.set_device("gpu:0"))
x = paddle.to_tensor([1.0, 2.0, 3.0], dtype="float32")
value = float(paddle.sum(x * x).numpy().item())
if abs(value - 14.0) > 1e-6:
    raise RuntimeError("CUDA_KERNEL_SANITY_FAILED")

checksum = hashlib.sha256(
    f"{{TASK_ID}}|{{RUNTIME}}|{{device_name}}|{{paddle_device}}|{{value:.6f}}".encode("utf-8")
).hexdigest()
result = {{
    "ok": True,
    "task_id": TASK_ID,
    "profile": "gpu",
    "diagnostic": DIAGNOSTIC,
    "runtime": RUNTIME,
    "accelerator": "v100",
    "cuda": True,
    "paddle_cuda": True,
    "paddle_device": paddle_device,
    "device": "gpu:" + device_name,
    "cuda_kernel_value": value,
    "matrix_checksum": checksum,
}}
os.makedirs("/home/aistudio/output", exist_ok=True)
with open("/home/aistudio/output/three-center-result.json", "w", encoding="utf-8") as f:
    json.dump(result, f, separators=(",", ":"), sort_keys=True)
print(json.dumps({{"ok": True, "diagnostic": DIAGNOSTIC, "runtime": RUNTIME, "device": device_name, "paddle_device": paddle_device}}), flush=True)
'''


def submit_and_wait(task_id):
    manifest = impl.api("GET", f"/v1/providers/baidu/bridge/task/{task_id}")
    timeout_seconds = max(120, min(420, int(manifest.get("timeout_seconds") or 300)))
    with tempfile.TemporaryDirectory(prefix="three-center-baidu-p25-") as td:
        work = pathlib.Path(td)
        (work / "run.sh").write_text(run_script(), encoding="utf-8", newline="\n")
        (work / "canary.py").write_text(canary_script(task_id), encoding="utf-8", newline="\n")
        p = impl.run([
            "aistudio", "submit", "job",
            "--name", impl.expected_pipeline_name(task_id),
            "--path", str(work),
            "--cmd", START_COMMAND,
            "--env", RUNTIME,
            "--device", "v100",
            "--gpus", "1",
            "--payment", "coupon",
        ], label="AISTUDIO_SUBMIT_CLI")
        combined = (p.stdout or "") + "\n" + (p.stderr or "")
        impl.callback(task_id, "SUBMIT", "running", stage="aistudio_submit_returned")
        job_id = impl.confirm_submitted_pipeline(task_id, combined)
        impl.callback(
            task_id,
            "SUBMIT",
            "running",
            baidu_job_id=job_id,
            payment="coupon",
            device="v100",
            gpus=1,
            stage="baidu_submitted",
        )
        deadline = time.time() + timeout_seconds + 180
        result_path = work / "three-center-result.json"
        impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
        while time.time() < deadline:
            result = impl.fetch_result(task_id, job_id, result_path)
            if result is not None:
                impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                return 0
            print("bridge_poll pending", flush=True)
            time.sleep(20)
        impl.callback(
            task_id,
            "FETCH",
            "failed",
            baidu_job_id=job_id,
            error="BAIDU_P25_RESULT_TIMEOUT",
            failure_class="BAIDU_P25_RESULT_TIMEOUT",
            stage="result_polling",
        )
        return 2


def selftest():
    task_id = "baidu-circleci-live-20260816p25"
    script = canary_script(task_id)
    for needle in [
        task_id,
        "nvidia-smi",
        "V100",
        "paddle.device.is_compiled_with_cuda",
        "paddle.set_device(\"gpu:0\")",
        "cuda_kernel_value",
        "/home/aistudio/output/three-center-result.json",
    ]:
        if needle not in script:
            raise AssertionError("P25_CANARY_MISSING:" + needle)
    if RUNTIME != "paddle2.5_py3.10":
        raise AssertionError("P25_RUNTIME_MISMATCH")
    if START_COMMAND != "sh run.sh":
        raise AssertionError("P25_START_COMMAND_MISMATCH")
    print(json.dumps({"ok": True, "suite": "baidu-p25-v100-canary", "runtime": RUNTIME, "cases": 9}))
    return 0


impl.submit_and_wait = submit_and_wait


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-p25":
        sys.exit(selftest())
    try:
        op = impl.env("BRIDGE_OP").upper()
        task_id = impl.env("BRIDGE_TASK_ID")
        impl.env("BRIDGE_TICKET")
        job_id = impl.env("BRIDGE_BAIDU_JOB_ID", required=False)
        if op not in impl.ALLOWED_OPS:
            raise RuntimeError("BRIDGE_OPERATION_DENIED")
        impl.callback(task_id, op, "running", stage="circleci_started")
        impl.auth(task_id, op)
        if op == "SUBMIT":
            sys.exit(submit_and_wait(task_id))
        sys.exit(impl.one_shot(op, task_id, job_id))
    except Exception as exc:
        task = __import__("os").environ.get("BRIDGE_TASK_ID", "").strip()
        op = __import__("os").environ.get("BRIDGE_OP", "UNKNOWN").strip().upper()
        if task:
            try:
                impl.callback(task, op, "failed", error=impl.redact_cli(str(exc))[:500], failure_class=impl.failure_class(exc))
            except Exception:
                pass
        print(f"bridge_failed:{impl.failure_class(exc)}", file=sys.stderr)
        sys.exit(1)
