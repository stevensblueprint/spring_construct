from typing import Dict, Any
import logging
import requests
import os

from .config import WebhookConfig

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

STATE_COLORS = {
    "SUCCEEDED": 0x2ECC71,  # green
    "FAILED": 0xE74C3C,  # red
    "STARTED": 0x3498DB,  # blue
    "STOPPING": 0xF39C12,  # orange
}

DISCORD_WEBHOOKS_URL = "DISCORD_WEBHOOKS_URL"
PIPELINE_NAME = "PIPELINE_NAME"

METHOD = "POST"
HEADERS = {"Content-Type": "application/json"}


def handler(event: Dict, _context: Any) -> Dict[str, Any]:
    webhook_url = os.getenv(DISCORD_WEBHOOKS_URL)
    pipeline_name = os.getenv(PIPELINE_NAME)

    if not webhook_url or not pipeline_name:
        logger.error(
            f"Pipeline name: {pipeline_name}, Webhook URL: {webhook_url}, in environment"
        )
        return {"status": "error", "message": "Missing environment variables."}

    webhook_cfg = WebhookConfig(webhook_url, pipeline_name)
    detail = event.get("detail", {})
    state = detail.get("state", "")

    if not state:
        logger.error("Missing status in event.")
        return {"status": "error", "message": "Missing status in event body."}

    trigger = detail.get("execution-trigger", {})
    author = trigger.get("author-display-name") or trigger.get("author-id", "Unknown")
    commit_id = trigger.get("commit-id", "N/A")
    commit_message = trigger.get("commit-message", "N/A")
    pipeline_url = webhook_cfg.get_pipeline_url()
    payload = {
        "username": "AWS Pipelines",
        "content": f"Pipeline **{pipeline_name}** status changed to **{state}**",
        "embeds": [
            {
                "title": pipeline_name,
                "description": f"State: **{state}**",
                "color": STATE_COLORS.get(state, 0x95A5A6),
                "fields": [
                    {"name": "Author", "value": author, "inline": True},
                    {"name": "Commit ID", "value": commit_id, "inline": True},
                    {
                        "name": "Commit Message",
                        "value": commit_message,
                        "inline": False,
                    },
                    {
                        "name": "Pipeline Link",
                        "value": f"[View Pipeline]({pipeline_url})",
                        "inline": False,
                    },
                ],
                "timestamp": event.get("time"),
            }
        ],
    }
    try:
        resp = requests.request(METHOD, webhook_cfg.url, headers=HEADERS, json=payload)
        resp.raise_for_status()
        logger.info("Sent webhook for %s → %s", pipeline_name, state)
        return {"status": "sent"}
    except requests.exceptions.HTTPError as e:
        logger.error("Error sending webhook: %s", e)
        raise
