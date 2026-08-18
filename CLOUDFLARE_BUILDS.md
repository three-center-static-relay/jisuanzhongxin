# Cloudflare Workers Builds contract

Configure `compute-worker` under **Settings > Build** with the following repository contract:

| Setting | Required value |
|---|---|
| Root directory | empty (repository root) |
| Build watch include | `*` |
| Production branch | `main` |
| Build command | empty |
| Production deploy command | `npm run cf:build && npx wrangler deploy` |
| Non-production deploy command | `npm run cf:build && npx wrangler deploy --dry-run` |
| Non-production branches | include `*`, exclude `main` |

Cloudflare Workers Builds currently ignores Wrangler custom-build configuration. The deploy commands therefore invoke the fail-closed repository gate explicitly. Wrangler is pinned exactly in `package.json`.

This Worker declares a top-level Durable Object `exports` lifecycle. Cloudflare rejects `wrangler versions upload` for that model, so non-main builds must use `wrangler deploy --dry-run`: no version is uploaded and no traffic changes. A runtime staging environment must have a separately provisioned Worker name, Durable Object namespace, secrets, bindings, and route before `--env staging` is enabled. Never reuse production Durable Object state from staging.

Acceptance requires a non-main commit to run the gate, complete the dry run, and report a successful Cloudflare check. No preview URL is expected. Build success proves packaging/configuration validity, not runtime business E2E behavior.

References: [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/), and [build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).
