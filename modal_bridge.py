import math
import time

import modal
from fastapi import FastAPI, HTTPException

APP_NAME = "compute-center-modal-bridge"
API_VERSION = "2026-08-16.4"
MAX_VECTOR_ITEMS = 100_000

image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi[standard]")
gpu_image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi", "torch")
app = modal.App(APP_NAME)
web = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@web.get("/health")
def health():
    return {
        "ok": True,
        "service": APP_NAME,
        "api_version": API_VERSION,
        "transport": "https",
        "proxy_auth": True,
        "arbitrary_code": False,
        "network": "deny",
        "max_containers": 1,
        "max_inputs_per_container": 1,
        "cpu_request": 0.125,
        "cpu_limit": 0.25,
        "memory_request_mib": 128,
        "memory_limit_mib": 256,
        "paid_fallback": False,
        "web_function_retries": "unsupported-by-modal-and-omitted",
        "gpu_selftest": "t4-separate-proxy-auth-web-function",
    }


@web.post("/v1/selftest/cpu")
def cpu_selftest(item: dict):
    n = item.get("n", 10_000)
    if not isinstance(n, int) or n < 1 or n > MAX_VECTOR_ITEMS:
        raise HTTPException(status_code=400, detail="n must be an integer in [1, 100000]")
    started = time.perf_counter()
    checksum = sum(i * i for i in range(1, n + 1))
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    return {
        "ok": True,
        "selftest": "modal-cpu-bridge",
        "n": n,
        "checksum": checksum,
        "elapsed_ms": elapsed_ms,
    }


@web.post("/v1/compute")
def bounded_compute(item: dict):
    op = item.get("op")
    if op == "sum":
        values = item.get("values")
        if not isinstance(values, list) or len(values) > MAX_VECTOR_ITEMS:
            raise HTTPException(status_code=400, detail="values must be a list with at most 100000 items")
        if not all(isinstance(x, (int, float)) and math.isfinite(float(x)) for x in values):
            raise HTTPException(status_code=400, detail="values must contain only finite numbers")
        return {"ok": True, "op": "sum", "result": float(sum(values))}
    if op == "mean":
        values = item.get("values")
        if not isinstance(values, list) or not values or len(values) > MAX_VECTOR_ITEMS:
            raise HTTPException(status_code=400, detail="values must be a non-empty list with at most 100000 items")
        if not all(isinstance(x, (int, float)) and math.isfinite(float(x)) for x in values):
            raise HTTPException(status_code=400, detail="values must contain only finite numbers")
        return {"ok": True, "op": "mean", "result": float(sum(values) / len(values))}
    raise HTTPException(status_code=400, detail="unsupported op")


@app.function(
    image=image,
    cpu=(0.125, 0.25),
    memory=(128, 256),
    min_containers=0,
    max_containers=1,
    scaledown_window=30,
    timeout=30,
    block_network=True,
    restrict_modal_access=True,
)
@modal.concurrent(max_inputs=1)
@modal.asgi_app(requires_proxy_auth=True)
def bridge():
    return web


@app.function(
    image=gpu_image,
    gpu="T4",
    cpu=(0.125, 0.25),
    memory=(256, 512),
    min_containers=0,
    max_containers=1,
    scaledown_window=30,
    timeout=45,
    block_network=True,
    restrict_modal_access=True,
)
@modal.concurrent(max_inputs=1)
@modal.fastapi_endpoint(method="POST", requires_proxy_auth=True, docs=False)
def gpu_selftest(item: dict):
    n = item.get("n", 10_000)
    if not isinstance(n, int) or n < 1 or n > MAX_VECTOR_ITEMS:
        raise HTTPException(status_code=400, detail="n must be an integer in [1, 100000]")

    import torch

    if not torch.cuda.is_available():
        raise HTTPException(status_code=503, detail="CUDA unavailable")

    torch.cuda.synchronize()
    started = time.perf_counter()
    x = torch.arange(1, n + 1, dtype=torch.int64, device="cuda")
    checksum = int(torch.sum(x * x).item())
    torch.cuda.synchronize()
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)

    return {
        "ok": True,
        "selftest": "modal-t4-gpu-bridge",
        "gpu_requested": "T4",
        "cuda_available": True,
        "device_type": "cuda",
        "device_name": str(torch.cuda.get_device_name(0))[:120],
        "n": n,
        "checksum": checksum,
        "elapsed_ms": elapsed_ms,
        "arbitrary_code": False,
        "network": "deny",
        "max_containers": 1,
    }
