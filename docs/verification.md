# Verification evidence

Initial implementation: 2026-10-26.

- Reference repository resolved from local Git remote and authenticated GitHub:
  `https://github.com/jmdarling/shin-wallslice`.
- Local reference checkout: `c4f4b223a636da4cceee895692b9d29b6da9b8aa`.
- Remote reference `main` at inspection: `e89608e9410fd8d98b5e3b7cb8889c881d75df8e`.
- Inspected `AGENTS.md`, local skill descriptions, Dockerfile, Verify/Release
  workflows, Container v2 template, and Unraid guidance. The local Verify workflow
  blob matched GitHub (`6e0efaefd75e584940d5c9738df2277f0f237aba`).
- Local `.agents/skills` are spec-writing/spec-implementation and UI workflows for
  the reference application; this separate server task does not invoke them.
- Private new repository creation confirmed by GitHub metadata.
- Seven Node test cases pass, including a real SDK MCP initialize/list/call flow.
- Strict TypeScript compilation passes. Formatting and template checks are part
  of `pnpm check` / `scripts/validate-template.py` and CI.
- Local formatting, XML validation, Compose configuration validation, and
  `pnpm audit --prod` pass (no known production dependency vulnerabilities).
- Local Docker build/run unavailable: the host denied access to
  `/var/run/docker.sock`, including outside the execution sandbox; passwordless
  sudo is unavailable. No daemon settings or group memberships were changed.
- CI is configured to build and run Docker/MCP smoke tests on amd64 and arm64
  before publishing the image. See the repository Actions run for the
  observed result, rather than assuming configuration equals execution.
- Initial CI run `40406249727`: source checks and amd64 Docker/MCP smoke passed;
  arm64 built but exited during health checking under QEMU with the restricted
  128 MiB runtime. Publishing was skipped. Verification now uses native runners
  for each architecture, matching the reference project, and reports exit state.
- Unraid installation/deployment: not run (outside the requested scope).
- Kocho supported-integration tool discovery/call: not run; current host guidance
  blocks repo-scoped MCP plugins. See `integration.md`.

This file records the initial environment. Later CI run results are the source of
truth for pushed revisions; a local Docker permission failure does not imply CI
container verification succeeded or failed.

## Public distribution migration

The owner explicitly requested public source and image distribution on 2026-10-26.
Both tracked history revisions were reviewed before changing repository visibility:
no credential patterns, environment files, keys, or sensitive user data were found.
GitHub confirmed the repository is public. The public source does not authorize a
publicly reachable service; loopback publishing and all runtime restrictions remain.

The package's independent visibility change was completed by its owner in GitHub.
The automated task did not create credentials or broaden permissions. The workflow
requires a public package and checks anonymous manifests and pulls after publishing.

Rerun attempt 2 of `40411355520` passed package visibility and anonymous manifest
checks and completed an anonymous amd64 pull. The arm64 layers downloaded, but the
classic Docker image store refused to overwrite the same index digest already
registered for amd64. The verification loop now checks each image's architecture
and removes only that just-pulled reference before pulling the next architecture.
This fixes the CI image-store conflict without changing deployment restrictions.

Last successful private publication before migration:
[Actions run 40406837231](https://github.com/jmdarling/mcp-connectivity-test/actions/runs/40406837231),
commit `034022ee1e6bbfd9e923f3d3201d434146ec4204`, native amd64 and arm64 smoke passed.
Manifest: `sha256:e1c8fd0dbe22ca5822c11da3491e9e9ae39fb1956c1e77be0b15a42a9b962856`.

## Tunnel client installation artifacts

- Upstream v0.0.18 source inspected at
  `274a5588414819f063d27100a4fb1096aae3830f`, including onboarding, Docker
  deployment, Dockerfiles, release workflow, and shared CLI configuration.
- Official full binary ZIP SHA256 verified:
  `3c82307316acd93c88a384b62af1d81d3f4cb0efa975f9c0bfaef922866a04c4`.
  Its actual version, quickstart, and run help confirmed the template flags.
- Anonymous official full-image manifest `v0.0.18` resolved to
  `sha256:486321616c197fed2d3fbe7d44f22433ce9a1e6c1ee434c0d6652868a5fda5c1`,
  listing Linux amd64 and arm64. The minimal runtime image's anonymous token
  request returned 401, so the public full image was selected. No custom image
  or new package was needed.
- Four Python safety tests cover the tunnel template, including unsafe network,
  privileges, unpinned image, key arguments/environment, ports, and writable secret
  regressions. Existing seven MCP source tests and both XML validators pass locally.
- Native CI pulls and exercises the official image using a dummy file credential
  in a network-isolated fixture; it cannot test live authenticated polling.
- No real key, tunnel, host credential file, Unraid deployment, network settings,
  or host MCP configuration was created or changed.
- Native desktop host MCP settings support LAN Streamable HTTP independently of
  the repo-scoped-plugin limitation in this cloud Dot route; `integration.md`
  now distinguishes these paths.

The final repository Actions run records observed container smoke results. Live
readiness and a real ChatGPT tool call require the user's later authorized setup.
