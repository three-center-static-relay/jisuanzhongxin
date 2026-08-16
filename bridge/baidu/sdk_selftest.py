import importlib.metadata
import inspect
import json
import os
import subprocess
import sys

import bridge as impl

EXPECTED_VERSION = "0.3.9"
RESULT_SCHEMA = "baidu-sdk039-selftest-result-v1"
QUERY_TIMEOUT_SECONDS = 25


def _run_cli(args):
    try:
        proc = subprocess.run(args, text=True, capture_output=True, timeout=30, shell=False)
    except FileNotFoundError:
        raise RuntimeError("AISTUDIO_CLI_NOT_FOUND")
    except subprocess.TimeoutExpired:
        raise RuntimeError("AISTUDIO_CLI_HELP_TIMEOUT")
    if proc.returncode != 0:
        raise RuntimeError("AISTUDIO_CLI_HELP_FAILED")
    return True


def _query_child():
    token = os.environ.get("BAIDU_AISTUDIO_ACCESS_TOKEN", "").strip()
    if not token:
        print(json.dumps({"ok": False, "failure_class": "MISSING_BAIDU_AISTUDIO_ACCESS_TOKEN"}))
        return 2
    try:
        from aistudio_sdk.requests import pipeline as pipeline_request
        query = getattr(pipeline_request, "query", None)
        output_access = getattr(pipeline_request, "bosacl_ls_cp", None)
        if not callable(query):
            raise RuntimeError("AISTUDIO_PIPELINE_QUERY_MISSING")
        if not callable(output_access):
            raise RuntimeError("AISTUDIO_OUTPUT_ACCESS_API_MISSING")
        query_sig = inspect.signature(query)
        output_sig = inspect.signature(output_access)
        response = query(token, "", "", "")
        if not isinstance(response, dict):
            raise RuntimeError("AISTUDIO_PIPELINE_QUERY_BAD_RESPONSE")
        if int(response.get("errorCode", -1)) != 0:
            raise RuntimeError("AISTUDIO_PIPELINE_QUERY_FAILED")
        print(json.dumps({
            "ok": True,
            "pipeline_query_ok": True,
            "pipeline_query_result_is_list": isinstance(response.get("result"), list),
            "pipeline_query_parameter_count": len(query_sig.parameters),
            "output_access_callable": True,
            "output_access_parameter_count": len(output_sig.parameters),
        }, separators=(",", ":")))
        return 0
    except RuntimeError as exc:
        print(json.dumps({"ok": False, "failure_class": str(exc)[:80]}, separators=(",", ":")))
        return 2
    except Exception:
        print(json.dumps({"ok": False, "failure_class": "AISTUDIO_PIPELINE_QUERY_EXCEPTION"}, separators=(",", ":")))
        return 2


def _bounded_query():
    try:
        proc = subprocess.run(
            [sys.executable, os.path.abspath(__file__), "--query-child"],
            text=True,
            capture_output=True,
            timeout=QUERY_TIMEOUT_SECONDS,
            shell=False,
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("AISTUDIO_PIPELINE_QUERY_TIMEOUT")
    lines = [x.strip() for x in (proc.stdout or "").splitlines() if x.strip()]
    try:
        obj = json.loads(lines[-1]) if lines else {}
    except Exception:
        obj = {}
    if proc.returncode != 0 or obj.get("ok") is not True:
        failure = str(obj.get("failure_class") or "AISTUDIO_PIPELINE_QUERY_CHILD_FAILED").strip().upper()
        if not failure.startswith("AISTUDIO_") and not failure.startswith("MISSING_"):
            failure = "AISTUDIO_PIPELINE_QUERY_CHILD_FAILED"
        raise RuntimeError(failure[:80])
    return obj


def _report(payload):
    path = os.environ.get("SDK_SELFTEST_CALLBACK_PATH", "").strip()
    if not path.startswith("/__callback/"):
        raise RuntimeError("SDK_SELFTEST_CALLBACK_PATH_INVALID")
    return impl.api("POST", path, payload)


def run_selftest():
    if not os.environ.get("BAIDU_AISTUDIO_ACCESS_TOKEN", "").strip():
        raise RuntimeError("MISSING_BAIDU_AISTUDIO_ACCESS_TOKEN")
    version = importlib.metadata.version("aistudio-sdk")
    if version != EXPECTED_VERSION:
        raise RuntimeError("AISTUDIO_SDK_VERSION_MISMATCH")
    cli_help = _run_cli(["aistudio", "--help"])
    job_help = _run_cli(["aistudio", "job", "-h"])
    query = _bounded_query()
    return {
        "schema": RESULT_SCHEMA,
        "ok": True,
        "suite": "baidu-sdk-0.3.9-control-plane-selftest",
        "sdk_version": version,
        "cli_help": cli_help,
        "job_help": job_help,
        **query,
        "gpu_submitted": False,
        "compute_credit_used": False,
        "secrets_emitted": False,
    }


def main():
    try:
        result = run_selftest()
        _report(result)
        print(json.dumps(result, separators=(",", ":"), ensure_ascii=False))
        return 0
    except Exception as exc:
        failure = str(exc or "AISTUDIO_SDK_SELFTEST_FAILED").strip().upper()
        if not (failure.startswith("AISTUDIO_") or failure.startswith("MISSING_") or failure.startswith("SDK_SELFTEST_")):
            failure = "AISTUDIO_SDK_SELFTEST_FAILED"
        result = {
            "schema": RESULT_SCHEMA,
            "ok": False,
            "suite": "baidu-sdk-0.3.9-control-plane-selftest",
            "sdk_version": EXPECTED_VERSION,
            "failure_class": failure[:80],
            "gpu_submitted": False,
            "compute_credit_used": False,
            "secrets_emitted": False,
        }
        try:
            _report(result)
        except Exception:
            pass
        print(json.dumps(result, separators=(",", ":"), ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--query-child":
        sys.exit(_query_child())
    sys.exit(main())
