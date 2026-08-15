# Modal compute provider

Status: registered, fail-closed until credentials and live E2E acceptance.

## Free-tier policy

- Current Modal Starter plan subscription: $0/month.
- Current recurring compute credit: $30/month.
- This is treated as a recurring current-plan benefit, not a lifetime contractual guarantee.
- Compute Center policy: free-credit-only; no paid fallback; do not enable routing until live authentication and bounded E2E acceptance pass.

## Credentials

Configure both secrets in the Cloudflare runtime; never commit their values to GitHub:

- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`

## Activation gate

1. Both credentials present.
2. Live authentication probe passes without secret echo.
3. Fixed bounded CPU canary passes.
4. Fixed bounded GPU canary may be tested only within available free credit.
5. Monthly free-credit guard is active.
6. Only then may `route_eligible` be changed from false to true.
