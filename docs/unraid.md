# Unraid setup (instructions only)

No Unraid installation, configuration change, or deployment is performed by this
repository's workflow. The repository and GHCR package stay private.

## Obtain the template and image

1. Download `templates/mcp-connectivity-test.xml` from this private repository
   using your existing GitHub access. A private raw GitHub URL is not a public
   Community Apps template source. Do not embed a token in a template URL.
2. When ready to deploy, copy the XML to Unraid's
   `/boot/config/plugins/dockerMan/templates-user/my-mcp-connectivity-test.xml`.
   Then use Docker → Add Container and choose the template.
3. Keep the `bridge` network and `Privileged: false`. There are no appdata or
   filesystem mappings and no Docker socket mount. Runtime identity is UID/GID 1000.
4. Pulling `ghcr.io/jmdarling/mcp-connectivity-test:latest` requires an existing
   registry login authorized to read this **private** package. GitHub's supported
   CLI authentication for private GHCR pulls uses a personal access token (classic)
   with `read:packages`, plus access to the package. If you already have an
   appropriate credential, supply it through Docker's normal `--password-stdin`
   login mechanism on the Unraid host. Registry credentials are stored on that host;
   follow your own credential handling policy and do not add them to the XML or repo.
   No token is created, requested, or saved by this project. Without an existing
   credential, pull is blocked until you choose how to authorize it. An alternative
   is building the image locally from an authenticated checkout and loading it onto
   Unraid yourself. The Actions `GITHUB_TOKEN` cannot be reused as an Unraid login.

GitHub documentation: [container registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry).

## Choose the private bind address

The XML's Extra Parameters publish `127.0.0.1:8081:3000/tcp`. This accepts
connections only from the Unraid host. The Docker application listens on port
3000 inside the container. Do not add an ordinary Unraid port mapping as well:
it would publish on all host interfaces by default.

To use an existing LAN/Tailscale interface, when you deploy:

1. In Advanced View, change only the publish address in Extra Parameters to the
   specific IP assigned to Unraid, for example
   `--publish=192.168.1.10:8081:3000/tcp` for an actual LAN IP, or
   `--publish=100.100.100.100:8081:3000/tcp` for an actual Tailscale IP. These are
   examples; substitute the real address. Keep all other restriction flags.
2. Add that exact IP to the `MCP_ALLOWED_HOSTS` variable. Add Unraid's exact
   Tailscale DNS hostname too if the MCP client uses it. Keep `localhost,127.0.0.1,[::1]`.
   If the host port changes from 8081, update the WebUI link manually too.
3. Preserve existing trusted LAN or Tailscale ACL restrictions. Binding a LAN IP
   allows any client already permitted to reach that interface. Host allowlisting
   is DNS rebinding protection, not source filtering or authentication.
4. Use `http://<chosen-private-ip>:8081/mcp` in a compatible native client that can
   reach that private address. `/health` is a health endpoint, not the MCP URL.

There are no router, firewall, proxy, tunnel, Funnel, or Tailscale settings to add
as part of this scaffold. No public internet exposure is needed. Docker's
healthcheck should become healthy shortly after startup. The template's WebUI link
works remotely only after choosing a reachable private bind address; loopback is
intentionally accessible only on Unraid itself.

To update later, pull a verified private image and recreate the container using
the same restrictions. Pin a `sha-...` image tag or manifest digest for repeatable
versions. There is no data to migrate. Unraid deployment and pulling remain manual.
