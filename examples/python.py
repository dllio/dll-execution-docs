#!/usr/bin/env python3
"""One harmless read-only USDC balanceOf assessment; no signing or payment."""

import json
import sys
import urllib.error
import urllib.request

payload = {
    "candidate": {
        "chain_id": "8453",
        "from": "0x1111111111111111111111111111111111111111",
        "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "value": "0",
        "data": "0x70a082310000000000000000000000001111111111111111111111111111111111111111",
    }
}

request = urllib.request.Request(
    "https://execution.dll.io/v2/execution/preflight",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=25) as response:
        result = json.load(response)
    print(json.dumps(result, indent=2))
    # HTTP success does not imply PASS, execution or economic value.
    print("Judgment:", result["judgment"]["state"])
    # Keep monetary strings unchanged or use int for wei, never float.
    # Unavailable L1/total cost is not zero. No automatic retry is performed.
except urllib.error.HTTPError as error:
    try:
        result = json.load(error)
    except (ValueError, UnicodeDecodeError):
        result = {"error": {"message": "Response was not JSON"}}
    print(json.dumps({
        "http_status": error.code,
        "retry_after": error.headers.get("Retry-After"),
        "error": result.get("error"),
    }, indent=2), file=sys.stderr)
    sys.exit(1)
except (urllib.error.URLError, TimeoutError, ValueError) as error:
    print("Preflight request failed:", str(error), file=sys.stderr)
    sys.exit(1)
