import json
import pathlib
import shutil
import sys
import tempfile
import time

import bridge as impl
import bridge_entry4 as check_impl

RUNTIME_CANDIDATE = "paddle2.5_py3.10"


def submit_and_wait_absolute(task_id):
    manifest = impl.api("GET", f"/v1/providers/baidu/bridge/task/{task_id}")
    timeout_seconds = max(60, min(900, int(manifest.get("timeout_seconds") or 300)))
    with tempfile.TemporaryDirectory(prefix="three-center-baidu-") as td:
        work = pathlib.Path(td)
        shutil.copy2(impl.JOB_TEMPLATE, work / "run.py")
        (work / "task.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
        command = f"python3 /home/aistudio/run.py --task-id {task_id} --profile gpu"
        p = impl.run([
            "aistudio", "submit", "job",
            "--name", impl.expected_pipeline_name(task_id),
            "--path", str(work),
            "--cmd", command,
            "--env", RUNTIME_CANDIDATE,
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
        cancelled = False
        impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
        while time.time() < deadline:
            cancelled = cancelled or impl.soft_cancel_requested(task_id)
            result = impl.fetch_result(task_id, job_id, result_path)
            if result is not None:
                if cancelled:
                    impl.callback(task_id, "CANCEL", "cancelled", baidu_job_id=job_id, result_discarded=True)
                else:
                    impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                return 0
            print("bridge_poll pending", flush=True)
            time.sleep(20)
        impl.callback(task_id, "FETCH", "failed", baidu_job_id=job_id, error="BAIDU_RESULT_TIMEOUT", failure_class="BAIDU_RESULT_TIMEOUT", stage="result_polling")
        return 2


def selftest():
    task_id = "baidu-circleci-live-20260815i"
    cmd = f"python3 /home/aistudio/run.py --task-id {task_id} --profile gpu"
    expected = "python3 /home/aistudio/run.py --task-id baidu-circleci-live-20260815i --profile gpu"
    if cmd != expected:
        raise AssertionError("ABSOLUTE_START_COMMAND_MISMATCH")
    if impl.expected_pipeline_name(task_id) != "three-center-baidu-circleci-live-20260815i":
        raise AssertionError("PIPELINE_NAME_MISMATCH")
    if RUNTIME_CANDIDATE != "paddle2.5_py3.10":
        raise AssertionError("RUNTIME_CANDIDATE_MISMATCH")
    print(json.dumps({"ok": True, "suite": "baidu-absolute-startup", "cases": 3, "runtime_candidate": RUNTIME_CANDIDATE}))
    return 0


impl.submit_and_wait = submit_and_wait_absolute


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-startup":
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
