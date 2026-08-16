import json
import os
import pathlib
import re
import sys
import tempfile

import bridge as impl
import bridge_entry2 as parser_impl

TARGET_RESULT = "three-center-result.json"
SAFE_DIAGNOSTIC_KEYS = {
    "stage",
    "status",
    "state",
    "jobStatus",
    "pipelineStatus",
    "errorCode",
    "errorMsg",
    "errorMessage",
    "message",
    "reason",
    "failReason",
    "failureReason",
    "exitCode",
    "createTime",
    "updateTime",
    "finishTime",
    "endTime",
    "env",
    "runtime",
    "device",
    "resourceType",
}


def _redact_diag_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    text = impl.redact_cli(str(value or "")).strip()
    text = re.sub(
        r"(?i)(authorization|access[_-]?key|secret[_-]?key|session[_-]?token|token)\s*[:=]\s*[^\s,;]+",
        r"\1=[REDACTED]",
        text,
    )
    text = re.sub(r"\b[A-Za-z0-9_+/=-]{48,}\b", "[REDACTED]", text)
    return text[:240]


def _safe_pipeline_diagnostic(row):
    if not isinstance(row, dict):
        return {}
    out = {}
    for key in SAFE_DIAGNOSTIC_KEYS:
        if key not in row or row.get(key) in (None, ""):
            continue
        out[key] = _redact_diag_value(row.get(key))
    return out


def _classify_terminal_diagnostic(diagnostic):
    if not isinstance(diagnostic, dict):
        return "BAIDU_JOB_TERMINAL_FAILED"
    text = " ".join(str(v) for v in diagnostic.values()).lower()
    if any(x in text for x in ["cancelled", "canceled", "已取消", "取消"]):
        return "BAIDU_JOB_CANCELLED"
    if any(x in text for x in ["forbidden", "unauthorized", "permission denied", "权限不足", "无权限", "未授权"]):
        return "BAIDU_JOB_ACCESS_DENIED"
    resource_terms = ["insufficient coupon", "insufficient credit", "quota", "resource unavailable", "resource not enough", "余额不足", "算力不足", "算力点不足", "资源不足"]
    if any(x in text for x in resource_terms):
        return "BAIDU_JOB_RESOURCE_UNAVAILABLE"
    runtime_terms = ["runtime", "environment", "image", "镜像", "运行环境", "paddle2.4", "paddle 2.4"]
    failure_terms = ["failed", "failure", "error", "invalid", "not found", "失败", "错误", "无效", "不存在"]
    if any(x in text for x in runtime_terms) and any(x in text for x in failure_terms):
        return "BAIDU_JOB_RUNTIME_ENV_FAILED"
    command_terms = ["command", "entrypoint", "cmd", "startup", "start command", "启动命令", "启动脚本", "命令"]
    if any(x in text for x in command_terms) and any(x in text for x in failure_terms):
        return "BAIDU_JOB_COMMAND_FAILED"
    if any(x in text for x in ["v100", "gpu"]) and any(x in text for x in ["unavailable", "insufficient", "not available", "资源不足", "不可用"]):
        return "BAIDU_JOB_GPU_UNAVAILABLE"
    return "BAIDU_JOB_TERMINAL_FAILED"


def _fail(task_id, stored_job_id, failure_class, stage="result_polling", upstream_diagnostic=None):
    extra = {}
    if isinstance(upstream_diagnostic, dict) and upstream_diagnostic:
        extra["upstream_diagnostic"] = upstream_diagnostic
    impl.callback(
        task_id,
        "CHECK",
        "failed",
        baidu_job_id=stored_job_id,
        error=failure_class,
        failure_class=failure_class,
        stage=stage,
        **extra,
    )
    return 2


def _stage_category(stage):
    s = str(stage or "").strip().lower()
    if any(x in s for x in ["running", "pending", "queued", "queue", "waiting", "creating", "运行中", "排队", "等待"]):
        return "not_finished"
    if any(x in s for x in ["failed", "failure", "error", "stopped", "cancelled", "canceled", "运行失败", "失败", "已停止", "终止"]):
        return "terminal_failed"
    if any(x in s for x in ["success", "succeeded", "completed", "complete", "finished", "done", "运行成功", "完成"]):
        return "finished"
    return "unknown"


def _query_pipeline(token, pipeline_id):
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        resp = pp_request.query(token, pipeline_id, "", "")
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_QUERY_REQUEST_FAILED"}
    if not isinstance(resp, dict) or int(resp.get("errorCode", -1)) != 0:
        return {"ok": False, "failure_class": "BAIDU_QUERY_API_ERROR"}
    rows = resp.get("result") or []
    row = next((x for x in rows if str(x.get("pipelineId", "")) == str(pipeline_id)), None)
    if not row:
        return {"ok": False, "failure_class": "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND"}
    stage = str(row.get("stage") or "")
    category = _stage_category(stage)
    diagnostic = _safe_pipeline_diagnostic(row)
    return {
        "ok": True,
        "category": category,
        "pipeline_id": str(row.get("pipelineId") or pipeline_id),
        "diagnostic": diagnostic,
        "terminal_failure_class": _classify_terminal_diagnostic(diagnostic) if category == "terminal_failed" else None,
    }


def _select_pipeline_row(rows, expected_name):
    exact = [x for x in (rows or []) if str(x.get("pipelineName") or "").strip() == expected_name]
    if not exact:
        return None
    exact.sort(key=lambda x: str(x.get("createTime") or ""), reverse=True)
    row = exact[0]
    pid = str(row.get("pipelineId") or "").strip()
    return row if pid else None


def _query_rows(pp_request, token, name):
    resp = pp_request.query(token, "", name, "")
    if not isinstance(resp, dict) or int(resp.get("errorCode", -1)) != 0:
        return None
    return resp.get("result") or []


def _resolve_pipeline_by_name(token, task_id):
    expected_name = parser_impl.expected_task_name(task_id)
    if not expected_name:
        return {"ok": False, "failure_class": "BAIDU_PIPELINE_NAME_INVALID"}
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        rows = _query_rows(pp_request, token, expected_name)
        if rows is None:
            return {"ok": False, "failure_class": "BAIDU_PIPELINE_RECOVERY_API_ERROR"}
        row = _select_pipeline_row(rows, expected_name)
        if not row:
            all_rows = _query_rows(pp_request, token, "")
            if all_rows is None:
                return {"ok": False, "failure_class": "BAIDU_PIPELINE_GLOBAL_QUERY_API_ERROR"}
            row = _select_pipeline_row(all_rows, expected_name)
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_PIPELINE_RECOVERY_REQUEST_FAILED"}
    if not row:
        return {"ok": False, "failure_class": "BAIDU_PIPELINE_ABSENT_AFTER_GLOBAL_QUERY"}
    pid = str(row.get("pipelineId") or "").strip()
    category = _stage_category(row.get("stage"))
    diagnostic = _safe_pipeline_diagnostic(row)
    return {
        "ok": True,
        "pipeline_id": pid,
        "category": category,
        "diagnostic": diagnostic,
        "terminal_failure_class": _classify_terminal_diagnostic(diagnostic) if category == "terminal_failed" else None,
    }


def _list_output(token, pipeline_id):
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
        file_key = str(result["fileKey"]).lstrip("/").rstrip("/") + "/"
        conf = BceClientConfiguration(
            credentials=BceCredentials(result["accessKeyId"], result["secretAccessKey"]),
            endpoint=result["endpoint"],
            security_token=result["sessionToken"],
        )
        client = BosClient(conf)
        listing = client.list_objects(result["bucketName"], prefix=file_key, delimiter="/")
        names = set()
        for item in getattr(listing, "contents", []) or []:
            key = str(getattr(item, "key", ""))
            if key.startswith(file_key):
                key = key[len(file_key):]
            if key:
                names.add(key)
        return {"ok": True, "target_present": TARGET_RESULT in names}
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_LIST_FAILED"}


def diagnostic_check(task_id, stored_job_id):
    if not stored_job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=stored_job_id, stage="result_polling")
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")

    active_pipeline_id = stored_job_id
    recovered = False
    q = _query_pipeline(token, active_pipeline_id)
    if not q.get("ok") and q.get("failure_class") == "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND":
        recovery = _resolve_pipeline_by_name(token, task_id)
        if not recovery.get("ok"):
            return _fail(task_id, stored_job_id, recovery["failure_class"])
        active_pipeline_id = recovery["pipeline_id"]
        recovered = active_pipeline_id != stored_job_id
        q = recovery
    elif not q.get("ok"):
        return _fail(task_id, stored_job_id, q["failure_class"])

    if q.get("category") == "not_finished":
        return _fail(task_id, stored_job_id, "BAIDU_JOB_NOT_FINISHED", upstream_diagnostic=q.get("diagnostic"))
    if q.get("category") == "terminal_failed":
        failure_class = str(q.get("terminal_failure_class") or "BAIDU_JOB_TERMINAL_FAILED")
        return _fail(
            task_id,
            stored_job_id,
            failure_class,
            stage="baidu_terminal_failed",
            upstream_diagnostic=q.get("diagnostic"),
        )

    listing = _list_output(token, active_pipeline_id)
    if not listing.get("ok"):
        return _fail(task_id, stored_job_id, listing["failure_class"])
    if not listing.get("target_present"):
        return _fail(task_id, stored_job_id, "BAIDU_RESULT_FILE_NOT_LISTED")

    with tempfile.TemporaryDirectory(prefix="three-center-check4-") as td:
        result = impl.fetch_result(task_id, active_pipeline_id, pathlib.Path(td) / TARGET_RESULT)
    if result is None:
        return _fail(task_id, stored_job_id, "BAIDU_RESULT_LISTED_BUT_DOWNLOAD_FAILED")

    if recovered:
        impl.callback(task_id, "FETCH", "completed", result=result, stage="result_retrieved")
    else:
        impl.callback(task_id, "FETCH", "completed", baidu_job_id=stored_job_id, result=result, stage="result_retrieved")
    return 0


def selftest():
    cases = {
        "running": "not_finished",
        "queued": "not_finished",
        "运行中": "not_finished",
        "failed": "terminal_failed",
        "已停止": "terminal_failed",
        "success": "finished",
        "completed": "finished",
        "mystery-stage": "unknown",
    }
    for raw, expected in cases.items():
        actual = _stage_category(raw)
        if actual != expected:
            raise AssertionError(f"STAGE_CLASS_MISMATCH:{raw}:{actual}:{expected}")
    name = "three-center-baidu-circleci-live-20260815d"
    rows = [
        {"pipelineId": "111", "pipelineName": "other", "stage": "success", "createTime": "2026-08-15 10:00:00"},
        {"pipelineId": "222", "pipelineName": name, "stage": "success", "createTime": "2026-08-15 10:01:00"},
        {"pipelineId": "333", "pipelineName": name, "stage": "success", "createTime": "2026-08-15 10:02:00"},
    ]
    picked = _select_pipeline_row(rows, name)
    if not picked or str(picked.get("pipelineId")) != "333":
        raise AssertionError("PIPELINE_NAME_RECOVERY_SELECTION_FAILED")
    sample = {
        "pipelineId": "secret-job-id",
        "pipelineName": "should-not-leak",
        "stage": "failed",
        "errorCode": 12001,
        "errorMessage": "runtime image failed token=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        "runtime": "paddle2.4_py3.7",
        "secretAccessKey": "must-not-leak",
    }
    safe = _safe_pipeline_diagnostic(sample)
    if "pipelineId" in safe or "pipelineName" in safe or "secretAccessKey" in safe:
        raise AssertionError("DIAGNOSTIC_ALLOWLIST_FAILED")
    if "[REDACTED]" not in str(safe.get("errorMessage")):
        raise AssertionError("DIAGNOSTIC_REDACTION_FAILED")
    if _classify_terminal_diagnostic(safe) != "BAIDU_JOB_RUNTIME_ENV_FAILED":
        raise AssertionError("TERMINAL_DETAIL_CLASSIFICATION_FAILED")
    print(json.dumps({"ok": True, "suite": "baidu-status-output-diagnostic-v4", "cases": len(cases) + 4, "global_lookup": True, "safe_terminal_diagnostic": True, "diagnostic_allowlist": True}))
    return 0


impl.parse_job_id = parser_impl.parse_job_id


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-diagnostic":
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
