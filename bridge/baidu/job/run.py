import argparse
import hashlib
import json
import os
import signal
import subprocess
import sys
import time


def clamp(value, low, high, default):
    try:
        return max(low, min(high, int(value)))
    except Exception:
        return default


def classify_exception(exc, stage=""):
    msg = str(exc or "").lower()
    name = exc.__class__.__name__.lower() if exc is not None else ""
    if stage == "load_task_manifest":
        return "BAIDU_RUNTIME_TASK_MANIFEST_ERROR"
    if stage == "query_gpu_name":
        return "BAIDU_RUNTIME_GPU_UNAVAILABLE"
    if isinstance(exc, TimeoutError) or "task_timeout" in msg or "timed out" in msg or "timeout" in msg:
        return "BAIDU_RUNTIME_TIMEOUT"
    if isinstance(exc, (ImportError, ModuleNotFoundError)) or "no module named" in msg or "importerror" in msg:
        return "BAIDU_RUNTIME_DEPENDENCY_ERROR"
    if isinstance(exc, MemoryError) or "out of memory" in msg or "cuda oom" in msg:
        return "BAIDU_RUNTIME_OOM"
    if "v100_gpu_not_available" in msg or "gpu not available" in msg or ("gpu:0" in msg and "not" in msg):
        return "BAIDU_RUNTIME_GPU_UNAVAILABLE"
    if "cuda" in msg or "cudnn" in msg:
        return "BAIDU_RUNTIME_CUDA_ERROR"
    if "permission" in msg or "forbidden" in msg:
        return "BAIDU_RUNTIME_PERMISSION_ERROR"
    if "filenotfound" in name or "no such file" in msg or "file not found" in msg:
        return "BAIDU_RUNTIME_PACKAGE_FILE_ERROR"
    return "BAIDU_RUNTIME_EXECUTION_ERROR"


def write_result(result):
    os.makedirs("/home/aistudio/output", exist_ok=True)
    with open("/home/aistudio/output/three-center-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, sort_keys=True)
    print("THREE_CENTER_RESULT:" + json.dumps(result, sort_keys=True), flush=True)


def parse_args(argv=None):
    p = argparse.ArgumentParser(add_help=False)
    p.add_argument("--task-id", default="")
    p.add_argument("--profile", default="gpu")
    return p.parse_known_args(argv)[0]


def selftest():
    cases = [
        (ModuleNotFoundError("No module named paddle"), "import_paddle", "BAIDU_RUNTIME_DEPENDENCY_ERROR"),
        (TimeoutError("TASK_TIMEOUT"), "matmul", "BAIDU_RUNTIME_TIMEOUT"),
        (MemoryError("out of memory"), "matmul", "BAIDU_RUNTIME_OOM"),
        (RuntimeError("V100_GPU_NOT_AVAILABLE"), "select_gpu", "BAIDU_RUNTIME_GPU_UNAVAILABLE"),
        (RuntimeError("nvidia-smi failed"), "query_gpu_name", "BAIDU_RUNTIME_GPU_UNAVAILABLE"),
        (RuntimeError("CUDA initialization failed"), "select_gpu", "BAIDU_RUNTIME_CUDA_ERROR"),
        (FileNotFoundError("task.json"), "load_task_manifest", "BAIDU_RUNTIME_TASK_MANIFEST_ERROR"),
        (RuntimeError("unexpected"), "matmul", "BAIDU_RUNTIME_EXECUTION_ERROR"),
    ]
    for exc, stage, expected in cases:
        actual = classify_exception(exc, stage)
        if actual != expected:
            raise AssertionError(f"RUNTIME_CLASS_MISMATCH:{actual}:{expected}")
    args = parse_args(["--task-id", "baidu-circleci-live-20260816p25b", "--profile", "gpu"])
    if args.task_id != "baidu-circleci-live-20260816p25b" or args.profile != "gpu":
        raise AssertionError("RUNTIME_BOOTSTRAP_ARGS_FAILED")
    print(json.dumps({"ok": True, "suite": "baidu-structured-runtime-bootstrap", "cases": len(cases) + 1, "runtime_gpu_attestation": True}))
    return 0


def main(argv=None):
    args = parse_args(argv)
    task_id = str(args.task_id or "").strip()
    profile = str(args.profile or "gpu").strip() or "gpu"
    stage = "bootstrap"
    t0 = time.time()
    timeout_seconds = 300
    matrix = 1024
    rounds = 2
    seed = 20260815

    def timed_out(_signum, _frame):
        raise TimeoutError("TASK_TIMEOUT")

    try:
        if not task_id:
            raise RuntimeError("TASK_ID_BOOTSTRAP_MISSING")
        stage = "load_task_manifest"
        with open("/home/aistudio/task.json", "r", encoding="utf-8") as f:
            task = json.load(f)
        if str(task.get("task_id") or "") != task_id:
            raise RuntimeError("TASK_ID_MANIFEST_MISMATCH")
        profile = str(task.get("profile") or profile)
        timeout_seconds = clamp(task.get("timeout_seconds"), 60, 900, 300)
        data = task.get("input") or {}
        matrix = clamp(data.get("matrix_size"), 256, 2048, 1024)
        rounds = clamp(data.get("rounds"), 1, 5, 2)
        seed = clamp(data.get("seed"), 1, 2147483647, 20260815)

        stage = "install_timeout_guard"
        signal.signal(signal.SIGALRM, timed_out)
        signal.alarm(timeout_seconds)

        stage = "query_gpu_name"
        gpu_names = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            text=True,
            timeout=30,
        ).strip().splitlines()
        if not gpu_names:
            raise RuntimeError("V100_GPU_NOT_AVAILABLE:NO_GPU_NAME")
        gpu_name = gpu_names[0].strip()
        if "V100" not in gpu_name.upper():
            raise RuntimeError("V100_GPU_NOT_AVAILABLE:" + gpu_name)

        stage = "import_paddle"
        import paddle
        stage = "verify_paddle_cuda"
        paddle_cuda = bool(paddle.device.is_compiled_with_cuda())
        if not paddle_cuda:
            raise RuntimeError("CUDA_NOT_COMPILED")
        stage = "seed"
        paddle.seed(seed)
        stage = "select_gpu"
        selected = paddle.set_device("gpu:0")
        if "gpu" not in str(selected).lower():
            raise RuntimeError("V100_GPU_NOT_AVAILABLE")
        stage = "allocate_matrices"
        a = paddle.randn([matrix, matrix], dtype="float32")
        b = paddle.randn([matrix, matrix], dtype="float32")
        c = None
        stage = "matmul"
        for _ in range(rounds):
            c = paddle.matmul(a, b)
        stage = "materialize_result"
        sample = c[:16, :16].numpy().tobytes()
        result = {
            "ok": True,
            "task_id": task_id,
            "profile": profile,
            "accelerator": "v100",
            "gpu_name": gpu_name,
            "cuda": True,
            "paddle_cuda": paddle_cuda,
            "device": str(paddle.device.get_device()),
            "matrix_size": matrix,
            "rounds": rounds,
            "matrix_checksum": hashlib.sha256(sample).hexdigest(),
            "elapsed_s": time.time() - t0,
        }
        write_result(result)
    except Exception as exc:
        result = {
            "ok": False,
            "task_id": task_id or "bootstrap-missing",
            "profile": profile,
            "failure_class": classify_exception(exc, stage),
            "failure_stage": stage,
            "elapsed_s": time.time() - t0,
        }
        write_result(result)
    finally:
        try:
            signal.alarm(0)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        sys.exit(selftest())
    sys.exit(main(sys.argv[1:]))
