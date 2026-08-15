import os
import pathlib
import re
import sys
import tempfile

import bridge as impl
import bridge_entry2 as parser_impl


def classify_cp_failure(text):
    s = str(text or "").lower()
    if any(x in s for x in ["permission denied", "access denied", "forbidden", "unauthorized", "无权限", "权限不足", "未授权"]):
        return "BAIDU_JOB_ACCESS_DENIED"
    if any(x in s for x in ["running", "pending", "queued", "not finished", "not complete", "排队", "运行中", "尚未完成", "未完成"]):
        return "BAIDU_JOB_NOT_FINISHED"
    if any(x in s for x in ["three-center-result.json", "/home/aistudio/output", "no such file", "file not found", "result file", "结果文件"]):
        return "BAIDU_RESULT_FILE_NOT_FOUND"
    if any(x in s for x in ["job not found", "job_id not found", "job id not found", "invalid job", "invalid job_id", "jobid", "任务不存在", "任务id不存在", "任务 id 不存在"]):
        return "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND"
    if ("not found" in s or "不存在" in s) and "file" not in s and "文件" not in s:
        return "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND"
    if any(x in s for x in ["expired", "过期"]):
        return "BAIDU_JOB_EXPIRED"
    return "BAIDU_CP_UNKNOWN_ERROR"


def diagnostic_check(task_id, job_id):
    if not job_id:
        raise RuntimeError("MISSING_BAIDU_JOB_ID")
    impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
    last = ""
    with tempfile.TemporaryDirectory(prefix="three-center-check-") as td:
        dest = pathlib.Path(td) / "three-center-result.json"
        for remote in impl.RESULT_CANDIDATES:
            p = impl.run(
                ["aistudio", "job", job_id, "cp", remote, str(dest)],
                check=False,
                label="AISTUDIO_RESULT_CLI",
            )
            combined = impl.redact_cli((p.stderr or "") + "\n" + (p.stdout or ""))
            if p.returncode == 0 and dest.exists() and dest.stat().st_size <= 65536:
                try:
                    import json
                    result = json.loads(dest.read_text(encoding="utf-8"))
                    impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                    return 0
                except Exception:
                    dest.unlink(missing_ok=True)
                    last = "RESULT_JSON_INVALID"
                    continue
            if combined.strip():
                last = combined
    failure = classify_cp_failure(last)
    impl.callback(task_id, "CHECK", "failed", baidu_job_id=job_id, error=failure, failure_class=failure, stage="result_polling")
    return 2


def selftest():
    cases = {
        "job not found": "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND",
        "任务ID不存在": "BAIDU_JOB_ID_INVALID_OR_NOT_FOUND",
        "job is pending": "BAIDU_JOB_NOT_FINISHED",
        "任务排队中": "BAIDU_JOB_NOT_FINISHED",
        "No such file: /home/aistudio/output/three-center-result.json": "BAIDU_RESULT_FILE_NOT_FOUND",
        "permission denied": "BAIDU_JOB_ACCESS_DENIED",
        "job expired": "BAIDU_JOB_EXPIRED",
        "unexpected transport error": "BAIDU_CP_UNKNOWN_ERROR",
    }
    for raw, expected in cases.items():
        actual = classify_cp_failure(raw)
        if actual != expected:
            raise AssertionError(f"CLASSIFY_MISMATCH:{raw}:{actual}:{expected}")
    print('{"ok":true,"suite":"baidu-check-diagnostic-classifier","cases":8}')
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
