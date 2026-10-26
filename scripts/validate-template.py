"""Validate deployment invariants without third-party Python packages."""
from pathlib import Path
import xml.etree.ElementTree as ET

root = ET.parse(Path(__file__).resolve().parents[1] / "templates/mcp-connectivity-test.xml").getroot()
assert root.tag == "Container" and root.attrib["version"] == "2"
assert root.findtext("Privileged") == "false"
assert root.findtext("Network") == "bridge"
assert root.findtext("Repository") == "ghcr.io/jmdarling/mcp-connectivity-test:latest"
extra = root.findtext("ExtraParams")
for flag in ["--publish=127.0.0.1:8081:3000/tcp", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true"]:
    assert flag in extra
assert not root.findall("Config[@Type='Port']")
assert not root.findall("Config[@Type='Path']")
print("PASS: Unraid XML, loopback binding, private image path, restricted runtime, no mounts")
