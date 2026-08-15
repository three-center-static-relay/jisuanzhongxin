import json
import os
import pathlib
import re
import sys
import tempfile

import bridge as impl
import bridge_entry2 as parser_impl

TARGET_RESULT = "three-center-result.json"


def _fail(task_id, job_id, failure_class):
    impl.callback(
        task_id,
        "CHECK",
        "failed",
        baidu_job_id=job_id,
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


def _query_pipeline(token, job_id):
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        resp = pp_request.query(token, job_id, "", "")
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_QUERY_REQUEST_FAILED"}
    if not isinstance(resp, dict) or int(resp.get("errorCode", -1)) != 0:
        return {"ok": False, "failure_class": "BAIDU_QUERY_API_ERROR"}
    rows = resp.get("result") or []
    row = next((x for x in rows if str(x.get("pipelineId", "")) == str(job_id)), None)
    if not row:
        return {"ok": False, "failure_class": "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND"}
    stage = str(row.get("stage") or "")
    return {"ok": True, "category": _stage_category(stage)}


def _list_output(token, job_id):
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        from baidubce.auth.bce_credentials import BceCredentials
        from baidubce.bce_client_configuration import BceClientConfiguration
        from baidubce.services.bos.bos_client import BosClient
        resp = pp_request.bosacl_ls_cp(token, job_id)
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


def diagnostic_check(task_id, job_id):
    if not job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")

    q = _query_pipeline(token, job_id)
    if not q.get("ok"):
        return _fail(task_id, job_id, q["failure_class"])
    if q.get("category") == "not_finished":
        return _fail(task_id, job_id, "BAIDU_JOB_NOT_FINISHED")
    if q.get("category") == "terminal_failed":
        return _fail(task_id, job_id, "BAIDU_JOB_TERMINAL_FAILED")

    listing = _list_output(token, job_id)
    if not listing.get("ok"):
        return _fail(task_id, job_id, listing["failure_class"])
    if not listing.get("target_present"):
        return _fail(task_id, job_id, "BAIDU_RESULT_FILE_NOT_LISTED")

    with tempfile.TemporaryDirectory(prefix="three-center-check4-") as td:
        result = impl.fetch_result(task_id, job_id, pathlib.Path(td) / TARGET_RESULT)
    if result is None:
        return _fail(task_id, job_id, "BAIDU_RESULT_LISTED_BUT_DOWNLOAD_FAILED")
    impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
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
    print(json.dumps({"ok": True, "suite": "baidu-status-output-diagnostic", "cases": len(cases)}))
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
