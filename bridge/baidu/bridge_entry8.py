import json
import os
import re
import sys

import bridge as impl
import bridge_entry5 as query_impl
import bridge_entry6 as log_impl
import bridge_entry7 as prev


def _probe_output_access_with_code(token, pipeline_id):
    try:
        from aistudio_sdk.requests import pipeline as pp_request
        resp = pp_request.bosacl_ls_cp(token, pipeline_id)
    except Exception:
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_ACCESS_REQUEST_FAILED"}
    if not isinstance(resp, dict):
        return {"ok": False, "failure_class": "BAIDU_OUTPUT_ACCESS_API_ERROR_BAD_RESPONSE"}
    try:
        code = int(resp.get("errorCode", -1))
    except Exception:
        code = -1
    if code == 0:
        return {"ok": True}
    cls = prev._classify_output_api_error(resp)
    if cls == "BAIDU_OUTPUT_ACCESS_API_ERROR_REPORTED" and re.fullmatch(r"-?\d{1,12}", str(code)):
        safe_code = str(code).replace("-", "NEG_")
        cls = f"BAIDU_OUTPUT_API_CODE_{safe_code}"
    return {"ok": False, "failure_class": cls}


def diagnostic_check(task_id, stored_job_id):
    if not stored_job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=stored_job_id, stage="result_polling")
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    q = query_impl._query_pipeline_with_reason(token, stored_job_id)
    if not q.get("ok") or q.get("category") != "terminal_failed":
        return log_impl.diagnostic_check(task_id, stored_job_id)
    access = _probe_output_access_with_code(token, stored_job_id)
    if not access.get("ok"):
        return query_impl.prev._fail(task_id, stored_job_id, access["failure_class"])
    return log_impl.diagnostic_check(task_id, stored_job_id)


def selftest():
    cases = [
        ({"errorCode": 12345, "errorMsg": "unknown business error"}, "BAIDU_OUTPUT_API_CODE_12345"),
        ({"errorCode": 99, "errorMsg": "permission denied"}, "BAIDU_OUTPUT_ACCESS_DENIED"),
        ({"errorCode": 0, "errorMsg": ""}, None),
    ]
    for resp, expected in cases:
        if int(resp.get("errorCode", -1)) == 0:
            continue
        cls = prev._classify_output_api_error(resp)
        if cls == "BAIDU_OUTPUT_ACCESS_API_ERROR_REPORTED":
            code = int(resp.get("errorCode", -1))
            cls = f"BAIDU_OUTPUT_API_CODE_{str(code).replace('-', 'NEG_')}"
        if cls != expected:
            raise AssertionError(f"OUTPUT_CODE_CLASS_MISMATCH:{cls}:{expected}")
    print(json.dumps({"ok": True, "suite": "baidu-output-api-code-classifier", "cases": len(cases)}))
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-outputcode":
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
