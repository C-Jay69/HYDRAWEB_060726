"""Context-window management: estimate tokens and truncate message history."""


def estimate_tokens(text: str) -> int:
    # ~4 characters per token is a solid heuristic across modern tokenizers.
    return max(1, len(text) // 4)


def truncate_messages(messages: list[dict], max_tokens: int) -> list[dict]:
    """Keep the system prompt, drop the oldest turns until under budget."""
    if not messages:
        return messages
    system = [m for m in messages if m.get("role") == "system"]
    rest = [m for m in messages if m.get("role") != "system"]
    budget = max_tokens - sum(estimate_tokens(m["content"]) for m in system)
    kept: list[dict] = []
    total = 0
    for message in reversed(rest):
        tokens = estimate_tokens(message["content"])
        if total + tokens > budget and kept:
            break
        total += tokens
        kept.append(message)
    kept.reverse()
    # Keep at least the most recent user message.
    if not kept and rest:
        kept = [rest[-1]]
    return system + kept
