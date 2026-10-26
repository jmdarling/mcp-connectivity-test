"""Validate the actual Unraid tunnel template and emit smoke-test configuration."""
from pathlib import Path
import json
import shlex
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def validate(root, metadata):
    assert root.tag == "Container" and root.attrib.get("version") == "2"
    image = f"ghcr.io/{metadata['repository']}:{metadata['version']}@{metadata['digest']}"
    assert root.findtext("Repository") == image
    assert root.findtext("Network") == "container:mcp-connectivity-test"
    assert root.findtext("Privileged") == "false"
    assert not root.findall("Config[@Type='Port']") and root.find("WebUI") is None
    extra = shlex.split(root.findtext("ExtraParams"))
    assert extra == ["--user=65532:65532", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--memory=256m", "--pids-limit=64"]
    args = shlex.split(root.findtext("PostArgs"))
    assert args == ["--control-plane.api-key=file:/run/secrets/openai-runtime-key", "--health.listen-addr=127.0.0.1:8080", "--allow-remote-ui=false", "--open-web-ui=false", "--log.format=json", "--log.http-raw-unsafe=false"]
    variables = {item.attrib["Target"]: (item.text or "") for item in root.findall("Config[@Type='Variable']")}
    assert variables == {"CONTROL_PLANE_TUNNEL_ID": "", "MCP_SERVER_URL": "http://127.0.0.1:3000/mcp"}
    paths = root.findall("Config[@Type='Path']")
    assert len(paths) == 1
    assert paths[0].attrib["Target"] == "/run/secrets/openai-runtime-key"
    assert paths[0].attrib["Mode"] == "ro"
    assert paths[0].text == "/mnt/user/appdata/openai-tunnel-client/runtime-api-key"
    assert root.findtext("TemplateURL") == "https://raw.githubusercontent.com/jmdarling/mcp-connectivity-test/main/templates/openai-tunnel-client.xml"
    return {"image": image, "binary": metadata["binary"], "version": metadata["version"], "extra": extra, "args": args, "environment": variables, "secretTarget": paths[0].attrib["Target"]}


if __name__ == "__main__":
    metadata = json.loads((ROOT / "tunnel/official-image.json").read_text())
    config = validate(ET.parse(ROOT / "templates/openai-tunnel-client.xml").getroot(), metadata)
    if "--json" in sys.argv:
        print(json.dumps(config))
    else:
        print("PASS: official image pin, file secret, shared private network, loopback admin, no ports or privileges")
