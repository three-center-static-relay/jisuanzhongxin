import hashlib
import math
import random
import time

import modal
from fastapi import FastAPI, HTTPException

APP_NAME = "compute-center-modal-bridge"
API_VERSION = "2026-08-16.6"
MAX_VECTOR_ITEMS = 100_000
MAX_MONTE_CARLO_ITERATIONS = 1_000_000
BUSINESS_MODEL_ID = "baolong-milk-tea-v1"

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
        "cpu_limit": 0.5,
        "memory_request_mib": 128,
        "memory_limit_mib": 256,
        "paid_fallback": False,
        "web_function_retries": "unsupported-by-modal-and-omitted",
        "gpu_selftest": "t4-separate-proxy-auth-web-function",
        "gpu_cpu_request": 0.5,
        "gpu_cpu_limit": 1.0,
        "gpu_memory_request_mib": 512,
        "gpu_memory_limit_mib": 2048,
        "business_benchmark": BUSINESS_MODEL_ID,
        "business_benchmark_max_iterations": MAX_MONTE_CARLO_ITERATIONS,
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


def _q(sorted_values, p):
    if not sorted_values:
        return None
    idx = min(len(sorted_values) - 1, max(0, round((len(sorted_values) - 1) * p)))
    return round(sorted_values[idx], 2)


@web.post("/v1/benchmark/business-monte-carlo")
def business_monte_carlo(item: dict):
    iterations = item.get("iterations", 1_000_000)
    seed = item.get("seed", 20260816)
    model = item.get("model", BUSINESS_MODEL_ID)
    if model != BUSINESS_MODEL_ID:
        raise HTTPException(status_code=400, detail=f"model must be {BUSINESS_MODEL_ID}")
    if not isinstance(iterations, int) or iterations < 10_000 or iterations > MAX_MONTE_CARLO_ITERATIONS:
        raise HTTPException(status_code=400, detail="iterations must be an integer in [10000, 1000000]")
    if not isinstance(seed, int) or seed < 0 or seed > 2_147_483_647:
        raise HTTPException(status_code=400, detail="seed must be an integer in [0, 2147483647]")

    # Frozen Baolong milk-tea v1 assumptions. Triangular(low, high, mode).
    params = {
        "cups_per_day": [120.0, 360.0, 220.0],
        "realized_ticket_cny": [12.0, 18.0, 15.0],
        "ingredient_ratio": [0.34, 0.45, 0.40],
        "platform_promo_ratio": [0.03, 0.10, 0.06],
        "labor_cny_month": [18000.0, 28000.0, 23000.0],
        "rent_cny_month": [11000.0, 16000.0, 13000.0],
        "utilities_cny_month": [2500.0, 6000.0, 4000.0],
        "marketing_misc_cny_month": [2000.0, 8000.0, 5000.0],
        "days_per_month": 30,
    }

    rng = random.Random(seed)
    profitable = 0
    above_10k = 0
    below_minus_10k = 0
    total_profit = 0.0
    sample = []
    sample_stride = max(1, iterations // 100_000)
    started = time.perf_counter()

    for i in range(iterations):
        cups = rng.triangular(120.0, 360.0, 220.0)
        ticket = rng.triangular(12.0, 18.0, 15.0)
        ingredient = rng.triangular(0.34, 0.45, 0.40)
        platform = rng.triangular(0.03, 0.10, 0.06)
        labor = rng.triangular(18000.0, 28000.0, 23000.0)
        rent = rng.triangular(11000.0, 16000.0, 13000.0)
        utilities = rng.triangular(2500.0, 6000.0, 4000.0)
        misc = rng.triangular(2000.0, 8000.0, 5000.0)

        revenue = cups * ticket * 30.0
        profit = revenue * (1.0 - ingredient - platform) - labor - rent - utilities - misc
        total_profit += profit
        if profit > 0:
            profitable += 1
        if profit > 10_000:
            above_10k += 1
        if profit < -10_000:
            below_minus_10k += 1
        if i % sample_stride == 0 and len(sample) < 100_000:
            sample.append(profit)

    sample.sort()
    elapsed = time.perf_counter() - started
    mean_profit = total_profit / iterations
    result = {
        "ok": True,
        "benchmark": "business-monte-carlo",
        "model": BUSINESS_MODEL_ID,
        "iterations": iterations,
        "seed": seed,
        "mean_monthly_profit_cny": round(mean_profit, 2),
        "median_monthly_profit_cny_approx": _q(sample, 0.50),
        "p10_monthly_profit_cny_approx": _q(sample, 0.10),
        "p90_monthly_profit_cny_approx": _q(sample, 0.90),
        "profitable_probability": round(profitable / iterations, 6),
        "profit_above_10k_probability": round(above_10k / iterations, 6),
        "loss_below_minus_10k_probability": round(below_minus_10k / iterations, 6),
        "quantile_sample_size": len(sample),
        "elapsed_ms": round(elapsed * 1000, 3),
        "iterations_per_second": round(iterations / elapsed, 1) if elapsed > 0 else None,
        "accelerator": "cpu",
        "parameters": params,
        "arbitrary_code": False,
        "network": "deny",
    }
    signature_material = "|".join(
        [
            result["model"],
            str(result["iterations"]),
            str(result["seed"]),
            str(result["mean_monthly_profit_cny"]),
            str(result["profitable_probability"]),
            str(result["profit_above_10k_probability"]),
            str(result["loss_below_minus_10k_probability"]),
        ]
    )
    result["result_signature_sha256"] = hashlib.sha256(signature_material.encode()).hexdigest()
    return result


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
    cpu=(0.125, 0.5),
    memory=(128, 256),
    min_containers=0,
    max_containers=1,
    scaledown_window=30,
    timeout=90,
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
    cpu=(0.5, 1.0),
    memory=(512, 2048),
    min_containers=0,
    max_containers=1,
    scaledown_window=30,
    timeout=90,
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
