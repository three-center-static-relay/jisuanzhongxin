# Copernicus openEO Service Account E2E — 2026-08-17

## Verdict

**PASS — real production batch E2E verified.**

This receipt records a real production execution through the configured CDSE service account after Copernicus Data Space Ecosystem Support linked the service account to the personal account.

## Authentication / adapter fixes verified

- openEO API base: `https://openeo.dataspace.copernicus.eu/openeo/1.2`
- OIDC provider id: `CDSE`
- client-credentials scope: `email openid`
- openEO authorization form: `Bearer oidc/CDSE/<access-token>`
- secrets are not echoed in health or E2E responses

## Production health

Final production health response after cleanup:

- HTTP: `200`
- `ok=true`
- `configured=true`
- `authenticated=true`
- `account_visible=true`
- `api_version=1.2.0`
- `secret_echo=false`

## Real batch job

- Job ID: `j-2608171256074d978ed8931bd3cffa16`
- Test collection: `COPERNICUS_30`
- Test extent: intentionally tiny bounded extent
- Create job: HTTP `201`
- Start results: HTTP `202`
- Budget cap: `10` credits
- Final status: `finished`
- Final progress: `100`
- Actual cost: `9` credits
- Input pixels: `0.0000457763671875` mega-pixel
- Reported duration: `60` seconds
- Reported max executor memory: `0.3188591003417969` GB

The task moved through the real CDSE batch queue and completed successfully. This is not a token-only or catalog-only probe.

## Cleanup verification

The temporary protected E2E trigger was removed immediately after the successful run.

- temporary E2E route after cleanup: HTTP `404`
- production openEO health after cleanup: HTTP `200`
- final cleanup deployment version: `07820c68-f44d-4b75-9ab1-b32f984718c4`

No E2E secret or service-account client secret is stored in this receipt.
