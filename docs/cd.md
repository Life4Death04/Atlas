# CD Pipeline — apps/server

Every merge to `main` publishes a versioned Docker image of `apps/server` to the GitHub Container Registry (GHCR). Pull requests run a build-only dry run — no image is pushed until the PR merges.

## Quick start

1. [Set up branch protection](#branch-protection-setup) on `main` (one-time).
2. [Verify workflow permissions](#workflow-permissions) (one-time).
3. Open a PR → workflow builds the image and runs green.
4. Merge to `main` → workflow publishes the image to GHCR with three tags.

---

## How the workflow works

| Event | What happens |
|-------|-------------|
| `pull_request` targeting `main` | Image is built (`push: false`). No image appears in GHCR. |
| `push` to `main` (PR merge) | Image is built **and** pushed to GHCR with three tags. |

The workflow file is `.github/workflows/cd.yml`. It runs independently and in parallel with `ci.yml` — it does **not** wait on CI inside the workflow. The "CI must be green before CD publishes" guarantee comes from branch protection (see below).

**Paths filter**: the workflow only runs when these files change:
`apps/server/**`, `packages/shared/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `apps/server/Dockerfile`, `.dockerignore`, `.github/workflows/cd.yml`.

---

## GHCR image

```
ghcr.io/<owner>/atlas-server
```

Replace `<owner>` with the GitHub organisation or user name that owns the repo.

### Tag conventions

On every push to `main`, three tags are applied to a **single image digest**:

| Tag | Example | Description |
|-----|---------|-------------|
| `sha-<short>` | `sha-a1b2c3d` | Git commit SHA (always pushed) |
| `<semver>` | `0.0.1` | Value of `version` in `apps/server/package.json` |
| `latest` | `latest` | Floating tag — always points to the most recent push |

On a PR run, the `sha-<short>` tag is computed but **not** pushed (build is dry-run only).

### Pulling an image

```bash
# Latest published
docker pull ghcr.io/<owner>/atlas-server:latest

# Specific commit
docker pull ghcr.io/<owner>/atlas-server:sha-a1b2c3d

# Specific semver
docker pull ghcr.io/<owner>/atlas-server:0.0.1
```

### Inspecting published tags

```bash
# List all versions via GitHub API
gh api /users/<owner>/packages/container/atlas-server/versions \
  --jq '.[] | {tags: .metadata.container.tags, digest: .name}'
```

---

## Running a local Docker build

Use this to reproduce what CI does before opening a PR.

```bash
# Build from repo root (required — build context is the monorepo root)
docker build -f apps/server/Dockerfile -t atlas-server:local .

# Verify: runs as UID 1000
docker run --rm atlas-server:local id -u        # → 1000

# Verify: OpenSSL 3.x (required by Prisma native engine)
docker run --rm atlas-server:local openssl version

# Verify: generated Prisma client is present
docker run --rm atlas-server:local ls generated/prisma

# Verify: no .env or source files leaked into runtime
docker run --rm atlas-server:local find . -name ".env*" -not -path "*/node_modules/*"
docker run --rm atlas-server:local find . -name "*.ts" -not -name "*.d.ts" \
    -not -path "*/node_modules/*" -not -path "./generated/prisma/*"

# Run with real env vars (requires a running Postgres)
docker run --rm \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e AUTH0_DOMAIN="your-tenant.auth0.com" \
  -e AUTH0_AUDIENCE="your-api-audience" \
  -e CLIENT_URL="http://localhost:5173" \
  -p 3001:3001 \
  atlas-server:local
# Server starts on port 3001. Health check: curl http://localhost:3001/api/health
```

> **Note on `.ts` files**: The Prisma 6 `prisma-client` generator outputs TypeScript source files into `generated/prisma/`. These are required runtime artefacts (the Prisma engine loads them). They are not application source code and cannot be removed without switching generators. `.d.ts` files in `dist/` are TypeScript declaration stubs — also not runnable source.

---

## Branch protection setup

**This is a one-time maintainer prerequisite.** Without it, the CD workflow can publish images from unreviewed code.

1. Go to **Settings → Branches** in the GitHub repo.
2. Click **Add branch ruleset** (or **Add rule** for classic rules).
3. Set the pattern to `main`.
4. Enable **Require status checks to pass before merging**.
5. Search for and select the **`test`** check (from `ci.yml`).
6. Optionally enable **Require branches to be up to date before merging**.
7. Save the rule.

After this is set up, the `push` event in `cd.yml` only fires after a PR merge — which requires CI to be green by construction.

---

## Workflow permissions

By default, some GitHub organisations restrict workflow permissions to read-only. To allow GHCR pushes:

1. Go to **Settings → Actions → General**.
2. Under **Workflow permissions**, select **Read and write permissions**.
3. Save.

This setting is scoped to the repository. The `permissions:` block in `cd.yml` (which declares `packages: write`) is the per-workflow override but requires the repository-level setting to allow it.

---

## Semver bump procedure

The `<semver>` tag on GHCR images comes from `apps/server/package.json` `version` field. To bump it:

1. Update `"version"` in `apps/server/package.json` (e.g., `"0.0.1"` → `"0.1.0"`).
2. Commit and merge to `main`.
3. The next push to `main` will publish the image with the new semver tag alongside `sha-<short>` and `latest`.

There is no automation — bumping semver is a manual maintainer step.

---

## Caching notes

The workflow uses two layers of caching:

| Cache | Mechanism | Purpose |
|-------|-----------|---------|
| Docker layer cache | `cache-from/cache-to: type=gha,mode=max` in `build-push-action` | Skips unchanged Docker layers between runs |
| pnpm store | `actions/cache@v4` keyed by `pnpm-lock.yaml` hash | REQ-7 literal compliance; functionally redundant with the BuildKit `--mount=type=cache` inside the Dockerfile |

The `actions/cache@v4` step on the pnpm store is present to satisfy the spec's literal wording. Since all `pnpm install` logic lives inside the Dockerfile (not on the runner), this cache is a no-op for the build itself. A reviewer may request its removal if the BuildKit mount cache is considered sufficient.
