import json
import os
import re
import sys

import bridge as impl
import bridge_entry4 as prev


def _failure_material(row):
    values = []

    def walk(obj, key_hint=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                key = str(k).lower()
                if any(t in key for t in ["error", "err", "fail", "reason", "message", "msg", "detail", "exception", "exit", "remark", "description"]):
                    if isinstance(v, (str, int, float, bool)) and v not in (None, ""):
                        values.append(str(v))
                    else:
                        walk(v, key)
                elif isinstance(v, (dict, list, tuple)):
                    walk(v, key)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                walk(v, key_hint)
        elif key_hint and obj not in (None, ""):
            values.append(str(obj))

    walk(row)
    return " ".join(values).lower()


def _terminal_failure_class(row):
    s = _failure_material(row)
    if not s:
        return "BAIDU_JOB_TERMINAL_FAILED_NO_REASON_FIELD"
    checks = [
        (["out of memory", "cuda oom", "oom", "显存不足", "内存不足"], "BAIDU_JOB_RUNTIME_OOM"),
        (["no module named", "modulenotfound", "importerror", "module not found", "依赖缺失", "模块不存在"], "BAIDU_JOB_RUNTIME_DEPENDENCY_ERROR"),
        (["gpu not available", "cuda unavailable", "cuda error", "cudnn", "gpu error", "gpu不可用", "gpu 不可用"], "BAIDU_JOB_RUNTIME_GPU_ERROR"),
        (["file not found", "no such file", "run.py", "task.json", "文件不存在", "找不到文件"], "BAIDU_JOB_RUNTIME_PACKAGE_FILE_ERROR"),
        (["permission denied", "forbidden", "unauthorized", "权限不足", "无权限", "未授权"], "BAIDU_JOB_RUNTIME_PERMISSION_ERROR"),
        (["timeout", "timed out", "超时"], "BAIDU_JOB_RUNTIME_TIMEOUT"),
        (["cancelled", "canceled", "stopped", "terminated", "取消", "终止", "停止"], "BAIDU_JOB_RUNTIME_CANCELLED_OR_STOPPED"),
        (["exit code", "exitcode", "non-zero", "nonzero", "return code", "进程退出", "退出码"], "BAIDU_JOB_USER_PROCESS_NONZERO"),
        (["command failed", "cmd failed", "exec failed", "execution failed", "命令执行失败", "执行命令失败"], "BAIDU_JOB_COMMAND_EXECUTION_ERROR"),
        (["resource unavailable", "resource shortage", "no available node", "server unavailable", "调度失败", "资源不足", "无可用资源"], "BAIDU_JOB_INFRA_RESOURCE_ERROR"),
    ]
    for needles, cls in checks:
        if any(x in s for x in needles):
            return cls
    return "BAIDU_JOB_TERMINAL_FAILED_REPORTED_REASON"


def _query_pipeline_with_reason(token, pipeline_id):
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
    category = prev._stage_category(stage)
    return {
        "ok": True,
        "category": category,
        "pipeline_id": str(row.get("pipelineId") or pipeline_id),
        "terminal_failure_class": _terminal_failure_class(row) if category == "terminal_failed" else None,
    }


def diagnostic_check(task_id, stored_job_id):
    if not stored_job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=stored_job_id, stage="result_polling")
    token = impl.env("BAIDU_AISTUDIO_ACCESS_TOKEN")
    q = _query_pipeline_with_reason(token, stored_job_id)
    if q.get("ok") and q.get("category") == "terminal_failed":
        return prev._fail(task_id, stored_job_id, q.get("terminal_failure_class") or "BAIDU_JOB_TERMINAL_FAILED")
    return prev.diagnostic_check(task_id, stored_job_id)


def selftest():
    cases = [
        ({"stage": "failed", "errorMessage": "CUDA out of memory"}, "BAIDU_JOB_RUNTIME_OOM"),
        ({"stage": "failed", "reason": "ModuleNotFoundError: No module named x"}, "BAIDU_JOB_RUNTIME_DEPENDENCY_ERROR"),
        ({"stage": "failed", "detail": "process exit code 1"}, "BAIDU_JOB_USER_PROCESS_NONZERO"),
        ({"stage": "failed"}, "BAIDU_JOB_TERMINAL_FAILED_NO_REASON_FIELD"),
        ({"stage": "failed", "message": "worker failed"}, "BAIDU_JOB_TERMINAL_FAILED_REPORTED_REASON"),
    ]
    for row, expected in cases:
        actual = _terminal_failure_class(row)
        if actual != expected:
            raise AssertionError(f"TERMINAL_CLASS_MISMATCH:{actual}:{expected}")
    print(json.dumps({"ok": True, "suite": "baidu-terminal-failure-safe-classifier", "cases": len(cases)}))
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-terminal":
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
