# Deployment

Self-hosted Docker. The app runs as a standalone Node server in a container (it needs a runtime for ISR, locale routing, and dynamic deep-links — it is **not** a static site).

## Pipeline overview

CI (`.github/workflows/ci.yml`) is **image-only** — it builds and publishes a Docker image but does **not** deploy. You pull and restart the stack on the server yourself.

```
push / PR → main:   lint · typecheck · test · build   (job: ci)
                    Playwright e2e                    (job: e2e)
push → main only:   build & push image to GHCR        (job: image)
```

The `image` job pushes `ghcr.io/<owner>/<repo>:latest` and `:sha-<commit>` and runs only after `ci` + `e2e` pass.

## What you must configure

- **Repository variable** `NEXT_PUBLIC_SITE_URL` — the production origin (e.g. `https://zmanim.example`). It is inlined at **build time** for SEO (`metadataBase`, sitemap, robots, canonical/OG URLs). It is public by design and is **not** a secret.
- **No deploy secrets** and **no runtime secrets.** The app has no server-side tokens (geocoding is keyless, timezone is offline). There is nothing sensitive to inject.

## docker-compose.yml

`docker-compose.yml` defaults to the published image and sane values, so on the server `docker compose up -d` works with no `.env`:

```yaml
image: ${ZMANIM_IMAGE:-ghcr.io/benyaming/zmanim_site:latest}
ports: ["0.0.0.0:${ZMANIM_PORT:-3000}:3000"]
```

A `.env` on the server is **optional** — only to override a default:

```env
ZMANIM_PORT=8080
# pin a build for rollback instead of :latest
ZMANIM_IMAGE=ghcr.io/benyaming/zmanim_site:sha-1a2b3c4
```

`NEXT_PUBLIC_SITE_URL` is **not** needed on the server — it's already baked into the pulled image. (It only appears under `build.args`, used for local `docker compose up --build`.)

## Server setup (one-time)

1. Install Docker + the compose plugin.
2. Create a deploy directory and put `docker-compose.yml` in it.
3. Allow the server to pull the GHCR image (it's private by default), one of:
   - `docker login ghcr.io -u <user> -p <GitHub PAT with read:packages>`, or
   - make the GHCR package public (Package → settings → change visibility).
4. Put a reverse proxy (nginx/Caddy) with TLS in front of the bound port — see [`deploy/nginx.conf`](../deploy/nginx.conf). The app owns `/zmanim/*`, so remove any old `location /zmanim { proxy_pass … }` rule.

## Deploying a new version

After a merge to `main` finishes the `image` job:

```bash
cd <deploy-dir>
docker compose pull
docker compose up -d
docker image prune -f   # optional
```

The compose stack has a healthcheck; `docker compose ps` shows health.

## Docker build notes

`Dockerfile` is multi-stage: deps → build → a minimal non-root runtime that copies Next's `standalone` output. It installs with `npm ci || npm install` — the fallback exists because Alpine/musl native deps aren't always in a lockfile generated elsewhere.

## Lockfile must stay cross-platform

CI uses strict **`npm ci`**, which fails if `package-lock.json` is missing any platform's optional deps. A lockfile generated on macOS can omit Linux/WASM deps (`@emnapi/*`, `@swc/helpers`, native `*-linux-*` binaries) and break CI with `EUSAGE`. After changing dependencies, regenerate the lockfile on Linux:

```bash
docker run --rm -v "$PWD":/w -w /w node:22-slim \
  npm install --package-lock-only --no-audit --no-fund
```

To verify before pushing, `npm ci` in a clean Linux container:

```bash
mkdir -p /tmp/lc && cp package.json package-lock.json /tmp/lc/ && \
docker run --rm -v /tmp/lc:/w -w /w node:22-slim \
  sh -c 'npm ci --ignore-scripts --no-audit --no-fund && echo OK'
```
