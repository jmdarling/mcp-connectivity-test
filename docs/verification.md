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

The existing package's independent visibility change needs its owner's signed-in
GitHub UI. The available CLI credential receives HTTP 403 because it lacks package
scope, and the available browser is signed out. No package visibility write was
attempted, and no credentials or broader permissions were created. The workflow
now requires a public package and checks anonymous manifests and pulls after
publishing. Until the owner completes the one-time visibility step in `unraid.md`,
the publish gate intentionally fails rather than claiming anonymous installation.

Last successful private publication before migration:
[Actions run 40406837231](https://github.com/jmdarling/mcp-connectivity-test/actions/runs/40406837231),
commit `034022ee1e6bbfd9e923f3d3201d434146ec4204`, native amd64 and arm64 smoke passed.
Manifest: `sha256:e1c8fd0dbe22ca5822c11da3491e9e9ae39fb1956c1e77be0b15a42a9b962856`.
