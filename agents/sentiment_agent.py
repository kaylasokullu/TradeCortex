"""
Sentiment Agent — uses Claude to analyze recent MSFT news sentiment.
Returns a score from -1.0 (very negative) to +1.0 (very positive).
"""

import json
import logging
import anthropic

from core.config import settings

logger = logging.getLogger("sentiment_agent")


class SentimentAgent:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        logger.info("📰 SentimentAgent initialized (Claude + web search)")

    async def analyze(self, symbol: str) -> dict:
        """
        Ask Claude to search the web for recent news about MSFT and
        return a structured sentiment score.
        """
        try:
            prompt = f"""
You are a financial sentiment analyst. Search the web for the 5 most recent
news headlines about {symbol} (Microsoft) from the last 24 hours.

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

            response = await self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=500,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract text blocks from response
            result_text = ""
            for block in response.content:
                if block.type == "text":
                    result_text += block.text

            sentiment = json.loads(result_text.strip())
            logger.info(f"Sentiment for {symbol}: {sentiment['label']} ({sentiment['score']})")
            return sentiment

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse sentiment JSON: {e}")
            return self._neutral_fallback(symbol)
        except Exception as e:
            logger.error(f"Sentiment agent error: {e}")
            return self._neutral_fallback(symbol)

    def _neutral_fallback(self, symbol: str) -> dict:
        """Return neutral sentiment if the API call fails — don't block trading."""
        return {
            "score": 0.0,
            "label": "neutral",
            "summary": f"Could not fetch sentiment for {symbol}. Defaulting to neutral.",
            "headlines": [],
        }
