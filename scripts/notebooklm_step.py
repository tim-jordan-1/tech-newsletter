import argparse
import asyncio
import sys
from pathlib import Path

from notebooklm import AudioFormat, NotebookLMClient


async def main() -> int:
    parser = argparse.ArgumentParser(description="Create a NotebookLM notebook with audio overview.")
    parser.add_argument("--title", required=True, help="Notebook title")
    parser.add_argument("--content-file", required=True, dest="content_file", help="Path to markdown content file")
    args = parser.parse_args()

    content = Path(args.content_file).read_text(encoding="utf-8")

    try:
        async with await NotebookLMClient.from_storage() as client:
            nb = await client.notebooks.create(args.title)
            await client.sources.add_text(nb.id, args.title, content, wait=True)
            await client.artifacts.generate_audio(nb.id, audio_format=AudioFormat.BRIEF)
        return 0
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
