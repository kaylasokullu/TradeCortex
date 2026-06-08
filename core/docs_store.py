"""
Docs store — persists knowledge base entries to docs.json on Railway volume.
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("docs_store")


def _docs_path() -> Path:
    trade_log = Path(os.getenv("TRADE_LOG_PATH", "trades.json"))
    return trade_log.parent / "docs.json"


def load_docs() -> list:
    path = _docs_path()
    try:
        if path.exists():
            return json.loads(path.read_text())
    except Exception as e:
        logger.warning(f"Could not read docs.json: {e}")
    return []


def save_docs(docs: list) -> None:
    path = _docs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(docs, indent=2))


def add_doc(title: str, content: str, category: str = "General") -> dict:
    docs = load_docs()
    doc = {
        "id": f"doc_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "title": title.strip(),
        "content": content.strip(),
        "category": category.strip(),
        "date": datetime.now(timezone.utc).isoformat(),
    }
    docs.append(doc)
    save_docs(docs)
    logger.info(f"📄 Doc created: {doc['id']} — {title[:40]}")
    return doc


def remove_doc(doc_id: str) -> bool:
    docs = load_docs()
    filtered = [d for d in docs if d["id"] != doc_id]
    if len(filtered) == len(docs):
        return False
    save_docs(filtered)
    return True
