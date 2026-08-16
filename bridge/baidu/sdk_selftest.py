import importlib.metadata
import inspect
import json
import os
import subprocess
import sys

EXPECTED_VERSION = "0.3.9"


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


def main():
    token = os.environ.get("BAIDU_AISTUDIO_ACCESS_TOKEN", "").strip()
    if not token:
        raise RuntimeError("MISSING_BAIDU_AISTUDIO_ACCESS_TOKEN")

    version = importlib.metadata.version("aistudio-sdk")
    if version != EXPECTED_VERSION:
        raise RuntimeError("AISTUDIO_SDK_VERSION_MISMATCH")

    cli_help = _run_cli(["aistudio", "--help"])
    job_help = _run_cli(["aistudio", "job", "-h"])

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
    query_ok = isinstance(response, dict) and int(response.get("errorCode", -1)) == 0
    if not query_ok:
        raise RuntimeError("AISTUDIO_PIPELINE_QUERY_FAILED")

    result = response.get("result")
    safe = {
        "ok": True,
        "suite": "baidu-sdk-0.3.9-control-plane-selftest",
        "sdk_version": version,
        "cli_help": cli_help,
        "job_help": job_help,
        "pipeline_query_callable": True,
        "pipeline_query_ok": True,
        "pipeline_query_result_is_list": isinstance(result, list),
        "pipeline_query_parameter_count": len(query_sig.parameters),
        "output_access_callable": True,
        "output_access_parameter_count": len(output_sig.parameters),
        "gpu_submitted": False,
        "compute_credit_used": False,
        "secrets_emitted": False,
    }
    print(json.dumps(safe, separators=(",", ":"), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "suite": "baidu-sdk-0.3.9-control-plane-selftest",
            "failure_class": str(exc)[:120],
            "gpu_submitted": False,
            "compute_credit_used": False,
            "secrets_emitted": False,
        }, separators=(",", ":"), ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
