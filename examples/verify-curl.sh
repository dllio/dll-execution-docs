#!/usr/bin/env bash
# One read-only assessment of an already-broadcast public historical transaction.
# No signing, broadcast, payment or automatic retry.
set -euo pipefail

curl --silent --show-error --fail-with-body --max-time 25 \
  --request POST 'https://execution.dll.io/v2/execution/verify' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "transaction_hash": "0x966ca06d5fd53a1d07ca7adb1f43b92958bab0c1f3cc0f86deacdf10a3738533",
    "expectation": {
      "chain_id": "8453",
      "inclusion": "included",
      "receipt_status": "success"
    }
  }' \
  --write-out '\nHTTP %{http_code}\n'

# HTTP 200 is not VERIFIED: inspect verification.state and verification.checks.
# Inspect outcome.inclusion, receipt availability and observation_errors too.
# Included/successful does not mean finalized. L2 fee is not total cost.
# Honor returned retry guidance; this script does not retry.
