import { createApp } from "./server.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const http = createApp(config).listen(config.port, config.host, () => {
  console.error(
    `MCP connectivity test listening on ${config.host}:${config.port}; endpoint /mcp`,
  );
});
http.on("error", () => {
  console.error("Unable to start MCP server; check bind address and port");
  process.exitCode = 1;
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    http.close(() => {
      process.exitCode = 0;
    });
    setTimeout(() => {
      http.closeAllConnections();
    }, 5000).unref();
  });
}
