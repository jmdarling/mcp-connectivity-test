import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { once } from "node:events";
import { request } from "node:http";
import { createApp } from "../dist/server.js";
import { loadConfig } from "../dist/config.js";
import { smoke } from "../scripts/mcp-smoke.mjs";

let http;
let base;
before(async () => {
  http = createApp(loadConfig({})).listen(0, "127.0.0.1");
  await once(http, "listening");
  base = `http://127.0.0.1:${http.address().port}`;
});
after(async () => {
  http.closeAllConnections();
  await new Promise((resolve) => http.close(resolve));
});

test("real MCP SDK client discovers and calls the only tool", async () => {
  await smoke(`${base}/mcp`);
});
test("reject DNS rebinding host", async () => {
  const status = await new Promise((resolve, reject) => {
    const req = request(
      `${base}/health`,
      { headers: { host: "evil.example" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 403);
});
test("reject browser origins, including null", async () => {
  for (const origin of ["https://evil.example", "null", base]) {
    assert.equal(
      (await fetch(`${base}/health`, { headers: { origin } })).status,
      403,
    );
  }
});
test("stateless endpoint refuses unsupported methods", async () => {
  for (const method of ["GET", "DELETE", "PUT"]) {
    const response = await fetch(`${base}/mcp`, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  }
});
test("malformed JSON and oversized bodies fail cleanly", async () => {
  for (const [body, expected] of [
    ["{", 400],
    [JSON.stringify({ large: "x".repeat(17000) }), 413],
  ]) {
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes("node_modules"));
  }
});
test("invalid MCP requests receive protocol errors", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ nonsense: true }),
  });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error);
});
test("configuration defaults to loopback and rejects dangerous allowlists or ports", () => {
  assert.equal(loadConfig({}).host, "127.0.0.1");
  for (const value of ["0", "65536", "1.5", "", "abc"])
    assert.throws(() => loadConfig({ MCP_PORT: value }));
  for (const value of ["*", "", "foo:3000", "http://foo", "foo,"])
    assert.throws(() => loadConfig({ MCP_ALLOWED_HOSTS: value }));
  assert.deepEqual(
    loadConfig({
      MCP_ALLOWED_HOSTS: "localhost,192.168.1.4,nas.example.ts.net",
    }).allowedHosts,
    ["localhost", "192.168.1.4", "nas.example.ts.net"],
  );
});
