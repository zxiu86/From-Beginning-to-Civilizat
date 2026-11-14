"""Tests for manual-only GitHub Actions workflow, zero paid external API calls, and project compliance."""

import ast
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


class TestWorkflowAndCompliance(unittest.TestCase):
    def test_18_and_20_workflow_is_strictly_manual_and_compatible(self) -> None:
        wf_path = REPO_ROOT / ".github" / "workflows" / "simulation.yml"
        self.assertTrue(wf_path.exists(), "Missing .github/workflows/simulation.yml")
        text = wf_path.read_text(encoding="utf-8")

        # Must contain workflow_dispatch
        self.assertIn("workflow_dispatch:", text)
        self.assertIn("ubuntu-24.04", text)
        self.assertIn("timeout-minutes: 360", text)
        self.assertIn("actions/checkout@v4", text)
        self.assertIn("actions/setup-python@v5", text)
        self.assertIn("actions/upload-artifact@v4", text)
        self.assertIn("actions/download-artifact@v4", text)
        self.assertIn("requirements.txt", text)
        self.assertIn("--require-torch", text)

        # Extract the `on:` block and ensure NO automatic triggers exist
        on_match = re.search(r"^on:\s*\n((?:[ \t]+.*\n)*)", text, flags=re.MULTILINE)
        self.assertIsNotNone(on_match, "Could not locate 'on:' trigger section")
        on_block = on_match.group(1)
        forbidden_triggers = ["push:", "pull_request:", "schedule:", "release:", "workflow_run:", "repository_dispatch:"]
        for trig in forbidden_triggers:
            self.assertNotIn(trig, on_block, f"Forbidden automatic trigger '{trig}' found in workflow 'on:' block")

        # Ensure no workflow re-triggering via gh workflow run or API dispatch
        self.assertNotIn("gh workflow run", text)
        self.assertNotIn("/dispatches", text)

    def test_19_zero_external_llm_or_paid_api_imports(self) -> None:
        forbidden_modules = {
            "openai",
            "anthropic",
            "google.generativeai",
            "google.genai",
            "cohere",
            "requests",
            "httpx",
            "aiohttp",
            "urllib.request",
        }
        sim_dir = REPO_ROOT / "sim"
        for py_file in sim_dir.glob("*.py"):
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        self.assertNotIn(
                            alias.name,
                            forbidden_modules,
                            f"Forbidden external API module '{alias.name}' imported in {py_file.name}",
                        )
                elif isinstance(node, ast.ImportFrom):
                    mod = node.module or ""
                    for fmod in forbidden_modules:
                        self.assertFalse(
                            mod == fmod or mod.startswith(fmod + "."),
                            f"Forbidden external API module '{mod}' imported in {py_file.name}",
                        )


if __name__ == "__main__":
    unittest.main()
