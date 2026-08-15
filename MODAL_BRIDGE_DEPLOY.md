# Modal HTTPS Bridge deployment contract

Source: `modal_bridge.py`

Deploy with Modal CLI or Modal Notebook using the existing Modal API token pair:

```bash
modal deploy modal_bridge.py --strategy rolling
```

After deployment, obtain the Web Function base URL for `compute-center-modal-bridge` and create a Modal Proxy Token pair (`wk-...` / `ws-...`). Store only these runtime values in Cloudflare Secrets:

- `MODAL_ENDPOINT_URL`
- `MODAL_PROXY_TOKEN_ID`
- `MODAL_PROXY_TOKEN_SECRET`

Keep `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` as management/deployment credentials; do not send them to the Web Function.

Runtime invariants encoded in `modal_bridge.py`:

- Proxy authentication required before function execution.
- No arbitrary code execution endpoint.
- Outbound network blocked.
- One container maximum.
- Zero warm containers when idle; scale to zero.
- 30 second execution timeout.
- No automatic retries.
- CPU endpoint starts at the minimum 0.125 physical core / 128 MiB memory.
- Bounded request sizes and operation whitelist.
- No paid-fallback behavior is implemented in the bridge.

Cloudflare acceptance must remain fail-closed until `/health` and `/v1/selftest/cpu` pass through the authenticated HTTPS path.
