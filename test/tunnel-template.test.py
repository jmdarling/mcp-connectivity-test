"""Reject unsafe template changes, independent of Docker availability."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("validator", ROOT / "scripts/validate-tunnel-template.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.root = ET.parse(ROOT / "templates/openai-tunnel-client.xml").getroot()
        self.metadata = json.loads((ROOT / "tunnel/official-image.json").read_text())

    def test_valid_template(self):
        module.validate(self.root, self.metadata)

    def test_reject_unsafe_changes(self):
        for element, value in [("Network", "host"), ("Privileged", "true"), ("Repository", "ghcr.io/openai/tunnel-client:latest"), ("ExtraParams", "--privileged"), ("PostArgs", "--control-plane.api-key=literal-key")]:
            with self.subTest(element=element):
                root = copy.deepcopy(self.root)
                root.find(element).text = value
                with self.assertRaises(AssertionError):
                    module.validate(root, self.metadata)

    def test_reject_added_port_or_key_environment(self):
        for kind, target in [("Port", "8080"), ("Variable", "CONTROL_PLANE_API_KEY")]:
            root = copy.deepcopy(self.root)
            ET.SubElement(root, "Config", {"Type": kind, "Target": target}).text = "must-not-be-here"
            with self.assertRaises(AssertionError):
                module.validate(root, self.metadata)

    def test_reject_writable_secret(self):
        self.root.find("Config[@Type='Path']").set("Mode", "rw")
        with self.assertRaises(AssertionError):
            module.validate(self.root, self.metadata)


if __name__ == "__main__":
    unittest.main()
