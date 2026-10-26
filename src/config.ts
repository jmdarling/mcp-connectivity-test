export interface Config {
  host: string;
  port: number;
  allowedHosts: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const host = env.MCP_HOST ?? "127.0.0.1";
  const rawPort = env.MCP_PORT ?? "3000";
  if (
    !/^[0-9]+$/.test(rawPort) ||
    Number(rawPort) < 1 ||
    Number(rawPort) > 65535
  ) {
    throw new Error("MCP_PORT must be an integer from 1 to 65535");
  }
  if (!host.trim() || host !== host.trim())
    throw new Error("MCP_HOST must be a host address");
  const allowedHosts = (env.MCP_ALLOWED_HOSTS ?? "localhost,127.0.0.1,[::1]")
    .split(",")
    .map((value) => value.trim().toLowerCase());
  if (
    allowedHosts.some(
      (value) => !/^(\[[a-f0-9:]+\]|[a-z0-9][a-z0-9.-]*)$/.test(value),
    )
  ) {
    throw new Error(
      "MCP_ALLOWED_HOSTS must contain exact comma-separated hostnames or IPs, without ports or wildcards",
    );
  }
  return { host, port: Number(rawPort), allowedHosts };
}
