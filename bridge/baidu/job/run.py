import hashlib
import json
import os
import signal
import time

import paddle


def clamp(value, low, high, default):
    try:
        return max(low, min(high, int(value)))
    except Exception:
        return default


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

    def timed_out(_signum, _frame):
        raise TimeoutError("TASK_TIMEOUT")

    signal.signal(signal.SIGALRM, timed_out)
    signal.alarm(timeout_seconds)
    t0 = time.time()
    paddle.seed(seed)
    selected = paddle.set_device("gpu:0")
    if "gpu" not in str(selected).lower():
        raise RuntimeError("V100_GPU_NOT_AVAILABLE")
    a = paddle.randn([matrix, matrix], dtype="float32")
    b = paddle.randn([matrix, matrix], dtype="float32")
    c = None
    for _ in range(rounds):
        c = paddle.matmul(a, b)
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
    os.makedirs("/home/aistudio/output", exist_ok=True)
    with open("/home/aistudio/output/three-center-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, sort_keys=True)
    signal.alarm(0)
    print("THREE_CENTER_RESULT:" + json.dumps(result, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
