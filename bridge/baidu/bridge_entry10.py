import json
import pathlib
import sys
import tempfile
import time

import bridge as impl
import bridge_entry4 as check_impl


def inline_command(task_id):
    payload = (
        "import json,os;"
        "os.makedirs('/home/aistudio/output',exist_ok=True);"
        "r=os.path.exists('/home/aistudio/run.py');"
        "t=os.path.exists('/home/aistudio/task.json');"
        f"o={{'ok':False,'task_id':'{task_id}','profile':'gpu',"
        "'failure_class':('BAIDU_INLINE_CANARY_FILES_PRESENT' if r and t else 'BAIDU_INLINE_CANARY_FILES_MISSING'),"
        "'failure_stage':('inline_files_present' if r and t else 'inline_files_missing')};"
        "json.dump(o,open('/home/aistudio/output/three-center-result.json','w'),sort_keys=True)"
    )
    return f'python3 -c "{payload}"'


def submit_and_wait_inline(task_id):
    manifest = impl.api("GET", f"/v1/providers/baidu/bridge/task/{task_id}")
    timeout_seconds = max(60, min(900, int(manifest.get("timeout_seconds") or 180)))
    with tempfile.TemporaryDirectory(prefix="three-center-baidu-inline-") as td:
        work = pathlib.Path(td)
        (work / "probe.txt").write_text("fixed-inline-canary\n", encoding="utf-8")
        p = impl.run([
            "aistudio", "submit", "job",
            "--name", impl.expected_pipeline_name(task_id),
            "--path", str(work),
            "--cmd", inline_command(task_id),
            "--env", "paddle2.6_py3.10",
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
        impl.callback(task_id, "CHECK", "running", baidu_job_id=job_id, stage="result_polling")
        while time.time() < deadline:
            result = impl.fetch_result(task_id, job_id, result_path)
            if result is not None:
                impl.callback(task_id, "FETCH", "completed", baidu_job_id=job_id, result=result, stage="result_retrieved")
                return 0
            print("inline_canary pending", flush=True)
            time.sleep(15)
        impl.callback(task_id, "FETCH", "failed", baidu_job_id=job_id, error="BAIDU_RESULT_TIMEOUT", failure_class="BAIDU_RESULT_TIMEOUT", stage="result_polling")
        return 2


def selftest():
    task_id="baidu-circleci-live-20260815j"
    cmd=inline_command(task_id)
    for needle in ["python3 -c",task_id,"three-center-result.json","BAIDU_INLINE_CANARY_FILES_PRESENT","BAIDU_INLINE_CANARY_FILES_MISSING"]:
        if needle not in cmd: raise AssertionError("INLINE_CANARY_COMMAND_MISSING:"+needle)
    print(json.dumps({"ok":True,"suite":"baidu-inline-startup-canary","cases":5}))
    return 0


impl.submit_and_wait = submit_and_wait_inline

if __name__ == "__main__":
    if len(sys.argv)>1 and sys.argv[1]=="--selftest-inline":
        sys.exit(selftest())
    try:
        op=impl.env("BRIDGE_OP").upper(); task_id=impl.env("BRIDGE_TASK_ID"); impl.env("BRIDGE_TICKET")
        job_id=impl.env("BRIDGE_BAIDU_JOB_ID",required=False)
        if op not in impl.ALLOWED_OPS: raise RuntimeError("BRIDGE_OPERATION_DENIED")
        if op=="CHECK":
            impl.callback(task_id,op,"running",stage="circleci_started"); impl.auth(task_id,op)
            sys.exit(check_impl.diagnostic_check(task_id,job_id))
        sys.exit(impl.main())
    except Exception as exc:
        task=__import__('os').environ.get('BRIDGE_TASK_ID','').strip(); op=__import__('os').environ.get('BRIDGE_OP','UNKNOWN').strip().upper()
        if task:
            try: impl.callback(task,op,"failed",error=impl.redact_cli(str(exc))[:500],failure_class=impl.failure_class(exc))
            except Exception: pass
        print(f"bridge_failed:{impl.failure_class(exc)}",file=sys.stderr); sys.exit(1)
