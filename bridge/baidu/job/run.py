import hashlib
import json
import os
import signal
import sys
import time


def clamp(value, low, high, default):
    try:
        return max(low, min(high, int(value)))
    except Exception:
        return default


def classify_exception(exc):
    msg = str(exc or "").lower()
    name = exc.__class__.__name__.lower() if exc is not None else ""
    if isinstance(exc, TimeoutError) or "task_timeout" in msg or "timed out" in msg or "timeout" in msg:
        return "BAIDU_RUNTIME_TIMEOUT"
    if isinstance(exc, (ImportError, ModuleNotFoundError)) or "no module named" in msg or "importerror" in msg:
        return "BAIDU_RUNTIME_DEPENDENCY_ERROR"
    if isinstance(exc, MemoryError) or "out of memory" in msg or "cuda oom" in msg:
        return "BAIDU_RUNTIME_OOM"
    if "v100_gpu_not_available" in msg or "gpu not available" in msg or "gpu:0" in msg and "not" in msg:
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


def selftest():
    cases = [
        (ModuleNotFoundError("No module named paddle"), "BAIDU_RUNTIME_DEPENDENCY_ERROR"),
        (TimeoutError("TASK_TIMEOUT"), "BAIDU_RUNTIME_TIMEOUT"),
        (MemoryError("out of memory"), "BAIDU_RUNTIME_OOM"),
        (RuntimeError("V100_GPU_NOT_AVAILABLE"), "BAIDU_RUNTIME_GPU_UNAVAILABLE"),
        (RuntimeError("CUDA initialization failed"), "BAIDU_RUNTIME_CUDA_ERROR"),
        (RuntimeError("unexpected"), "BAIDU_RUNTIME_EXECUTION_ERROR"),
    ]
    for exc, expected in cases:
        actual = classify_exception(exc)
        if actual != expected:
            raise AssertionError(f"RUNTIME_CLASS_MISMATCH:{actual}:{expected}")
    print(json.dumps({"ok": True, "suite": "baidu-structured-runtime-failure", "cases": len(cases)}))
    return 0


def main():
    with open("task.json", "r", encoding="utf-8") as f:
        task = json.load(f)
    task_id = str(task["task_id"])
    profile = str(task.get("profile") or "gpu")
    timeout_seconds = clamp(task.get("timeout_seconds"), 60, 900, 300)
    data = task.get("input") or {}
    matrix = clamp(data.get("matrix_size"), 256, 2048, 1024)
    rounds = clamp(data.get("rounds"), 1, 5, 2)
    seed = clamp(data.get("seed"), 1, 2147483647, 20260815)
    stage = "runtime_init"
    t0 = time.time()

    def timed_out(_signum, _frame):
        raise TimeoutError("TASK_TIMEOUT")

    signal.signal(signal.SIGALRM, timed_out)
    signal.alarm(timeout_seconds)
    try:
        stage = "import_paddle"
        import paddle
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
            "cuda": True,
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
            "task_id": task_id,
            "profile": profile,
            "failure_class": classify_exception(exc),
            "failure_stage": stage,
            "elapsed_s": time.time() - t0,
        }
        write_result(result)
    finally:
        signal.alarm(0)
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        sys.exit(selftest())
    sys.exit(main())
