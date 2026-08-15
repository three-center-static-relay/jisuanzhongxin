import json
import os
import pathlib
import re
import sys
import tempfile

import bridge as impl
import bridge_entry2 as parser_impl

TARGET_RESULT = "three-center-result.json"


def _fail(task_id, stored_job_id, failure_class):
    impl.callback(
        task_id,
        "CHECK",
        "failed",
        baidu_job_id=stored_job_id,
        error=failure_class,
        failure_class=failure_class,
        stage="result_polling",
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
    return {"ok": True, "category": _stage_category(stage), "pipeline_id": str(row.get("pipelineId") or pipeline_id)}


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
        # First use the documented name filter.
        rows = _query_rows(pp_request, token, expected_name)
        if rows is None:
            return {"ok": False, "failure_class": "BAIDU_PIPELINE_RECOVERY_API_ERROR"}
        row = _select_pipeline_row(rows, expected_name)
        if not row:
            # Zero-GPU fallback: query the visible pipeline list without a name
            # filter and perform the exact match locally. This distinguishes a
            # broken server-side name filter from a genuinely absent submit.
            all_rows = _query_rows(pp_request, token, "")
            if all_rows is None:
                return {"ok": False, "failure_class": "BAIDU_PIPELINE_GLOBAL_QUERY_API_ERROR"}
            row = _select_pipeline_row(all_rows, expected_name)
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_PIPELINE_RECOVERY_REQUEST_FAILED"}
    if not row:
        return {"ok": False, "failure_class": "BAIDU_PIPELINE_ABSENT_AFTER_GLOBAL_QUERY"}
    pid = str(row.get("pipelineId") or "").strip()
    return {"ok": True, "pipeline_id": pid, "category": _stage_category(row.get("stage"))}


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
        q = {"ok": True, "category": recovery.get("category", "unknown"), "pipeline_id": active_pipeline_id}
    elif not q.get("ok"):
        return _fail(task_id, stored_job_id, q["failure_class"])

    if q.get("category") == "not_finished":
        return _fail(task_id, stored_job_id, "BAIDU_JOB_NOT_FINISHED")
    if q.get("category") == "terminal_failed":
        return _fail(task_id, stored_job_id, "BAIDU_JOB_TERMINAL_FAILED")

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
    print(json.dumps({"ok": True, "suite": "baidu-status-output-diagnostic-v3", "cases": len(cases) + 1, "global_lookup": True}))
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
