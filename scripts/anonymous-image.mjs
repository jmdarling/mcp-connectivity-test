import assert from "node:assert/strict";

// Intentionally does not read credentials, Docker configuration, or GH_TOKEN.
const repository = "jmdarling/mcp-connectivity-test";
const reference = process.argv[2] ?? "latest";
assert.match(reference, /^(latest|sha-[a-f0-9]{40}|sha256:[a-f0-9]{64})$/);
const tokenResponse = await fetch(
  `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
  { signal: AbortSignal.timeout(15000) },
);
assert.ok(
  tokenResponse.ok,
  `Anonymous GHCR pull authorization failed (HTTP ${tokenResponse.status}); check package visibility in GitHub Package settings`,
);
const { token } = await tokenResponse.json();
assert.equal(typeof token, "string");
const response = await fetch(
  `https://ghcr.io/v2/${repository}/manifests/${reference}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:
        "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json",
    },
    signal: AbortSignal.timeout(15000),
  },
);
assert.equal(response.status, 200, "Manifest is anonymously readable");
const index = await response.json();
for (const architecture of ["amd64", "arm64"]) {
  assert.ok(
    index.manifests.some(
      (manifest) =>
        manifest.platform?.os === "linux" &&
        manifest.platform?.architecture === architecture,
    ),
    `linux/${architecture} is published`,
  );
}
if (reference.startsWith("sha256:"))
  assert.equal(response.headers.get("docker-content-digest"), reference);
console.log(
  `PASS: anonymous manifest access, linux/amd64 and linux/arm64; digest ${response.headers.get("docker-content-digest")}`,
);
