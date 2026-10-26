import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { smoke } from "./mcp-smoke.mjs";

const image = process.argv[2] ?? "mcp-connectivity-test:verify";
const platform = process.argv[3];
const name = `mcp-connectivity-smoke-${process.pid}`;
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 90000 }).trim();
let created = false;
try {
  docker(
    "run",
    "-d",
    "--name",
    name,
    ...(platform ? ["--platform", platform] : []),
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true",
    "--memory=128m",
    "--pids-limit=64",
    "-p",
    "127.0.0.1::3000",
    image,
  );
  created = true;
  const inspected = JSON.parse(docker("inspect", name))[0];
  assert.equal(inspected.Config.User, "node");
  assert.equal(inspected.HostConfig.Privileged, false);
  const uid = docker("exec", name, "id", "-u");
  assert.notEqual(uid, "0");
  const port = inspected.NetworkSettings.Ports["3000/tcp"][0];
  assert.equal(port.HostIp, "127.0.0.1");
  const endpoint = `http://127.0.0.1:${port.HostPort}/mcp`;
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = JSON.parse(docker("inspect", name))[0].State;
    if (!state.Running)
      throw new Error("Container exited before becoming healthy");
    if (state.Health.Status === "healthy") {
      healthy = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(healthy, "Docker healthcheck became healthy");
  await smoke(endpoint);
  docker("stop", "-t", "10", name);
  const stopped = JSON.parse(docker("inspect", name))[0];
  assert.equal(stopped.State.ExitCode, 0);
  console.log(
    `PASS: ${platform ?? "native"} container health, non-root user, restricted runtime, MCP tool call, graceful shutdown`,
  );
} finally {
  if (created) {
    try {
      console.log(docker("logs", name));
    } finally {
      docker("rm", "-f", name);
    }
  }
}
