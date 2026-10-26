import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const config = JSON.parse(
  execFileSync("python3", ["scripts/validate-tunnel-template.py", "--json"], {
    encoding: "utf8",
  }),
);
const platform = process.argv[3] ?? "linux/amd64";
const mcpImage = process.argv[2] ?? "mcp-connectivity-test:verify";
const folder = mkdtempSync(join(tmpdir(), "openai-tunnel-smoke-"));
const anonymousConfig = join(folder, "docker");
const secret = join(folder, "dummy-key");
const dummy = "offline-fixture-not-an-openai-credential";
writeFileSync(secret, dummy);
chmodSync(secret, 0o444);
const mcp = `tunnel-mcp-smoke-${process.pid}`;
const tunnel = `tunnel-client-smoke-${process.pid}`;
const created = [];
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 180000 }).trim();
const base = ["--network=none", ...config.extra];
try {
  // New empty CLI config makes this a real anonymous official-image pull.
  docker(
    "--config",
    anonymousConfig,
    "pull",
    "--platform",
    platform,
    config.image,
  );
  const version = docker(
    "run",
    "--rm",
    ...base,
    "--entrypoint",
    config.binary,
    config.image,
    "--version",
  );
  assert.ok(version.includes("0.0.18"));
  const help = docker(
    "run",
    "--rm",
    ...base,
    "--entrypoint",
    config.binary,
    config.image,
    "run",
    "--help",
  );
  for (const flag of [
    "--control-plane.api-key",
    "file:/path",
    "--control-plane.tunnel-id",
    "--mcp.server-url",
    "--health.listen-addr",
    "--allow-remote-ui",
  ])
    assert.ok(help.includes(flag), `official help contains ${flag}`);

  for (const invalid of ["missing-key", "invalid-id"]) {
    const args = [
      ...config.args,
      "--control-plane.base-url=http://127.0.0.1:1",
    ];
    if (invalid === "missing-key")
      args[0] = "--control-plane.api-key=file:/run/secrets/absent";
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        ...base,
        "--mount",
        `type=bind,src=${secret},dst=${config.secretTarget},readonly`,
        "-e",
        `CONTROL_PLANE_TUNNEL_ID=${invalid === "invalid-id" ? "invalid" : "tunnel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`,
        "-e",
        "MCP_SERVER_URL=http://127.0.0.1:3000/mcp",
        config.image,
        ...args,
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.ok(
      result.status !== null && result.status !== 0,
      `${invalid} fails at startup`,
    );
    assert.ok(
      !`${result.stdout}${result.stderr}`.includes(dummy),
      "errors do not echo the file credential",
    );
  }

  // The entire paired smoke environment has no external network. No real key or tunnel is used.
  docker(
    "run",
    "-d",
    "--name",
    mcp,
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true",
    mcpImage,
  );
  created.push(mcp);
  docker(
    "run",
    "-d",
    "--name",
    tunnel,
    `--network=container:${mcp}`,
    ...config.extra,
    "--mount",
    `type=bind,src=${secret},dst=${config.secretTarget},readonly`,
    "-e",
    "CONTROL_PLANE_TUNNEL_ID=tunnel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "-e",
    `MCP_SERVER_URL=${config.environment.MCP_SERVER_URL}`,
    config.image,
    ...config.args,
    "--control-plane.base-url=http://127.0.0.1:1",
  );
  created.push(tunnel);
  const inspect = JSON.parse(docker("inspect", tunnel))[0];
  assert.equal(inspect.Config.User, "65532:65532");
  assert.equal(inspect.HostConfig.Privileged, false);
  assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
  assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
  assert.ok(inspect.HostConfig.NetworkMode.startsWith("container:"));
  assert.equal(inspect.Mounts.length, 1);
  assert.equal(inspect.Mounts[0].RW, false);
  assert.ok(
    !inspect.Config.Env.some(
      (value) =>
        value.startsWith("CONTROL_PLANE_API_KEY=") ||
        value.startsWith("OPENAI_API_KEY="),
    ),
  );
  assert.equal(docker("exec", tunnel, "id", "-u"), "65532");
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const probe = spawnSync(
      "docker",
      [
        "exec",
        mcp,
        "node",
        "--input-type=module",
        "-e",
        "const r=await fetch('http://127.0.0.1:8080/healthz');if(r.status!==200)process.exit(1)",
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    if (probe.status === 0) {
      healthy = true;
      break;
    }
    assert.equal(
      JSON.parse(docker("inspect", tunnel))[0].State.Running,
      true,
      "tunnel remains running",
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(
    healthy,
    "official client starts using the template file-key and loopback flags",
  );
  assert.equal(
    docker("exec", tunnel, "wget", "-qO-", "http://127.0.0.1:3000/health"),
    '{"status":"ok"}',
  );
  assert.equal(
    docker(
      "exec",
      mcp,
      "node",
      "--input-type=module",
      "-e",
      "const r=await fetch('http://127.0.0.1:8080/readyz');console.log(r.status)",
    ),
    "503",
    "offline smoke is not falsely reported connected",
  );
  const listeners = docker("exec", tunnel, "cat", "/proc/net/tcp");
  assert.ok(
    listeners.includes("0100007F:1F90"),
    "health/admin binds 127.0.0.1:8080",
  );
  assert.ok(!listeners.includes("00000000:1F90"), "no wildcard admin listener");
  assert.ok(
    !docker("logs", tunnel).includes(dummy),
    "logs do not echo the file credential",
  );
  console.log(
    `PASS: official ${platform} anonymous pull/version/help, file-key validation, non-root restricted runtime, no ports, shared-loopback MCP reachability and admin listener; live tunnel not tested`,
  );
} finally {
  for (const name of created.reverse()) docker("rm", "-f", name);
  rmSync(folder, { recursive: true, force: true });
}
