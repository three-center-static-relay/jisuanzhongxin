import json
import pathlib
import shutil
import sys
import tempfile
import time

import bridge as impl
import bridge_entry4 as check_impl

RUNTIME_CANDIDATE = "paddle2.4_py3.7"
STATUS_PROBE_EVERY_POLLS = 2
BOOTSTRAP_SCHEMA = "baidu-bootstrap-sentinel-v1"
BOOTSTRAP_CANDIDATES = [
    "output/log/bootstrap.json",
    "./output/log/bootstrap.json",
    "log/bootstrap.json",
]


def _terminal_failure_class(query_result):
    if isinstance(query_result, dict) and query_result.get("ok") is True and query_result.get("category") == "terminal_failed":
        failure_class = str(query_result.get("terminal_failure_class") or "BAIDU_JOB_TERMINAL_FAILED").strip().upper()
        if not failure_class.startswith("BAIDU_JOB_"):
            return "BAIDU_JOB_TERMINAL_FAILED"
        return failure_class[:80]
    return None


def _runtime_failure_class(result):
    if not isinstance(result, dict) or result.get("ok") is not False:
        return None
    failure_class = str(result.get("failure_class") or "BAIDU_RUNTIME_EXECUTION_ERROR").strip().upper()
    if not failure_class.startswith("BAIDU_RUNTIME_"):
        return "BAIDU_RUNTIME_EXECUTION_ERROR"
    return failure_class[:80]


def _bootstrap_script(task_id):
    if not __import__("re").fullmatch(r"[A-Za-z0-9._:-]{1,96}", str(task_id or "")):
        raise RuntimeError("TASK_ID_INVALID")
    return f'''#!/bin/sh
set +e
LOG_DIR=/home/aistudio/output/log
mkdir -p "$LOG_DIR" || exit 90
printf '%s\n' '{{"schema":"{BOOTSTRAP_SCHEMA}","shell_started":true,"python_started":false,"python_exit_code":null}}' > "$LOG_DIR/bootstrap.json"
printf '%s\n' '{{"schema":"{BOOTSTRAP_SCHEMA}","shell_started":true,"python_started":true,"python_exit_code":null}}' > "$LOG_DIR/bootstrap.json"
python3 /home/aistudio/run.py --task-id {task_id} --profile gpu > "$LOG_DIR/runtime.log" 2>&1
rc=$?
printf '{{"schema":"{BOOTSTRAP_SCHEMA}","shell_started":true,"python_started":true,"python_exit_code":%s}}\n' "$rc" > "$LOG_DIR/bootstrap.json"
exit "$rc"
'''


def _normalize_bootstrap(obj):
    if not isinstance(obj, dict) or obj.get("schema") != BOOTSTRAP_SCHEMA:
        return None
    shell_started = obj.get("shell_started") is True
    python_started = obj.get("python_started") is True
    raw_exit = obj.get("python_exit_code")
    exit_code = raw_exit if isinstance(raw_exit, int) and -255 <= raw_exit <= 255 else None
    return {
        "schema": BOOTSTRAP_SCHEMA,
        "shell_started": shell_started,
        "python_started": python_started,
        "python_exit_code": exit_code,
    }


def _fetch_bootstrap(job_id, dest):
    dest = pathlib.Path(dest)
    for remote in BOOTSTRAP_CANDIDATES:
        dest.unlink(missing_ok=True)
        p = impl.run(["aistudio", "job", job_id, "cp", remote, str(dest)], check=False, label="AISTUDIO_BOOTSTRAP_CLI")
        if p.returncode != 0 or not dest.exists() or dest.stat().st_size > 4096:
            continue
        try:
            parsed = json.loads(dest.read_text(encoding="utf-8"))
        except Exception:
            continue
        normalized = _normalize_bootstrap(parsed)
        if normalized is not None:
            return normalized
    return None


def _bootstrap_reason(bootstrap):
    if not bootstrap:
        return "BOOTSTRAP_NOT_AVAILABLE"
    if bootstrap.get("python_started") is True:
        return "BOOTSTRAP_PYTHON_STARTED"
    if bootstrap.get("shell_started") is True:
        return "BOOTSTRAP_SHELL_STARTED_PYTHON_NOT_STARTED"
    return "BOOTSTRAP_NOT_AVAILABLE"


def _refine_terminal_failure(failure_class, bootstrap):
    if failure_class != "BAIDU_JOB_TERMINAL_FAILED":
        return failure_class
    if bootstrap and bootstrap.get("python_started") is True:
        return "BAIDU_JOB_RUNTIME_PROCESS_TERMINAL_FAILED"
    if bootstrap and bootstrap.get("shell_started") is True:
        return "BAIDU_JOB_BOOTSTRAP_INTERRUPTED"
    return failure_class


def _final_result_after_terminal(task_id, job_id, result_path):
    for attempt in range(3):
        result = impl.fetch_result(task_id, job_id, result_path)
        if result is not None:
            return result
        if attempt < 2:
            time.sleep(2)
    return None


def submit_and_wait_absolute(task_id):
    manifest = impl.api("GET", f"/v1/providers/baidu/bridge/task/{task_id}")
    timeout_seconds = max(60, min(900, int(manifest.get("timeout_seconds") or 300)))
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    with tempfile.TemporaryDirectory(prefix="three-center-baidu-") as td:
        work = pathlib.Path(td)
        shutil.copy2(impl.JOB_TEMPLATE, work / "run.py")
        (work / "task.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
        (work / "bootstrap.sh").write_text(_bootstrap_script(task_id), encoding="utf-8")
        command = "sh /home/aistudio/bootstrap.sh"
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
        bootstrap_path = work / "bootstrap-result.json"
        cancelled = False
        poll_count = 0
        impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
        while time.time() < deadline:
            cancelled = cancelled or impl.soft_cancel_requested(task_id)
            result = impl.fetch_result(task_id, job_id, result_path)
            if result is not None:
                runtime_failure = _runtime_failure_class(result)
                if runtime_failure:
                    impl.callback(
                        task_id,
                        "FETCH",
                        "failed",
                        baidu_job_id=job_id,
                        error=runtime_failure,
                        failure_class=runtime_failure,
                        stage="result_retrieved",
                    )
                    return 2
                if cancelled:
                    impl.callback(task_id, "CANCEL", "cancelled", baidu_job_id=job_id, result_discarded=True)
                else:
                    impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                return 0

            poll_count += 1
            if poll_count % STATUS_PROBE_EVERY_POLLS == 0:
                query = check_impl._query_pipeline(token, job_id)
                terminal_failure = _terminal_failure_class(query)
                if terminal_failure:
                    final_result = _final_result_after_terminal(task_id, job_id, result_path)
                    if final_result is not None:
                        runtime_failure = _runtime_failure_class(final_result)
                        if runtime_failure:
                            impl.callback(
                                task_id,
                                "FETCH",
                                "failed",
                                baidu_job_id=job_id,
                                error=runtime_failure,
                                failure_class=runtime_failure,
                                stage="result_retrieved",
                            )
                            return 2
                        if cancelled:
                            impl.callback(task_id, "CANCEL", "cancelled", baidu_job_id=job_id, result_discarded=True)
                        else:
                            impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=final_result, stage="result_retrieved")
                        return 0

                    bootstrap = _fetch_bootstrap(job_id, bootstrap_path)
                    refined_failure = _refine_terminal_failure(terminal_failure, bootstrap)
                    diagnostic = dict(query.get("diagnostic") or {}) if isinstance(query, dict) else {}
                    if not diagnostic.get("reason"):
                        diagnostic["reason"] = _bootstrap_reason(bootstrap)
                    if bootstrap and bootstrap.get("python_exit_code") is not None:
                        diagnostic["exitCode"] = bootstrap["python_exit_code"]
                    impl.callback(
                        task_id,
                        "CHECK",
                        "failed",
                        baidu_job_id=job_id,
                        error=refined_failure,
                        failure_class=refined_failure,
                        stage="result_polling",
                        upstream_diagnostic=diagnostic,
                    )
                    return 2
                if not query.get("ok"):
                    print(f"bridge_status_probe warning:{query.get('failure_class', 'BAIDU_QUERY_UNKNOWN')}", flush=True)

            print("bridge_poll pending", flush=True)
            time.sleep(20)
        impl.callback(task_id, "FETCH", "failed", baidu_job_id=job_id, error="BAIDU_RESULT_TIMEOUT", failure_class="BAIDU_RESULT_TIMEOUT", stage="result_polling")
        return 2


def selftest():
    task_id = "baidu-circleci-runtime-candidate-selftest"
    script = _bootstrap_script(task_id)
    if "sh /home/aistudio/bootstrap.sh" != "sh /home/aistudio/bootstrap.sh":
        raise AssertionError("BOOTSTRAP_COMMAND_MISMATCH")
    if "/home/aistudio/output/log/bootstrap.json" not in script:
        raise AssertionError("BOOTSTRAP_SENTINEL_PATH_MISSING")
    if f"python3 /home/aistudio/run.py --task-id {task_id} --profile gpu" not in script:
        raise AssertionError("ABSOLUTE_START_COMMAND_MISMATCH")
    if "runtime.log" not in script:
        raise AssertionError("RUNTIME_LOG_PATH_MISSING")
    if any(x in script for x in ["printenv", " /proc/", "BAIDU_AISTUDIO_ACCESS_TOKEN", "BRIDGE_TICKET"]):
        raise AssertionError("BOOTSTRAP_SECRET_SURFACE_DETECTED")
    normalized = _normalize_bootstrap({"schema": BOOTSTRAP_SCHEMA, "shell_started": True, "python_started": True, "python_exit_code": 7})
    if normalized != {"schema": BOOTSTRAP_SCHEMA, "shell_started": True, "python_started": True, "python_exit_code": 7}:
        raise AssertionError("BOOTSTRAP_NORMALIZATION_FAILED")
    if _bootstrap_reason(normalized) != "BOOTSTRAP_PYTHON_STARTED":
        raise AssertionError("BOOTSTRAP_REASON_FAILED")
    if _refine_terminal_failure("BAIDU_JOB_TERMINAL_FAILED", normalized) != "BAIDU_JOB_RUNTIME_PROCESS_TERMINAL_FAILED":
        raise AssertionError("BOOTSTRAP_FAILURE_REFINEMENT_FAILED")
    if _refine_terminal_failure("BAIDU_JOB_ACCESS_DENIED", normalized) != "BAIDU_JOB_ACCESS_DENIED":
        raise AssertionError("SPECIFIC_FAILURE_OVERWRITTEN")
    if impl.expected_pipeline_name(task_id) != "three-center-baidu-circleci-runtime-candidate-selftest":
        raise AssertionError("PIPELINE_NAME_MISMATCH")
    if RUNTIME_CANDIDATE != "paddle2.4_py3.7":
        raise AssertionError("RUNTIME_CANDIDATE_MISMATCH")
    if STATUS_PROBE_EVERY_POLLS != 2:
        raise AssertionError("STATUS_PROBE_CADENCE_MISMATCH")
    if _terminal_failure_class({"ok": True, "category": "terminal_failed"}) != "BAIDU_JOB_TERMINAL_FAILED":
        raise AssertionError("TERMINAL_FAILURE_CLASSIFICATION_MISMATCH")
    if _terminal_failure_class({"ok": True, "category": "terminal_failed", "terminal_failure_class": "BAIDU_JOB_RUNTIME_ENV_FAILED"}) != "BAIDU_JOB_RUNTIME_ENV_FAILED":
        raise AssertionError("TERMINAL_DETAIL_PASSTHROUGH_MISMATCH")
    if _runtime_failure_class({"ok": False, "failure_class": "BAIDU_RUNTIME_CUDA_ERROR"}) != "BAIDU_RUNTIME_CUDA_ERROR":
        raise AssertionError("RUNTIME_FAILURE_CLASSIFICATION_MISMATCH")
    if _runtime_failure_class({"ok": True}) is not None:
        raise AssertionError("SUCCESS_RESULT_MISCLASSIFIED")
    print(json.dumps({
        "ok": True,
        "suite": "baidu-bootstrap-sentinel",
        "runtime_candidate": RUNTIME_CANDIDATE,
        "persisted_bootstrap": True,
        "raw_log_callback": False,
        "terminal_final_result_retry": True,
        "terminal_bootstrap_refinement": True,
        "status_probe_every_polls": STATUS_PROBE_EVERY_POLLS,
    }))
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
