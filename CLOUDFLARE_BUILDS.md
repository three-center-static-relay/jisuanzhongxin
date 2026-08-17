# Cloudflare Workers Builds contract

Configure `compute-worker` under **Settings > Build** with the following repository contract:

| Setting | Required value |
|---|---|
| Root directory | empty (repository root) |
| Build watch include | `*` |
| Production branch | `main` |
| Build command | empty |
| Production deploy command | `npm run cf:build && wrangler deploy` |
| Non-production deploy command | `npm run cf:build && wrangler versions upload` |
| Non-production branches | include `*`, exclude `main` |

Cloudflare Workers Builds currently ignores Wrangler custom-build configuration. The deploy commands therefore invoke the fail-closed repository gate explicitly. Wrangler comes from `package.json`; the build does not fetch a floating CLI version.

Acceptance requires a non-main commit to run the gate, upload a version without changing production traffic, and report a successful Cloudflare check. Because this Worker uses Durable Objects, no preview URL is expected. Build success is not a runtime business E2E result.

References: [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/), and [build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).
