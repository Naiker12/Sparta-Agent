"""Bounded, text-only manual task execution. No agent tools or workspace access."""
import asyncio
import json


async def preview_task(client, model: str, prompt: str) -> str:
    async def collect():
        parts, size = [], 0
        async for line in client.stream_chat_completion(
            messages=[
                {"role": "system", "content": "Respond to the task using only the supplied instructions. You have no file, command, browsing or workspace tools. Do not claim to have performed external actions."},
                {"role": "user", "content": prompt},
            ],
            model=model, max_tokens=3000, enabled_tools=[], tools=[], tool_choice="none",
        ):
            for item in line.splitlines():
                if not item.startswith("data:") or item[5:].strip() == "[DONE]":
                    continue
                payload = json.loads(item[5:].strip())
                if payload.get("error"):
                    raise ValueError("Provider failed")
                for choice in payload.get("choices", []):
                    delta = choice.get("delta", {})
                    if delta.get("tool_calls"):
                        raise ValueError("Tools are not allowed")
                    content = delta.get("content")
                    if isinstance(content, str):
                        size += len(content)
                        if size > 24000:
                            raise ValueError("Response exceeds limit")
                        parts.append(content)
        output = "".join(parts).strip()
        if not output:
            raise ValueError("Empty response")
        return output
    return await asyncio.wait_for(collect(), timeout=90)
