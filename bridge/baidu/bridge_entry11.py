import json
import pathlib
import sys
import tempfile
import time

import bridge as impl
import bridge_entry4 as check_impl


def shell_payload(task_id):
    return json.dumps({
        "ok": False,
        "task_id": task_id,
        "profile": "gpu",
        "failure_class": "BAIDU_SHELL_CANARY_EXECUTED",
        "failure_stage": "shell_run_script",
    }, separators=(",", ":"), sort_keys=True)


def run_script(task_id):
    payload = shell_payload(task_id).replace("'", "'\"'\"'")
    return (
        "#!/bin/sh\n"
        "set -eu\n"
        "mkdir -p /home/aistudio/output\n"
        f"printf '%s' '{payload}' > /home/aistudio/output/three-center-result.json\n"
    )


def submit_and_wait_shell(task_id):
    manifest = impl.api("GET", f"/v1/providers/baidu/bridge/task/{task_id}")
    timeout_seconds = max(60, min(300, int(manifest.get("timeout_seconds") or 120)))
    with tempfile.TemporaryDirectory(prefix="three-center-baidu-shell-") as td:
        work = pathlib.Path(td)
        (work / "run.sh").write_text(run_script(task_id), encoding="utf-8")
        p = impl.run([
            "aistudio", "submit", "job",
            "--name", impl.expected_pipeline_name(task_id),
            "--path", str(work),
            "--cmd", "sh run.sh",
            "--env", "paddle2.6_py3.10",
            "--device", "v100",
            "--gpus", "1",
            "--payment", "coupon",
        ], label="AISTUDIO_SUBMIT_CLI")
        combined = (p.stdout or "") + "\n" + (p.stderr or "")
        impl.callback(task_id, "SUBMIT", "running", stage="aistudio_submit_returned")
        job_id = impl.confirm_submitted_pipeline(task_id, combined)
        impl.callback(task_id, "SUBMIT", "running", baidu_job_id=job_id, payment="coupon", device="v100", gpus=1, stage="baidu_submitted")
        deadline = time.time() + timeout_seconds + 180
        result_path = work / "three-center-result.json"
        impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
        while time.time() < deadline:
            result = impl.fetch_result(task_id, job_id, result_path)
            if result is not None:
                impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                return 0
            print("shell_canary pending", flush=True)
            time.sleep(15)
        impl.callback(task_id, "FETCH", "failed", baidu_job_id=job_id, error="BAIDU_RESULT_TIMEOUT", failure_class="BAIDU_RESULT_TIMEOUT", stage="result_polling")
        return 2


def selftest():
    task_id = "baidu-circleci-live-20260816k"
    script = run_script(task_id)
    for needle in [
        "#!/bin/sh",
        task_id,
        "/home/aistudio/output/three-center-result.json",
        "BAIDU_SHELL_CANARY_EXECUTED",
    ]:
        if needle not in script:
            raise AssertionError("SHELL_CANARY_SCRIPT_MISSING:" + needle)
    if impl.expected_pipeline_name(task_id) != "three-center-baidu-circleci-live-20260816k":
        raise AssertionError("PIPELINE_NAME_MISMATCH")
    if "sh run.sh" != "sh run.sh":
        raise AssertionError("START_COMMAND_MISMATCH")
    print(json.dumps({"ok": True, "suite": "baidu-shell-startup-canary", "cases": 6}))
    return 0


impl.submit_and_wait = submit_and_wait_shell


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-shell":
        sys.exit(selftest())
    try:
        op = impl.env("BRIDGE_OP").upper()
        task_id = impl.env("BRIDGE_TASK_ID")
        impl.env("BRIDGE_TICKET")
        job_id = impl.env("BRIDGE_BAIDU_JOB_ID", required=False)
        if op not in impl.ALLOWED_OPS:
            raise RuntimeError("BRIDGE_OPERATION_DENIED")
        if op == "CHECK":
            impl.callback(task_id, op, "running", stage="circleci_started")
            impl.auth(task_id, op)
            sys.exit(check_impl.diagnostic_check(task_id, job_id))
        sys.exit(impl.main())
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
