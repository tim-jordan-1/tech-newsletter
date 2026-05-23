import asyncio
import sys
import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import AsyncMock, MagicMock, patch

# Allow importing notebooklm_step from the same directory
sys.path.insert(0, str(Path(__file__).parent))
import notebooklm_step


def make_client_mock():
    """Returns (client, async_context_manager) ready for patching."""
    nb = MagicMock(id="notebook-123")

    client = MagicMock()
    client.notebooks = MagicMock()
    client.notebooks.create = AsyncMock(return_value=nb)
    client.sources = MagicMock()
    client.sources.add_text = AsyncMock(return_value=MagicMock())
    client.artifacts = MagicMock()
    client.artifacts.generate_audio = AsyncMock(return_value=MagicMock())

    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)

    return client, cm


class TestNotebookLMStep(unittest.TestCase):
    def setUp(self):
        self.tmp = NamedTemporaryFile(mode="w", suffix=".md", delete=False)
        self.tmp.write("# TL;DR\nTest newsletter content.")
        self.tmp.flush()
        self.tmp.close()
        self.content_file = self.tmp.name
        self._orig_argv = sys.argv[:]

    def tearDown(self):
        sys.argv = self._orig_argv
        Path(self.content_file).unlink(missing_ok=True)

    @patch("notebooklm_step.NotebookLMClient")
    def test_creates_notebook_with_title(self, MockClient):
        client, cm = make_client_mock()
        MockClient.from_storage = AsyncMock(return_value=cm)

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Tech Newsletter — Friday, May 23, 2026",
            "--content-file", self.content_file,
        ]

        exit_code = asyncio.run(notebooklm_step.main())

        self.assertEqual(exit_code, 0)
        client.notebooks.create.assert_called_once_with(
            "Tech Newsletter — Friday, May 23, 2026"
        )

    @patch("notebooklm_step.NotebookLMClient")
    def test_add_text_called_with_title_content_and_wait_true(self, MockClient):
        client, cm = make_client_mock()
        MockClient.from_storage = AsyncMock(return_value=cm)

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Tech Newsletter — Friday, May 23, 2026",
            "--content-file", self.content_file,
        ]

        asyncio.run(notebooklm_step.main())

        call_args = client.sources.add_text.call_args
        self.assertEqual(call_args.args[0], "notebook-123")          # notebook_id
        self.assertEqual(call_args.args[1], "Tech Newsletter — Friday, May 23, 2026")  # title
        self.assertIn("TL;DR", call_args.args[2])                    # content
        self.assertTrue(call_args.kwargs.get("wait"), "wait=True required")

    @patch("notebooklm_step.NotebookLMClient")
    def test_generate_audio_called_with_brief_format(self, MockClient):
        from notebooklm import AudioFormat

        client, cm = make_client_mock()
        MockClient.from_storage = AsyncMock(return_value=cm)

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Tech Newsletter — Friday, May 23, 2026",
            "--content-file", self.content_file,
        ]

        asyncio.run(notebooklm_step.main())

        client.artifacts.generate_audio.assert_called_once_with(
            "notebook-123", audio_format=AudioFormat.BRIEF
        )

    @patch("notebooklm_step.NotebookLMClient")
    def test_returns_nonzero_on_client_exception(self, MockClient):
        MockClient.from_storage = AsyncMock(side_effect=Exception("Auth failed"))

        sys.argv = [
            "notebooklm_step.py",
            "--title", "Test",
            "--content-file", self.content_file,
        ]

        exit_code = asyncio.run(notebooklm_step.main())

        self.assertEqual(exit_code, 1)

    def test_returns_nonzero_when_content_file_does_not_exist(self):
        sys.argv = [
            "notebooklm_step.py",
            "--title", "Test",
            "--content-file", "/tmp/this-file-does-not-exist-abc123.md",
        ]

        exit_code = asyncio.run(notebooklm_step.main())

        self.assertNotEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
