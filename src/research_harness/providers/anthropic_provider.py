import os

from anthropic import Anthropic

from ..formatter import console
from .base import REQUEST_TIMEOUT, Completion, LLMProvider

SDK_RETRIES = 5  # SDK retries 408/409/429/5xx and connection errors with backoff

# Anthropic's server-side search tool. The model decides when to search; the
# searches run on Anthropic's side inside the same request.
WEB_SEARCH_TOOL = {"type": "web_search_20260209", "name": "web_search", "max_uses": 5}
# A turn with server tools can stop with "pause_turn"; re-sending it resumes it.
MAX_PAUSE_RESUMES = 4

_FINISH = {
    "end_turn": "stop",
    "stop_sequence": "stop",
    "max_tokens": "length",
    "refusal": "content_filter",
}


class AnthropicProvider(LLMProvider):
    """Claude via the Anthropic Messages API.

    Model ids: "anthropic/claude-opus-4.8" -> "claude-opus-4-8" (prefix
    stripped, dots become dashes, matching Anthropic's naming).

    thinking_level maps to adaptive thinking + output_config.effort
    (low | medium | high | xhigh | max). Without it no thinking config is sent,
    so each model runs at its own default (Opus 5+ and Fable think by default).

    web_search adds the web search server tool (up to 5 searches a turn).
    Only the text of a turn is kept: the search results are not replayed to
    later turns, and searches are billed per request on top of tokens (the
    count is printed; the cost summary covers tokens only).

    Thinking tokens are not reported separately by this API; they are inside
    output_tokens, which pricing bills at the output rate either way.

    Server-side refusal fallbacks are deliberately NOT enabled: they would
    silently answer with a different model mid-debate.
    """

    label = "anthropic"
    default_api_key_env = "ANTHROPIC_API_KEY"
    supports_web_search = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # An auth token is the SDK's only other credential source.
        api_key = self._api_key(required=not os.environ.get("ANTHROPIC_AUTH_TOKEN"))
        self.client = Anthropic(
            api_key=api_key,
            base_url=self.base_url,
            timeout=REQUEST_TIMEOUT,
            max_retries=SDK_RETRIES,
        )
        if self.temperature != 1.0:
            console.print(
                f"[yellow]anthropic: temperature={self.temperature} ignored — current Claude "
                f"models reject sampling parameters[/yellow]"
            )

    def api_model_id(self) -> str:
        if self.api_model:
            return self.api_model
        return super().api_model_id().replace(".", "-")

    def _complete(self, messages: list[dict]) -> Completion:
        kwargs = {
            "model": self.api_model_id(),
            "max_tokens": self.max_tokens,
        }
        system = self.get_system_prompt()
        if system:
            kwargs["system"] = system
        if self.wants_reasoning:
            kwargs["thinking"] = {"type": "adaptive"}
            kwargs["output_config"] = {"effort": self.thinking_level}
        if self.web_search:
            kwargs["tools"] = [dict(WEB_SEARCH_TOOL)]
        if self.extra_body:
            kwargs["extra_body"] = self.extra_body

        text: list[str] = []
        input_tokens = output_tokens = searches = 0
        convo = list(messages)
        for _ in range(MAX_PAUSE_RESUMES + 1):
            # Streaming: large max_tokens on a non-streaming request trips the
            # SDK's long-request guard.
            with self.client.messages.stream(**kwargs, messages=convo) as stream:
                message = stream.get_final_message()

            usage = message.usage
            input_tokens += (
                usage.input_tokens
                + (usage.cache_creation_input_tokens or 0)
                + (usage.cache_read_input_tokens or 0)
            )
            output_tokens += usage.output_tokens
            server_tools = getattr(usage, "server_tool_use", None)
            searches += (getattr(server_tools, "web_search_requests", 0) or 0) if server_tools else 0
            text.extend(b.text for b in message.content if b.type == "text")

            if message.stop_reason != "pause_turn":
                break
            # The server paused a long search turn. Send it back as it came and
            # the server carries on from there; no extra user message.
            convo = convo + [{"role": "assistant", "content": message.content}]

        if searches:
            console.print(f"[dim]anthropic: {self.model} ran {searches} web search(es) this turn[/dim]")

        return Completion(
            content="".join(text),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            finish_reason=_FINISH.get(message.stop_reason, message.stop_reason),
            native_finish_reason=message.stop_reason,
        )
