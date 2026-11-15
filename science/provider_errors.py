"""Small public failure receipts, never authentication headers or request payloads."""
import json
import os
import re


class ProviderFailure(ValueError):
    def __init__(self, phase, status, detail):
        self.details = {'provider': 'NASA AppEEARS', 'phase': phase,
                        'http_status': status, 'detail': detail}
        super().__init__(f'NASA AppEEARS {phase} returned HTTP {status}: {detail} No numerical result published.')


def appeears_failure(error, path):
    phase = ('authentication' if path == '/login' else
             'task_submission' if path == '/task' else
             'product_metadata' if path.startswith('/product/') else
             'download' if path.startswith('/bundle/') else 'task_status')
    detail = 'Provider rejected the request.'
    try:
        document = json.loads(error.read(65536))
        message = document.get('message')
        if isinstance(message, str) and message.strip():
            detail = message.splitlines()[0].strip()
            if detail.startswith(('{', '[')):
                detail = 'Provider validation rejected the supplied parameters; raw payload omitted.'
    except (ValueError, TypeError, AttributeError, OSError):
        pass
    for key, value in os.environ.items():
        if value and re.search(r'KEY|TOKEN|SECRET|PASSWORD|USERNAME', key, re.I):
            detail = detail.replace(value, '[redacted]')
    detail = re.sub(r'https?://\S+', '[provider resource]', detail)
    detail = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[redacted account]', detail)
    detail = re.sub(r'[\x00-\x1f\x7f]', '', detail)[:500]
    return ProviderFailure(phase, error.code, detail)
