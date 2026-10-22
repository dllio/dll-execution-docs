# Quickstart: DLL Execution

First [choose a capability](CAPABILITY_SELECTION.md): unsigned candidate → Preflight; already-broadcast transaction with explicit expectations → Verification; observed transaction costs with historical context → Benchmark. All three are Base Mainnet, read-only and non-custodial.

Evaluate one unsigned Base Mainnet candidate before acting. Preflight is a limited free public trial and requires no API key, wallet signature or payment.

Already have a broadcast transaction hash? Go to [first Verification request](#first-verification-request). Preflight evaluates a candidate before execution; Verification observes a transaction afterward.

## Free HTTP or Remote MCP

For free Preflight and Verification, choose either HTTP or Remote MCP. Both are Base Mainnet, read-only and require **no DLL account, API key, wallet connection, payment or private repository access**. Public admission/rate limits still apply. Benchmark is a separate flow; it is not needed for either path below.

### HTTP API: zero npm dependencies

Use a supported Node.js release (22+; 24 recommended) and Git. Clone this public repository; no DLL permission request is needed:

```sh
git clone --depth 1 https://github.com/dllio/dll-execution-docs.git
cd dll-execution-docs
```

Run one existing example for the capability you need:

```sh
# Before signing: one harmless, zero-value USDC balanceOf simulation.
node examples/javascript.mjs

# After independent broadcast: inspect one existing public transaction.
node examples/verify-javascript.mjs
```

Each command makes **one live free API request**. No npm install, model, SDK, local server or database is needed. You can copy either `.mjs` file to an empty directory and run it independently. Use a terminal/server environment; cross-origin browser access is not enabled. Edit the candidate or transaction hash for your own public input, never secrets. The Verification example explicitly checks both inclusion and receipt success.

For offline validation instead of live requests, run:

```sh
node --test test/*.test.mjs
```

Tests use local mocks, not the public API. The examples print the full structured response; take care when sharing output containing your addresses or calldata. Network access to `https://execution.dll.io` and normal TLS validation are required for live calls. Transport errors, malformed responses, unsupported decision states and non-2xx HTTP exit nonzero; no automatic retries or redirects are performed. Exit zero means a recognized assessment was received, **not** permission to execute or proof of success.

### Remote MCP: use your existing client

1. In a client that supports remote MCP, add a server using **Streamable HTTP** and `https://execution.dll.io/mcp`.
2. Use no DLL authentication header or credential. Enable the connection in your client and follow its tool approval settings.
3. Refresh/list tools. Select `preflight_transaction` for an unsigned candidate or `verify_transaction` for an already-broadcast hash. Only currently enabled capabilities are advertised.
4. Supply the same JSON arguments as the HTTP API examples below. For receipt success, explicitly set `expectation.receipt_status` to `"success"`.

No local MCP server, AgentKit install or DLL SDK is required. Your client/model provider may independently require its own account or fees; DLL's two tools require neither. A connected server does not make a model select it or authorize external tool use. For initialization messages, exact requests and error handling, follow the existing [Remote MCP guide](MCP.md#protocol-sequence).

Read the business response under `result.structuredContent.response`; text-only clients receive the same object serialized in `result.content`. HTTP success or `result.isError=false` is not a domain success. Inspect `response.judgment.state` or `response.verification.state`, the reason codes, checks, evidence and observation errors.

### Preserve state, evidence and uncertainty

- Preflight: distinguish `PASS`, `CAUTION`, `BLOCK` and `INDETERMINATE`. Inspect `judgment.reasons`, `simulation`, `policy`, `evidence` and `metadata.limitations`. PASS is not authorization or guaranteed execution.
- Verification: distinguish `VERIFIED`, `CONTRADICTED` and `INDETERMINATE`. Inspect `verification.checks`, `verification.reasonCodes`, `outcome` and `observation_errors`. Default inclusion checks do not establish receipt success or finality.
- Missing fees/evidence are unknown, not zero or success. L2 fees are not full cost. An optional conditional network-fee estimate does not upgrade legacy Judgment. Neither tool establishes wallet ownership, causality, profitability or arbitrary application effects.
- Honor 429 retry guidance; do not rotate clients, poll blindly or retry indefinitely. A new request can produce a new assessment. A 404/503 can indicate capability unavailability: consult [live OpenAPI](https://execution.dll.io/openapi.json) and [capabilities](https://execution.dll.io/capabilities).

## First safe request

Endpoint: `POST https://execution.dll.io/v2/execution/preflight`

This example models a harmless `balanceOf` call on Base Mainnet USDC, with zero native value. `from` is a demonstration address, not an account you must own or fund. Calling DLL only simulates the candidate: it does not send a transaction, move USDC or change an allowance.

```json
{
  "candidate": {
    "chain_id": "8453",
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "value": "0",
    "data": "0x70a082310000000000000000000000001111111111111111111111111111111111111111"
  }
}
```

All five candidate fields are required. `chain_id` and `value` are strings, not JSON numbers. `constraints` is optional; unsupported fields are rejected. Consult [live OpenAPI](https://execution.dll.io/openapi.json) for the current complete schema.

## Run one example

From this repository, choose **one**:

```sh
bash examples/curl.sh
```

```sh
node examples/javascript.mjs
```

```sh
python3 examples/python.py
```

curl requires curl and Bash; JavaScript requires Node.js 20+ with standard `fetch`; Python requires Python 3 and uses only its standard library. Each example submits one request, has a client timeout and does not automatically retry. A client timeout is not a guarantee that no assessment happened; avoid blind repeats. Examples contain no signer, secrets or payment code.

## Read the response

HTTP 200 returns these sections; values depend on observed chain state:

| Section              | What to inspect                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `chain`, `candidate` | Supported chain and normalized evaluated candidate.                                                      |
| `simulation`         | `status`: `success`, `reverted` or `unavailable`; safe revert details when available.                    |
| `cost_estimate`      | `estimated_gas`, `execution_cost`, `l1_data_cost`, `total_transaction_cost`, with explicit availability. |
| `policy`             | `status` and individual caller-constraint `checks`; no supplied constraints means `not_configured`.      |
| `judgment`           | `state`, machine-readable reasons and response-local evidence references.                                |
| `evidence`           | Observations supporting the result, linked by IDs.                                                       |
| `metadata`           | Observation time, snapshot, read-only flags and limitations.                                             |
| `historical_context` | Currently `unavailable`; no historical comparison is asserted.                                           |

For an ordinary successful simulation, expect `simulation.status="success"` and usually `judgment.state="CAUTION"`, with `TOTAL_COST_INCOMPLETE`. The estimated L2 fee can be available while L1 data fee and complete cost remain unavailable. **Unavailable does not mean zero.** Do not convert that L2 estimate into a claimed total.

`BLOCK` identifies deterministic evidence against proceeding. `INDETERMINATE` means reliable judgment is unavailable. `PASS` means only that the evaluated checks passed without a material unresolved issue, not permission or a recommendation to execute. See [judgment semantics](PREFLIGHT.md#judgment).

For non-200 responses, inspect `error.code` and `error.message`. HTTP 429 means admission was rejected; honor retry guidance when present. Do not run the three examples in a rapid loop to evade limits.

## Add meaningful constraints

Only these optional fields are supported:

```json
{
  "max_execution_cost_wei": "100000000000000",
  "allowed_to": ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"],
  "denied_to": []
}
```

This is a **constraints fragment**, not a complete request. Place it under the top-level `constraints` key alongside `candidate`.

`max_execution_cost_wei` constrains the estimated **L2 fee**, not full cost or transferred value. Destination lists match only `candidate.to`, not contracts reached indirectly. An allowlist is not a contract audit; a deny match wins even if the address is also allowed.

## Before acting on a result

Simulation is read-only and snapshot-specific; later state may differ. It does not guarantee funding, future inclusion, success or desired application effects. DLL does not prove ownership of `from`, sign, broadcast, hold assets or authorize execution. Profitability and strategic desirability are not evaluated.

Next: [Agent instructions](AGENTS.md), [detailed contract](PREFLIGHT.md), and the canonical [live OpenAPI](https://execution.dll.io/openapi.json).

## First Verification request

Endpoint: `POST https://execution.dll.io/v2/execution/verify`.

Only `transaction_hash` is required. This public historical Base ETH transfer is used as an example; DLL does not create or resend it:

```json
{
  "transaction_hash": "0x966ca06d5fd53a1d07ca7adb1f43b92958bab0c1f3cc0f86deacdf10a3738533"
}
```

The default checks Base Mainnet and inclusion only, **not receipt success**. For inclusion and success, send:

```json
{
  "transaction_hash": "0x966ca06d5fd53a1d07ca7adb1f43b92958bab0c1f3cc0f86deacdf10a3738533",
  "expectation": {
    "chain_id": "8453",
    "inclusion": "included",
    "receipt_status": "success"
  }
}
```

Choose one single-request example:

```sh
bash examples/verify-curl.sh
```

```sh
node examples/verify-javascript.mjs
```

```sh
python3 examples/verify-python.py
```

These examples use the explicit inclusion/success expectation, a timeout and no automatic retries. They require the same standard tools as the Preflight examples and no wallet, private key, account or payment. They only read an independently broadcast transaction.

HTTP 200 means an assessment was returned, not that verification passed. Read `verification.state`: `VERIFIED`, `CONTRADICTED` or `INDETERMINATE`, then inspect `verification.checks`, `verification.reasonCodes`, `outcome` and `observation_errors`. Not found, pending and provider unavailable are distinct observations; see the [Verification guide](VERIFICATION.md).

Amounts in `realized_cost` are decimal strings or `null`. `realized_l2_execution_fee_wei` is gas used multiplied by effective gas price, not total execution cost. L1 may be available when observed, but total execution cost remains unavailable. Verification does not guarantee finality, prove wallet ownership, authorize execution or establish causality/profitability.

## First Benchmark request

Endpoint: `POST https://execution.dll.io/v1/benchmark/transactions`.

```json
{
  "transaction_hashes": [
    "0x6e0d0dc8cb8ee700ff723784444d2c02c2e5c17aeaef9b34136613cfee9cb01d"
  ],
  "window": "24h"
}
```

Unlike free Preflight and Verification, the current Benchmark path requires an `Idempotency-Key` header and verified SIWX wallet identity. Begin with the [Benchmark challenge example](BENCHMARK.md#public-example-begin-the-challenge-flow), then follow the challenge before authorizing any payment. First three valid analyses per verified wallet are free; further valid analyses cost $0.005 each via x402 USDC. No execution transaction is created or broadcast.

Current 402 responses carry `{}` in the JSON body and the challenge in `PAYMENT-REQUIRED`. Read `X-DLL-Benchmark-Stage`: nonempty accepts during `identity` is a maximum quote, not a requirement to pay before checking free allowance. Fully free batches need no payment signature. For paid batches, N requested hashes authorize at most N × 5000 atomic USDC, separate from actual billing. Follow [the stage-aware SDK reference](BENCHMARK_CLIENT.md), including fresh SIWX for an existing payment envelope. No real-money production closed loop or universal client compatibility is claimed by this example.

Inspect every `results` item and `billing`, not HTTP 200 alone. Historical percentiles are not future fees or route recommendations. Keep the same key/body/identity for reconciliation; never create a second settlement for `PAYMENT_PENDING`. See [Benchmark](BENCHMARK.md) for precise pricing, response, limitations and errors.
