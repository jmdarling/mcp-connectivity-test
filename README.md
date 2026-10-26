# MCP connectivity test

A tiny private-network MCP server with exactly one tool: `hello_status`.
It returns a fixed greeting, `status: ok`, service name, and version. It reads no
email, user files, secrets, host statistics, or external services and performs no
privileged actions. It has no persistent storage or authentication. Restrict it to
trusted LAN/Tailscale clients using the existing network controls.

| Endpoint      | Purpose                                       |
| ------------- | --------------------------------------------- |
| `POST /mcp`   | Stateless Streamable HTTP MCP, JSON responses |
| `GET /health` | `{ "status": "ok" }` for health checks        |

An MCP client must send `Accept: application/json, text/event-stream`.
There is no legacy SSE endpoint, browser UI, or browser CORS support.

## Develop and test

Use Node.js 24 and pnpm 11.25.0 (pinned in `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm check
python3 scripts/validate-template.py
pnpm start
```

In another terminal:

```sh
pnpm smoke http://127.0.0.1:3000/mcp
```

`pnpm check` runs formatting, strict TypeScript checking, builds, and Node test
runner tests. The smoke script uses the official MCP SDK client to initialize,
list the sole tool, call it, and check unknown-tool and invalid-input responses.
Source tests also exercise host/origin protection, configuration validation,
malformed JSON, size limits, and unsupported methods.

## Configuration

| Variable            | Default                                      | Meaning                                                |
| ------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `MCP_HOST`          | `127.0.0.1` locally; `0.0.0.0` inside Docker | Process listen address                                 |
| `MCP_PORT`          | `3000`                                       | Process listen port                                    |
| `MCP_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]`                  | Exact comma-separated HTTP hostnames/IPs without ports |

Add the chosen LAN/Tailscale address to the allowlist when using it remotely.
Keep `127.0.0.1` for the Docker health check. Wildcards are rejected. Requests
containing an `Origin` header are rejected; this server is for native MCP clients.
Host allowlisting mitigates DNS rebinding; it does not restrict a client's source
address and is not authentication. Do not expose it to untrusted clients.

## Docker

```sh
docker build -t mcp-connectivity-test:local .
pnpm docker:smoke mcp-connectivity-test:local
docker compose up -d --build
pnpm smoke http://127.0.0.1:8081/mcp
docker compose down
```

Compose publishes only `127.0.0.1:8081` by default. Container `0.0.0.0` is inside
the container network namespace. To publish on an existing private interface,
set `MCP_BIND_IP` to that specific LAN/Tailscale IP and add the same address (and
any client-used DNS name) to `MCP_ALLOWED_HOSTS`. Do not use `0.0.0.0`, host
networking, router port forwarding, Tailscale Funnel, or public tunnels.

The container runs as UID/GID 1000 with a read-only root filesystem, dropped
capabilities, no-new-privileges, a 128 MiB memory limit, and no host mounts. The
smoke script starts an isolated loopback container, checks Docker health,
non-root execution, MCP behavior, and graceful shutdown, then removes it.
`pnpm docker:smoke IMAGE linux/arm64` can test an ARM64 build when QEMU is installed.

## Public image publishing

The GitHub workflow verifies source and builds/tests Linux amd64 and arm64
containers on native runners before publishing to public GHCR:

```text
ghcr.io/jmdarling/mcp-connectivity-test:latest
ghcr.io/jmdarling/mcp-connectivity-test:sha-<full-git-sha>
```

Use the SHA tag or manifest digest to pin a deployment. `latest` advances on
verified pushes to `main` or manual workflow dispatch on `main`. Pull requests
only verify. There is no automatic Unraid deployment. Actions are pinned to
commit SHAs. Publishing uses the workflow's short-lived `GITHUB_TOKEN`; no new
personal token or repository secret is needed. The workflow requires this public
repository and a public GHCR package, then verifies anonymous manifest access and
pulls both architectures with an empty Docker credential configuration. Source and
container checks still run when package visibility needs an owner action.

The repository is public. The existing image package was initially private;
GitHub does not change its visibility when repository visibility changes. If the
publish job reports that the package is private, the owner must open the
[package](https://github.com/jmdarling/mcp-connectivity-test/pkgs/container/mcp-connectivity-test),
choose **Package settings → Change visibility → Public**, then rerun the workflow.
This uses the existing signed-in GitHub account; no new token is needed. After
that one-time change, public GHCR pulls require no login. The workflow does not
create credentials or alter package visibility automatically.

See [Unraid setup](docs/unraid.md) for anonymous template and image installation
and [integration limits](docs/integration.md) before expecting Kocho to call it.

## Pattern reference

This follows [shin-wallslice](https://github.com/jmdarling/shin-wallslice)'s Node
24, pinned pnpm, multi-stage Docker build, non-root runtime, health check,
multi-platform GHCR workflow, and Unraid Container v2 XML conventions. This server
needs no UI, AI configuration, appdata, entrypoint privilege transition, or storage.
The existing project was inspected without modification. Public source and image
distribution do not expose a running MCP service: deployment stays private.

See [verification evidence](docs/verification.md) for the observed results.
