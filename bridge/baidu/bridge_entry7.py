import json
import os
import sys

import bridge as impl
import bridge_entry5 as query_impl
import bridge_entry6 as log_impl


def _classify_output_api_error(resp):
    msg = str((resp or {}).get("errorMsg") or "").lower()
    if not msg:
        return "BAIDU_OUTPUT_ACCESS_API_ERROR_NO_MESSAGE"
    checks = [
        (["not finished", "running", "pending", "queued", "未完成", "运行中", "排队"], "BAIDU_OUTPUT_UNAVAILABLE_TASK_NOT_FINISHED"),
        (["failed", "failure", "task status", "pipeline status", "状态不允许", "任务失败", "产线失败", "失败状态"], "BAIDU_OUTPUT_UNAVAILABLE_TERMINAL_FAILED_STATE"),
        (["not found", "does not exist", "不存在", "无此任务", "任务不存在", "产线不存在"], "BAIDU_OUTPUT_PIPELINE_NOT_FOUND"),
        (["permission", "forbidden", "unauthorized", "无权限", "权限不足", "未授权"], "BAIDU_OUTPUT_ACCESS_DENIED"),
        (["no output", "output not found", "filekey", "file key", "无输出", "输出不存在", "结果不存在"], "BAIDU_OUTPUT_NOT_PERSISTED"),
        (["expired", "过期"], "BAIDU_OUTPUT_ACCESS_EXPIRED"),
    ]
    for needles, cls in checks:
        if any(x in msg for x in needles):
            return cls
    return "BAIDU_OUTPUT_ACCESS_API_ERROR_REPORTED"


def _probe_output_access(token, pipeline_id):
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        resp = pp_request.bosacl_ls_cp(token, pipeline_id)
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_ACCESS_REQUEST_FAILED"}
    if not isinstance(resp, dict):
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_ACCESS_API_ERROR_BAD_RESPONSE"}
    if int(resp.get("errorCode", -1)) != 0:
        return {"ok": False, "failure_class": _classify_output_api_error(resp)}
    return {"ok": True}


def diagnostic_check(task_id, stored_job_id):
    if not stored_job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=stored_job_id, stage="result_polling")
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    q = query_impl._query_pipeline_with_reason(token, stored_job_id)
    if not q.get("ok") or q.get("category") != "terminal_failed":
        return log_impl.diagnostic_check(task_id, stored_job_id)
    access = _probe_output_access(token, stored_job_id)
    if not access.get("ok"):
        return query_impl.prev._fail(task_id, stored_job_id, access["failure_class"])
    return log_impl.diagnostic_check(task_id, stored_job_id)


def selftest():
    cases = [
        ({"errorMsg": "任务失败状态不允许获取输出"}, "BAIDU_OUTPUT_UNAVAILABLE_TERMINAL_FAILED_STATE"),
        ({"errorMsg": "pipeline not found"}, "BAIDU_OUTPUT_PIPELINE_NOT_FOUND"),
        ({"errorMsg": "permission denied"}, "BAIDU_OUTPUT_ACCESS_DENIED"),
        ({"errorMsg": "output not found"}, "BAIDU_OUTPUT_NOT_PERSISTED"),
        ({"errorMsg": "unknown business error"}, "BAIDU_OUTPUT_ACCESS_API_ERROR_REPORTED"),
        ({}, "BAIDU_OUTPUT_ACCESS_API_ERROR_NO_MESSAGE"),
    ]
    for resp, expected in cases:
        actual = _classify_output_api_error(resp)
        if actual != expected:
            raise AssertionError(f"OUTPUT_API_CLASS_MISMATCH:{actual}:{expected}")
    print(json.dumps({"ok": True, "suite": "baidu-output-api-safe-classifier", "cases": len(cases)}))
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-outputapi":
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
