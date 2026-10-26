# OpenAI Secure MCP Tunnel client on Unraid

Use this second container alongside your existing MCP test server. The template
uses OpenAI's public `ghcr.io/openai/tunnel-client:v0.0.18` image pinned to
`sha256:486321616c197fed2d3fbe7d44f22433ce9a1e6c1ee434c0d6652868a5fda5c1`.
It supports Linux amd64 and arm64 and needs no registry login or custom image.
The existing MCP server image and configuration are unchanged.

It makes outbound HTTPS connections to OpenAI and publishes **no ports**.
The optional Cloudflare mode in the official image is not enabled. Admin/health
stays on loopback inside the shared container network namespace.

These are install artifacts only. No tunnel, real key, permissions, deployment,
or ChatGPT connection is created by this project.

## Existing values you need

- The MCP container's exact name, normally `mcp-connectivity-test`.
- Your complete existing tunnel ID from
  [Platform Tunnels](https://platform.openai.com/settings/organization/tunnels).
- An existing runtime API key authorized for that tunnel. Its principal needs
  Tunnels **Read + Use**. Do not use an admin key or paste a key into chat.
- The tunnel associated with the intended ChatGPT workspace, and permission in
  that workspace to add custom MCP servers.

If these resources do not exist, complete separate authorized Platform setup
first. This guide does not generate them or grant access.

## Prepare the local secret file

Run this yourself in Unraid's web terminal. It prompts without echoing the key or
putting its value in shell history. Do not substitute a literal key into a command.

```bash
install -d -m 0700 /mnt/user/appdata/openai-tunnel-client
umask 077
IFS= read -r -s -p 'Existing runtime API key: ' tunnel_runtime_key
printf '\n'
printf '%s' "$tunnel_runtime_key" > /mnt/user/appdata/openai-tunnel-client/runtime-api-key
unset tunnel_runtime_key
chown 65532:65532 /mnt/user/appdata/openai-tunnel-client/runtime-api-key
chmod 0400 /mnt/user/appdata/openai-tunnel-client/runtime-api-key
```

The client runs as 65532:65532. The template mounts **only this file**, read-only,
at `/run/secrets/openai-runtime-key`. The verified CLI flag is
`--control-plane.api-key=file:/run/secrets/openai-runtime-key`. Docker inspect,
saved XML, and process arguments contain the file path, not the key value.
Keep the directory and backups private. Do not put the key into an environment
field, screenshot, log, or repository.

The source must already be a nonempty regular file. A missing source may become
a directory when Docker/Unraid creates a bind mount and will fail startup. To
rotate later, stop the client, replace the file locally with the same owner/mode,
and reapply/recreate the client so the mount sees the current file. No rotation or
real secret-file creation is performed by the automated task.

## Import the template

In Unraid's web terminal:

```sh
mkdir -p /boot/config/plugins/dockerMan/templates-user
curl --fail --location https://raw.githubusercontent.com/jmdarling/mcp-connectivity-test/main/templates/openai-tunnel-client.xml --output /boot/config/plugins/dockerMan/templates-user/my-openai-tunnel-client.xml
```

Choose **Docker → Add Container → openai-tunnel-client**:

1. Fill in **Tunnel ID** with the complete existing ID. This is not an API key.
2. Keep **Private MCP URL** as `http://127.0.0.1:3000/mcp` for the standard server.
   This uses container port 3000, not published Unraid port 8081.
3. Keep **Runtime API-key file** pointed at the prepared host file, read-only.
4. Keep **Network** as `container:mcp-connectivity-test`. If your MCP container
   is named differently, in Advanced View choose Container networking and its
   exact name, or change the downloaded XML's `<Network>` to
   `container:YOUR_MCP_CONTAINER_NAME` before importing. Keep Privileged off.
5. Start the MCP container first, then Apply/start the tunnel client.

Only their networking is shared. Files, processes, and the Docker socket are not
shared. The client reaches the existing server over loopback without changing
host publishing or creating another network. `127.0.0.1` is already in the test
server's default `MCP_ALLOWED_HOSTS`. Do not add browser Origin headers, wildcard
allowed hosts, or CORS overrides. Existing LAN/Tailscale settings need no change.

The client inherits the MCP container's existing outbound reachability. The
standard OpenAI transport needs outbound HTTPS to `api.openai.com:443`. No inbound
firewall rule, router forwarding, public proxy, Tailscale Funnel, or host-network
mode is needed or configured. The template does not configure enterprise proxies
or control-plane mTLS; those need separate approved setup if your network requires them.

Keep the non-root user, read-only root filesystem, dropped capabilities,
no-new-privileges, 256 MiB memory limit, and PID limit. There are no published
ports, WebUI host link, broad host mounts, or socket mounts. Admin/health listens
on `127.0.0.1:8080` inside the shared namespace. Do not publish that port.

Start the MCP container before the tunnel at boot. If the MCP container is
recreated, reapply/recreate the tunnel client afterward to join its new network
namespace. Stopping just the tunnel does not stop the MCP server.

## Readiness and ChatGPT connection

Use normal Unraid container logs; keep unsafe raw HTTP logging disabled. Check
health through the MCP container's Node runtime:

```sh
docker exec mcp-connectivity-test node --input-type=module -e "for (const p of ['healthz','readyz']) { const r = await fetch('http://127.0.0.1:8080/' + p); console.log(p, r.status); }"
```

`/healthz` means the process is serving. It does not prove authentication or active
polling. Wait for `/readyz` HTTP 200 and normal logs confirming polling. For 503,
check file readability, runtime key permissions, complete tunnel ID, outbound
connectivity, and the tunnel's existing workspace associations. Correct only the
dedicated secret file if startup reports a directory or unreadable file; do not
change permissions recursively.

For the hosted connection, in a supported ChatGPT workspace choose **Plugins →
plus → Add custom MCP server → Connection: Tunnel**, select the same tunnel, and
follow that workspace's authentication and risk-review flow. Keep the client
running for discovery and calls. Ask ChatGPT to call `hello_status`; that real
conversation call is the final integration check. Account availability and this
exact Dot/Kocho route remain unverified by these install-artifact tests.

A native local ChatGPT desktop/Codex session can instead use a directly reachable
LAN Streamable HTTP URL through host MCP settings. That is a different route;
it does not require this tunnel when the native host already reaches the server.
See [integration routes](integration.md).

## Verification and upgrades

The official v0.0.18 release binary's version, quickstart, and actual `run --help`
were checked. Its download checksum is recorded in `tunnel/official-image.json`.
The official image manifest was anonymously readable and listed both architectures.
The minimal `tunnel-client-runtime` image was not anonymously available, so this
template uses the verified public full image with restricted runtime options.

CI anonymously pulls that pinned image on both native architectures, checks its
actual help/version, tests missing-file and invalid-ID startup rejection, then
starts it as non-root alongside the test MCP server using the template flags.
The paired smoke has no external networking and uses a clearly fake fixture,
not a real API key. It checks file-backed configuration, shared-loopback MCP
reachability, local health, no published ports, and readiness staying 503 while
offline. It does not test a real tunnel or authenticated ChatGPT call.

Review [official releases](https://github.com/openai/tunnel-client/releases/latest)
for upgrades. Update the template pin, metadata, checked CLI, and smoke evidence
together. Nothing updates or installs itself on Unraid from this repository.

Sources: [OpenAI tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels),
[official onboarding](https://github.com/openai/tunnel-client/blob/v0.0.18/docs/onboarding.md),
[official Docker deployment](https://github.com/openai/tunnel-client/blob/v0.0.18/docs/deployment/docker.md),
and [Unraid template handling](https://github.com/unraid/webgui/blob/master/emhttp/plugins/dynamix.docker.manager/include/Helpers.php).
