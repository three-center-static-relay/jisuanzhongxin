import ast
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
    "three-center-result.json",
    "output/three-center-result.json",
    "./output/three-center-result.json",
]
SAFE_STAGE = {
    "circleci_started",
    "aistudio_authenticated",
    "aistudio_submit_returned",
    "baidu_submitted",
    "result_polling",
    "result_retrieved",
}


def env(name, required=True):
    value = os.environ.get(name, "").strip()
    if required and not value:
        raise RuntimeError(f"MISSING_{name}")
    return value


def api(method, path, body=None):
    base = env("COMPUTE_CALLBACK_URL").rstrip("/")
    ticket = env("BRIDGE_TICKET")
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    req = urllib.request.Request(
        base + path,
        data=data,
        method=method,
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "x-three-center-bridge-ticket": ticket,
            "user-agent": "three-center-baidu-circleci-bridge/2026-08",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"CALLBACK_HTTP_{e.code}:{text}") from e


def redact_cli(text):
    value = str(text or "")[-2000:]
    token = os.environ.get("BAIDU_AISTUDIO_ACCESS_TOKEN", "").strip()
    if token:
        value = value.replace(token, "[REDACTED]")
    return value


def run(args, check=True, label="CLI"):
    try:
        p = subprocess.run(args, text=True, capture_output=True, timeout=120, shell=False)
    except FileNotFoundError as exc:
        raise RuntimeError(f"{label}_NOT_FOUND") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"{label}_TIMEOUT") from exc
    if check and p.returncode != 0:
        tail = redact_cli(p.stderr or p.stdout or "")
        raise RuntimeError(f"{label}_FAILED_{p.returncode}:{tail}")
    return p


def callback(task_id, op, status, **extra):
    stage = str(extra.get("stage") or "")
    if stage and stage not in SAFE_STAGE:
        extra["stage"] = "unknown"
    payload = {"task_id": task_id, "op": op, "status": status, **extra}
    return api("POST", "/v1/providers/baidu/bridge/callback", payload)


def auth(task_id, op):
    token = env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    run(["aistudio", "config", "--token", token], label="AISTUDIO_AUTH_CLI")
    callback(task_id, op, "running", stage="aistudio_authenticated")


def expected_pipeline_name(task_id):
    return "three-center-" + re.sub(r"[^A-Za-z0-9._-]+", "-", str(task_id))[:48]


def _id_from_obj(obj):
    if isinstance(obj, dict):
        preferred = {"pipeline_id", "pipelineid", "job_id", "jobid", "pid"}
        fallback = {"id"}
        for key, value in obj.items():
            normalized = re.sub(r"[^a-z0-9]", "", str(key).lower())
            if normalized in {"pipelineid", "jobid", "pid"} and value not in (None, ""):
                return str(value).strip()
        for key, value in obj.items():
            if str(key).lower() in preferred and value not in (None, ""):
                return str(value).strip()
        for value in obj.values():
            found = _id_from_obj(value)
            if found:
                return found
        for key, value in obj.items():
            if str(key).lower() in fallback and value not in (None, ""):
                return str(value).strip()
    elif isinstance(obj, (list, tuple)):
        for value in obj:
            found = _id_from_obj(value)
            if found:
                return found
    return None


def parse_job_id(text):
    text = str(text or "").strip()
    if not text:
        raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")
    for parser in (json.loads, ast.literal_eval):
        try:
            found = _id_from_obj(parser(text))
            if found:
                return found
        except Exception:
            pass
    patterns = [
        r"(?:\bpid\b|pipeline[_ -]?id|pipelineId|job[_ -]?id|jobId)\s*(?:[:=|]|\s)\s*['\"]?([A-Za-z0-9._:-]{3,128})",
        r"['\"](?:pid|pipeline_id|pipelineId|job_id|jobId)['\"]\s*:\s*['\"]?([A-Za-z0-9._:-]{3,128})",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.I)
        if m:
            return m.group(1)
    for line in text.splitlines():
        if re.search(r"pipeline|job", line, re.I):
            m = re.search(r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b", line, re.I)
            if m:
                return m.group(1)
    raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")


def classify_submit_failure(text):
    s = redact_cli(text).lower()
    if any(x in s for x in [
        "余额不足", "算力点不足", "算力不足", "算力卡不足", "insufficient balance",
        "insufficient credit", "insufficient coupon", "not enough balance", "not enough coupon",
    ]):
        return "BAIDU_COMPUTE_CREDIT_INSUFFICIENT"
    if any(x in s for x in [
        "没有权限", "无权限", "权限不足", "未授权", "forbidden", "unauthorized", "permission denied",
    ]):
        return "BAIDU_SUBMIT_ACCESS_DENIED"
    if "13001" in s or "bos上传失败" in s or "bos upload" in s:
        return "BAIDU_CODE_UPLOAD_FAILED"
    if "11005" in s or "创建产线回调请求失败" in s:
        return "BAIDU_CREATE_CALLBACK_FAILED"
    if "11004" in s or "bos ak/sk申请失败" in s or "ak/sk" in s and "失败" in s:
        return "BAIDU_BOSACL_FAILED"
    if "11003" in s or "创建产线参数校验请求失败" in s or "request create pipeline" in s:
        return "BAIDU_CREATE_PIPELINE_REJECTED"
    if "10006" in s or "文件过大" in s or "file too large" in s:
        return "BAIDU_CODE_PACKAGE_TOO_LARGE"
    if "10004" in s or "文件不存在" in s or "file not found" in s:
        return "BAIDU_CODE_PATH_INVALID"
    if "未设置token" in s or ("token" in s and any(x in s for x in ["invalid", "expired", "无效", "过期"])):
        return "BAIDU_SUBMIT_AUTH_REJECTED"
    return "BAIDU_SUBMIT_NOT_CONFIRMED"


def _select_pipeline_by_name(rows, expected_name):
    exact = [x for x in (rows or []) if str(x.get("pipelineName") or "").strip() == expected_name]
    if not exact:
        return None
    exact.sort(key=lambda x: str(x.get("createTime") or ""), reverse=True)
    row = exact[0]
    return row if str(row.get("pipelineId") or "").strip() else None


def confirm_submitted_pipeline(task_id, submit_output):
    """Treat only a query-visible pipeline as a successful submit.

    aistudio-sdk 0.3.8 logs many business/API errors and returns from the CLI
    handler without setting a non-zero process exit code. Therefore subprocess
    returncode=0 is not sufficient evidence that a V100 pipeline exists.
    """
    token = env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    expected_name = expected_pipeline_name(task_id)
    query_had_success = False
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        for attempt in range(4):
            resp = pp_request.query(token, "", expected_name, "")
            if isinstance(resp, dict) and int(resp.get("errorCode", -1)) == 0:
                query_had_success = True
                row = _select_pipeline_by_name(resp.get("result") or [], expected_name)
                if row:
                    return str(row.get("pipelineId")).strip()
            if attempt < 3:
                time.sleep(2)
        # Do not rely solely on the server-side name filter.
        resp = pp_request.query(token, "", "", "")
        if isinstance(resp, dict) and int(resp.get("errorCode", -1)) == 0:
            query_had_success = True
            row = _select_pipeline_by_name(resp.get("result") or [], expected_name)
            if row:
                return str(row.get("pipelineId")).strip()
    except Exception:
        pass

    classified = classify_submit_failure(submit_output)
    if classified != "BAIDU_SUBMIT_NOT_CONFIRMED":
        raise RuntimeError(classified)
    if not query_had_success:
        raise RuntimeError("BAIDU_SUBMIT_CONFIRM_QUERY_FAILED")
    raise RuntimeError("BAIDU_SUBMIT_NOT_CONFIRMED")


def fetch_result(task_id, job_id, dest):
    for remote in RESULT_CANDIDATES:
        p = run(["aistudio", "job", job_id, "cp", remote, str(dest)], check=False, label="AISTUDIO_RESULT_CLI")
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
            "--name", expected_pipeline_name(task_id),
            "--path", str(work),
            "--cmd", "python run.py",
            "--device", "v100",
            "--gpus", "1",
            "--payment", "coupon",
        ], label="AISTUDIO_SUBMIT_CLI")
        combined = (p.stdout or "") + "\n" + (p.stderr or "")
        callback(task_id, "SUBMIT", "running", stage="aistudio_submit_returned")
        job_id = confirm_submitted_pipeline(task_id, combined)
        callback(task_id, "SUBMIT", "running", baidu_job_id=job_id, payment="coupon", device="v100", gpus=1, stage="baidu_submitted")
        deadline = time.time() + timeout_seconds + 180
        result_path = work / "three-center-result.json"
        cancelled = False
        callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
        while time.time() < deadline:
            cancelled = cancelled or soft_cancel_requested(task_id)
            result = fetch_result(task_id, job_id, result_path)
            if result is not None:
                if cancelled:
                    callback(task_id, "CANCEL", "cancelled", baidu_job_id=job_id, result_discarded=True)
                else:
                    callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                return 0
            print("bridge_poll pending", flush=True)
            time.sleep(20)
        callback(task_id, "FETCH", "failed", baidu_job_id=job_id, error="BAIDU_RESULT_TIMEOUT", failure_class="BAIDU_RESULT_TIMEOUT", stage="result_polling")
        return 2


def one_shot(op, task_id, job_id):
    if op in {"CHECK", "FETCH"}:
        if not job_id:
            raise RuntimeError("MISSING_BAIDU_JOB_ID")
        with tempfile.TemporaryDirectory(prefix="three-center-fetch-") as td:
            result = fetch_result(task_id, job_id, pathlib.Path(td) / "three-center-result.json")
        if result is None:
            callback(task_id, op, "running", baidu_job_id=job_id, stage="result_polling")
            return 0
        callback(task_id, op, "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
        return 0
    if op == "CANCEL":
        callback(task_id, "CANCEL", "cancel_requested", baidu_job_id=job_id, native_cancel=False, bounded_timeout=True)
        return 0
    raise RuntimeError("UNSUPPORTED_OPERATION")


def failure_class(exc):
    message = str(exc or "")
    known = [
        "AISTUDIO_AUTH_CLI_NOT_FOUND",
        "AISTUDIO_AUTH_CLI_TIMEOUT",
        "AISTUDIO_AUTH_CLI_FAILED",
        "AISTUDIO_SUBMIT_CLI_NOT_FOUND",
        "AISTUDIO_SUBMIT_CLI_TIMEOUT",
        "AISTUDIO_SUBMIT_CLI_FAILED",
        "BAIDU_JOB_ID_NOT_FOUND",
        "BAIDU_RESULT_TIMEOUT",
        "BAIDU_COMPUTE_CREDIT_INSUFFICIENT",
        "BAIDU_SUBMIT_ACCESS_DENIED",
        "BAIDU_CODE_UPLOAD_FAILED",
        "BAIDU_CREATE_CALLBACK_FAILED",
        "BAIDU_BOSACL_FAILED",
        "BAIDU_CREATE_PIPELINE_REJECTED",
        "BAIDU_CODE_PACKAGE_TOO_LARGE",
        "BAIDU_CODE_PATH_INVALID",
        "BAIDU_SUBMIT_AUTH_REJECTED",
        "BAIDU_SUBMIT_CONFIRM_QUERY_FAILED",
        "BAIDU_SUBMIT_NOT_CONFIRMED",
        "MISSING_BAIDU_AISTUDIO_ACCESS_TOKEN",
        "MISSING_COMPUTE_CALLBACK_URL",
        "MISSING_BRIDGE_TICKET",
        "CALLBACK_HTTP_",
    ]
    for prefix in known:
        if message.startswith(prefix):
            return prefix.rstrip("_")
    return "BAIDU_BRIDGE_FAILED"


def main():
    op = env("BRIDGE_OP").upper()
    task_id = env("BRIDGE_TASK_ID")
    env("BRIDGE_TICKET")
    job_id = env("BRIDGE_BAIDU_JOB_ID", required=False)
    if op not in ALLOWED_OPS:
        raise RuntimeError("BRIDGE_OPERATION_DENIED")
    if not re.fullmatch(r"[A-Za-z0-9._:-]{1,96}", task_id):
        raise RuntimeError("TASK_ID_INVALID")
    callback(task_id, op, "running", stage="circleci_started")
    auth(task_id, op)
    if op == "SUBMIT":
        return submit_and_wait(task_id)
    return one_shot(op, task_id, job_id)


def parser_selftest():
    cases = [
        ('{"name":"x","pipeline_id":"12345","status":"running"}', "12345"),
        ("{'name': 'x', 'pipeline_id': 'abc-123', 'status': 'running'}", "abc-123"),
        ("pipeline_id: p-987 status: running", "p-987"),
        ("pipelineId = pipe_42", "pipe_42"),
        ("pipeline | 123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174000"),
    ]
    for raw, expected in cases:
        actual = parse_job_id(raw)
        if actual != expected:
            raise AssertionError(f"PARSE_MISMATCH:{raw}:{actual}:{expected}")
    classifier_cases = {
        "创建产线参数校验请求失败: 算力点余额不足": "BAIDU_COMPUTE_CREDIT_INSUFFICIENT",
        "创建产线参数校验请求失败": "BAIDU_CREATE_PIPELINE_REJECTED",
        "BOS上传失败": "BAIDU_CODE_UPLOAD_FAILED",
        "创建产线回调请求失败": "BAIDU_CREATE_CALLBACK_FAILED",
        "unknown submit message": "BAIDU_SUBMIT_NOT_CONFIRMED",
    }
    for raw, expected in classifier_cases.items():
        actual = classify_submit_failure(raw)
        if actual != expected:
            raise AssertionError(f"SUBMIT_CLASS_MISMATCH:{raw}:{actual}:{expected}")
    print(json.dumps({"ok": True, "suite": "baidu-submit-confirmation", "parser_cases": len(cases), "classifier_cases": len(classifier_cases)}))
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-parser":
        sys.exit(parser_selftest())
    try:
        sys.exit(main())
    except Exception as exc:
        task = os.environ.get("BRIDGE_TASK_ID", "").strip()
        op = os.environ.get("BRIDGE_OP", "UNKNOWN").strip().upper()
        if task:
            try:
                callback(task, op, "failed", error=redact_cli(str(exc))[:500], failure_class=failure_class(exc))
            except Exception:
                pass
        print(f"bridge_failed:{failure_class(exc)}", file=sys.stderr)
        sys.exit(1)
