"""
Sentiment Agent — uses Claude to analyze recent GEV news sentiment.
Returns a score from -1.0 (very negative) to +1.0 (very positive).
"""

import json
import re
import logging
import anthropic

from core.config import settings

logger = logging.getLogger("sentiment_agent")

PROMPT_TEMPLATE = """
You are a financial sentiment analyst. Search the web for the 5 most recent
news headlines about {symbol} (GE Vernova) from the last 24 hours.

Based on those headlines, return ONLY a JSON object with this exact shape:
{{
    "score": <float between -1.0 and 1.0>,
    "label": "<one of: very_positive, positive, neutral, negative, very_negative>",
    "summary": "<one sentence summary of current sentiment>",
    "headlines": ["<headline 1>", "<headline 2>", "<headline 3>"]
}}

Scoring guide:
 1.0  = major positive catalyst (earnings beat, big partnership, stock buyback)
 0.5  = mildly positive news
 0.0  = neutral / no significant news
-0.5  = mildly negative news
-1.0  = major negative catalyst (earnings miss, SEC investigation, exec scandal)

Return ONLY the JSON. No preamble, no explanation, no markdown fences.
"""


class SentimentAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        logger.info("📰 SentimentAgent initialized (Claude + web search)")

    async def analyze(self, symbol: str) -> dict:
        try:
            messages = [{"role": "user", "content": PROMPT_TEMPLATE.format(symbol=symbol)}]

            # Agentic loop — Claude may use web_search before giving a final answer
            while True:
                response = await self.client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=1024,
                    tools=[{"type": "web_search_20250305", "name": "web_search"}],
                    messages=messages,
                )

                # Collect any text from this turn
                result_text = ""
                for block in response.content:
                    if block.type == "text":
                        result_text += block.text

                # If Claude finished (no more tool calls), parse the JSON
                if response.stop_reason == "end_turn":
                    return self._parse(result_text, symbol)

                # If Claude wants to use a tool, feed results back and continue
                if response.stop_reason == "tool_use":
                    messages.append({"role": "assistant", "content": response.content})
                    tool_results = []
                    for block in response.content:
                        if block.type == "tool_use":
                            # web_search is executed server-side; result is in the next response
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": "Search executed.",
                            })
                    messages.append({"role": "user", "content": tool_results})
                    continue

                # Any other stop reason — use whatever text we have
                return self._parse(result_text, symbol)

        except Exception as e:
            logger.error(f"Sentiment agent error: {e}")
            return self._neutral_fallback(symbol)

    def _parse(self, text: str, symbol: str) -> dict:
        text = text.strip()
        # Strip markdown fences if Claude added them despite instructions
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

        if not text:
            logger.warning("Sentiment response was empty — using neutral fallback")
            return self._neutral_fallback(symbol)

        try:
            sentiment = json.loads(text)
            logger.info(f"Sentiment for {symbol}: {sentiment['label']} ({sentiment['score']})")
            return sentiment
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse sentiment JSON: {e} | raw: {text[:200]}")
            return self._neutral_fallback(symbol)

    def _neutral_fallback(self, symbol: str) -> dict:
        return {
            "score": 0.0,
            "label": "neutral",
            "summary": f"Could not fetch sentiment for {symbol}. Defaulting to neutral.",
            "headlines": [],
        }
