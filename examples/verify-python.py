#!/usr/bin/env python3
"""One read-only historical transaction assessment; no signing or payment."""

import json
import sys
import urllib.error
import urllib.request

payload = {
    "transaction_hash": "0x966ca06d5fd53a1d07ca7adb1f43b92958bab0c1f3cc0f86deacdf10a3738533",
    "expectation": {
        "chain_id": "8453",
        "inclusion": "included",
        "receipt_status": "success",
    },
}
request = urllib.request.Request(
    "https://execution.dll.io/v2/execution/verify",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=25) as response:
        result = json.load(response)
    print(json.dumps(result, indent=2))
    state = result["verification"]["state"]
    if state == "VERIFIED":
        print("Requested checks satisfied; no finality or authorization guarantee.")
    elif state == "CONTRADICTED":
        print("At least one check is contradicted; inspect checks and reasons.")
    elif state == "INDETERMINATE":
        print("Insufficient evidence; inspect outcome and observation_errors.")
    else:
        raise ValueError("Unexpected Verification state; consult live OpenAPI.")
    cost = result["realized_cost"]
    if all(cost[k] is not None for k in (
        "gas_used", "effective_gas_price_wei", "realized_l2_execution_fee_wei"
    )):
        l2_fee = int(cost["gas_used"]) * int(cost["effective_gas_price_wei"])
        if l2_fee != int(cost["realized_l2_execution_fee_wei"]):
            raise ValueError("Inconsistent realized L2 fee; do not infer a total cost.")
    # Use exact integers, never floats. Missing fees are unknown, not zero.
    # Included/successful is not finalized. No automatic retry is performed.
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
except (urllib.error.URLError, TimeoutError, ValueError, KeyError, TypeError) as error:
    print("Verification request failed:", str(error), file=sys.stderr)
    sys.exit(1)
