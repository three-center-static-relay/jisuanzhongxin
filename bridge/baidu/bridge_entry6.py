import json
import os
import pathlib
import sys
import tempfile

import bridge as impl
import bridge_entry5 as prev


def _classify_log(text):
    s = str(text or "").lower()
    checks = [
        (["v100_gpu_not_available", "gpu not available", "cuda unavailable", "cuda error", "cudnn", "gpu不可用"], "BAIDU_JOB_RUNTIME_GPU_ERROR"),
        (["no module named", "modulenotfounderror", "importerror", "module not found", "依赖缺失"], "BAIDU_JOB_RUNTIME_DEPENDENCY_ERROR"),
        (["out of memory", "cuda oom", "显存不足", "内存不足"], "BAIDU_JOB_RUNTIME_OOM"),
        (["task_timeout", "timeout", "timed out", "超时"], "BAIDU_JOB_RUNTIME_TIMEOUT"),
        (["no such file", "file not found", "task.json", "run.py", "文件不存在"], "BAIDU_JOB_RUNTIME_PACKAGE_FILE_ERROR"),
        (["permission denied", "forbidden", "unauthorized", "权限不足", "无权限"], "BAIDU_JOB_RUNTIME_PERMISSION_ERROR"),
        (["traceback (most recent call last)", "exception", "runtimeerror", "valueerror", "typeerror", "assertionerror"], "BAIDU_JOB_USER_PYTHON_EXCEPTION"),
        (["killed", "sigkill", "signal 9", "terminated"], "BAIDU_JOB_PROCESS_KILLED"),
    ]
    for needles, cls in checks:
        if any(x in s for x in needles):
            return cls
    return "BAIDU_JOB_TERMINAL_FAILED_LOG_UNCLASSIFIED"


def _list_output_files(token, pipeline_id):
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        from baidubce.auth.bce_credentials import BceCredentials
        from baidubce.bce_client_configuration import BceClientConfiguration
        from baidubce.services.bos.bos_client import BosClient
        resp = pp_request.bosacl_ls_cp(token, pipeline_id)
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_ACCESS_REQUEST_FAILED"}
    if not isinstance(resp, dict) or int(resp.get("errorCode", -1)) != 0:
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_ACCESS_API_ERROR"}
    try:
        result = resp["result"]
        prefix = str(result["fileKey"]).lstrip("/").rstrip("/") + "/"
        conf = BceClientConfiguration(
            credentials=BceCredentials(result["accessKeyId"], result["secretAccessKey"]),
            endpoint=result["endpoint"],
            security_token=result["sessionToken"],
        )
        client = BosClient(conf)
        listing = client.list_objects(result["bucketName"], prefix=prefix)
        files = []
        for item in getattr(listing, "contents", []) or []:
            key = str(getattr(item, "key", ""))
            if not key.startswith(prefix):
                continue
            rel = key[len(prefix):]
            if not rel:
                continue
            size = int(getattr(item, "size", 0) or 0)
            files.append((rel, size))
            if len(files) >= 100:
                break
        return {"ok": True, "files": files}
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_LIST_FAILED"}


def _pick_log_files(files):
    ranked = []
    for rel, size in files:
        low = rel.lower()
        score = 0
        if "stderr" in low or "error" in low or low.endswith(".err"):
            score += 10
        if "stdout" in low or "log" in low or low.endswith(".log"):
            score += 8
        if low.endswith(".txt"):
            score += 3
        if score and size <= 1024 * 1024:
            ranked.append((-score, size, rel))
    ranked.sort()
    return [x[2] for x in ranked[:8]]


def _read_remote_tail(pipeline_id, remote):
    with tempfile.TemporaryDirectory(prefix="three-center-logdiag-") as td:
        dest = pathlib.Path(td) / "log.txt"
        p = impl.run(["aistudio", "job", pipeline_id, "cp", remote, str(dest)], check=False, label="AISTUDIO_LOG_CLI")
        if p.returncode != 0 or not dest.exists() or dest.stat().st_size > 1024 * 1024:
            return None
        data = dest.read_bytes()[-65536:]
        return data.decode("utf-8", errors="replace")


def diagnostic_check(task_id, stored_job_id):
    if not stored_job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=stored_job_id, stage="result_polling")
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    q = prev._query_pipeline_with_reason(token, stored_job_id)
    if not q.get("ok") or q.get("category") != "terminal_failed":
        return prev.diagnostic_check(task_id, stored_job_id)

    listing = _list_output_files(token, stored_job_id)
    if not listing.get("ok"):
        return prev.prev._fail(task_id, stored_job_id, listing["failure_class"])
    files = listing.get("files") or []

    if any(rel == "three-center-result.json" for rel, _ in files):
        with tempfile.TemporaryDirectory(prefix="three-center-resultdiag-") as td:
            result = impl.fetch_result(task_id, stored_job_id, pathlib.Path(td) / "three-center-result.json")
        if result is not None:
            impl.callback(task_id, "FETCH", "completed", baidu_job_id=stored_job_id, result=result, stage="result_retrieved")
            return 0

    candidates = _pick_log_files(files)
    if not candidates:
        return prev.prev._fail(task_id, stored_job_id, "BAIDU_JOB_TERMINAL_FAILED_NO_PERSISTED_LOG")
    for remote in candidates:
        text = _read_remote_tail(stored_job_id, remote)
        if text:
            return prev.prev._fail(task_id, stored_job_id, _classify_log(text))
    return prev.prev._fail(task_id, stored_job_id, "BAIDU_JOB_TERMINAL_FAILED_LOG_DOWNLOAD_FAILED")


def selftest():
    cases = {
        "RuntimeError: V100_GPU_NOT_AVAILABLE": "BAIDU_JOB_RUNTIME_GPU_ERROR",
        "ModuleNotFoundError: No module named 'paddle'": "BAIDU_JOB_RUNTIME_DEPENDENCY_ERROR",
        "CUDA out of memory": "BAIDU_JOB_RUNTIME_OOM",
        "Traceback (most recent call last):\nValueError: bad": "BAIDU_JOB_USER_PYTHON_EXCEPTION",
        "random failure text": "BAIDU_JOB_TERMINAL_FAILED_LOG_UNCLASSIFIED",
    }
    for raw, expected in cases.items():
        actual = _classify_log(raw)
        if actual != expected:
            raise AssertionError(f"LOG_CLASS_MISMATCH:{actual}:{expected}")
    print(json.dumps({"ok": True, "suite": "baidu-persisted-log-safe-classifier", "cases": len(cases)}))
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-logdiag":
        sys.exit(selftest())
    try:
        op = impl.env("BRIDGE_OP").upper()
        task_id = impl.env("BRIDGE_TASK_ID")
        impl.env("BRIDGE_TICKET")
        job_id = impl.env("BRIDGE_BAIDU_JOB_ID", required=False)
        if op == "CHECK":
            impl.callback(task_id, op, "running", stage="circleci_started")
            impl.auth(task_id, op)
            sys.exit(diagnostic_check(task_id, job_id))
        sys.exit(impl.main())
    except Exception as exc:
        task = os.environ.get("BRIDGE_TASK_ID", "").strip()
        op = os.environ.get("BRIDGE_OP", "UNKNOWN").strip().upper()
        if task:
            try:
                impl.callback(task, op, "failed", error=impl.redact_cli(str(exc))[:500], failure_class=impl.failure_class(exc))
            except Exception:
                pass
        print(f"bridge_failed:{impl.failure_class(exc)}", file=sys.stderr)
        sys.exit(1)
