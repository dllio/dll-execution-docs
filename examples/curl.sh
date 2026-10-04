#!/usr/bin/env bash
# One harmless read-only USDC balanceOf assessment. No signing or payment.
set -euo pipefail

curl --silent --show-error --fail-with-body --max-time 25 \
  --request POST 'https://execution.dll.io/v2/execution/preflight' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "candidate": {
      "chain_id": "8453",
      "from": "0x1111111111111111111111111111111111111111",
      "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "value": "0",
      "data": "0x70a082310000000000000000000000001111111111111111111111111111111111111111"
    }
  }' \
  --write-out '\nHTTP %{http_code}\n'

# HTTP 200 is an assessment, not permission to execute.
# Read judgment.state, reasons, cost availability and metadata.limitations.
# Honor retry guidance on 429; this example never automatically retries.
