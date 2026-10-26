import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function smoke(endpoint) {
  const url = new URL(endpoint);
  const health = await fetch(new URL("/health", url), {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  const client = new Client({ name: "connectivity-smoke", version: "0.1.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(url), {
      timeout: 5000,
    });
    assert.equal(client.getServerVersion()?.name, "mcp-connectivity-test");
    const { tools } = await client.listTools({}, { timeout: 5000 });
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["hello_status"],
    );
    assert.equal(tools[0].annotations.readOnlyHint, true);
    const result = await client.callTool(
      { name: "hello_status", arguments: {} },
      undefined,
      { timeout: 5000 },
    );
    assert.ok(!result.isError);
    assert.deepEqual(result.structuredContent, {
      message: "Hello from MCP connectivity test!",
      status: "ok",
      service: "mcp-connectivity-test",
      version: "0.1.0",
    });
    assert.deepEqual(
      JSON.parse(result.content[0].text),
      result.structuredContent,
    );
    const unknown = await client.callTool(
      { name: "not_a_tool", arguments: {} },
      undefined,
      { timeout: 5000 },
    );
    assert.equal(unknown.isError, true);
    const invalid = await client.callTool(
      { name: "hello_status", arguments: { unexpected: "ignored?" } },
      undefined,
      { timeout: 5000 },
    );
    assert.equal(invalid.isError, true);
    console.log(
      "PASS: health, MCP initialize, tools/list, hello_status, unknown tool, invalid input",
    );
  } finally {
    await client.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await smoke(process.argv[2] ?? "http://127.0.0.1:3000/mcp");
}
