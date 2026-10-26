import express, { type ErrorRequestHandler } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { Config } from "./config.js";

export const VERSION = "0.1.0";
export const STATUS = {
  message: "Hello from MCP connectivity test!",
  status: "ok",
  service: "mcp-connectivity-test",
  version: VERSION,
} as const;

function createServer(): McpServer {
  const server = new McpServer({ name: STATUS.service, version: VERSION });
  server.registerTool(
    "hello_status",
    {
      title: "Hello / status",
      description:
        "Return a fixed harmless greeting and service status to verify MCP tool connectivity. Reads no user or host data.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({
        message: z.string(),
        status: z.literal("ok"),
        service: z.string(),
        version: z.string(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(STATUS) }],
      structuredContent: { ...STATUS },
    }),
  );
  return server;
}

export function createApp(config: Config) {
  const app = express();
  app.disable("x-powered-by");
  // Host allowlisting mitigates DNS rebinding; it is not network authentication.
  app.use((req, res, next) => {
    let hostname: string;
    try {
      const host = req.headers.host;
      if (!host || /[@/\\\s,#?]/.test(host)) throw new Error("invalid host");
      hostname = new URL(`http://${host}`).hostname.toLowerCase();
    } catch {
      res.status(403).json({ error: "Host not allowed" });
      return;
    }
    if (!config.allowedHosts.includes(hostname)) {
      res.status(403).json({ error: "Host not allowed" });
      return;
    }
    // No browser client is needed. Reject all Origin-bearing requests, including null.
    if (req.headers.origin !== undefined) {
      res.status(403).json({ error: "Browser origins are not supported" });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: STATUS.status });
  });
  app.post("/mcp", async (req, res, next) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      next(error);
    }
  });
  app.all("/mcp", (_req, res) => {
    res
      .set("Allow", "POST")
      .status(405)
      .json({ error: "Use stateless Streamable HTTP POST" });
  });
  const handleError: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (res.headersSent) return;
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;
    res.status(status >= 400 && status < 500 ? status : 500).json({
      error:
        status === 413
          ? "Request too large"
          : status === 400
            ? "Invalid JSON"
            : "Request failed",
    });
  };
  app.use(handleError);
  return app;
}
