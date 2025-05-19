from dataclasses import dataclass
import os


@dataclass
class WebhookConfig:
    url: str
    pipeline_name: str

    def get_pipeline_url(self) -> str:
        return f"https://us-east-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/{self.pipeline_name}/view?region=us-east-1"
