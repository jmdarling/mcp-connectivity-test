# Connectivity is not host integration

There are three distinct checks:

1. **HTTP reachability:** `/health` responds from the intended private client.
2. **MCP protocol:** a native MCP client initializes, lists `hello_status`, and
   calls it successfully at `/mcp`.
3. **Kocho integration:** Kocho's supported MCP integration discovers the tool and
   invokes it in an actual conversation. This requires a working supported host
   connection; the first two checks cannot establish it.

Only the second check plus loopback HTTP reachability can be established by the
source test suite. Container CI adds proof that the same protocol works from the
published Docker build environment. Neither proves Unraid networking or Kocho.

## Native local desktop/Codex route

Official [host MCP settings documentation](https://learn.chatgpt.com/docs/extend/mcp)
supports **ChatGPT desktop Settings → MCP servers → Add server → Streamable HTTP**.
A native local host that can reach Unraid's existing private interface can use
`http://YOUR_PRIVATE_UNRAID_IP:8081/mcp` (with your actual host port). The server must
already bind a reachable private interface, and that exact address must be in
`MCP_ALLOWED_HOSTS`. A same-LAN connection needs no Tailscale or OpenAI tunnel.
Codex shares the local host MCP configuration as documented. This repository does
not alter those persistent settings or the running server.

## Repo-scoped plugin limitation in this cloud Dot route

The engineering guidance supplied for this task says local repo-scoped plugins
containing MCP servers do **not** work in this Dot local-child-task route. This is
separate from supported native desktop/Codex host MCP settings above. Accordingly,
this repository does not install a repo-scoped MCP plugin, alter the user's
persistent agent configuration, or treat a standalone client call as Kocho success.
The server's tool has not been discovered or called by Kocho through its real
integration. That end-to-end proof remains blocked on a supported host route.

Official [plugin packaging documentation](https://developers.openai.com/plugins/build/plugins)
describes local MCP configurations and marketplaces for supported clients. Those
general instructions do not override the current host limitation. If engineering
confirms a supported private MCP route for this exact host, configure it separately,
then verify `tools/list` and a real conversational `hello_status` invocation.
No plugin or global MCP configuration has been installed by this task.

## Hosted/private tunnel route (install artifacts provided)

OpenAI documents [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
as an outbound-only private-server route for supported products. It requires
organization/workspace availability, tunnel permissions, and runtime authentication.
It is distinct from a public tunnel, but it would introduce a new authenticated
connection. This task does not create that connection or its credentials. Its
availability and operation in Jonathan's account and in Kocho are unverified.

The [tunnel-client Unraid template and setup guide](tunnel-client-unraid.md) use
OpenAI's public official image, an existing tunnel ID, and a read-only key file.
This provides installation artifacts, not a live authenticated setup or proof
that the cloud dot has discovered/called the tool. It adds no public listener.

Tailscale provides network reachability only to clients already on the permitted
tailnet; a cloud connector does not automatically join it. An existing native MCP
client on the trusted LAN/tailnet can test the server directly. Do not expose the
server publicly, create a public tunnel, or broaden persistent access to work
around an unsupported host integration.

Acceptance for future integration work: identify the supported route for the exact
host, keep the endpoint private, obtain any separately required access approval,
observe tool discovery, and record a successful harmless call from Kocho itself.
