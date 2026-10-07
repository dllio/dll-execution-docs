# Execution-cost Benchmark

`POST https://execution.dll.io/v1/benchmark/transactions`

Benchmark compares observed **Base Mainnet** transaction costs with recent similar transactions and returns historical percentiles and normalized cost context. It is read-only: no signing, broadcasting or custody of execution transactions. It is not a route recommendation, investment/profitability judgment or future fee guarantee.

Use [Preflight](PREFLIGHT.md) for an unsigned candidate before execution and [Verification](VERIFICATION.md) for explicit outcome checks afterward. Use Benchmark when you need historical cost context, not a success/finality check. [Live OpenAPI](https://execution.dll.io/openapi.json), [capabilities](https://execution.dll.io/capabilities), [pricing](https://execution.dll.io/pricing) and [payment](https://execution.dll.io/payment) are the canonical current contract and terms.

## Request

```json
{
  "transaction_hashes": [
    "0x6e0d0dc8cb8ee700ff723784444d2c02c2e5c17aeaef9b34136613cfee9cb01d"
  ],
  "window": "24h"
}
```

The hash is a public historical example, not a transaction to create or resend. Request 1–100 `0x`-prefixed 32-byte transaction hashes. `window` is `1h`, `24h` or `7d`; omission defaults to `24h`. Duplicate hashes do not represent additional unique analyses. No candidate, assessment reference, private key or execution signature belongs in the body.

The current public path requires `Idempotency-Key`: a nonempty string of at most 128 characters. Generate one opaque key per logical request; keep the same key, verified wallet identity and **exact JSON content including hash ordering and window** for replay/reconciliation. A changed request needs its own key only when it is genuinely a new operation, not an attempt to bypass an unresolved settlement.

## Identity and payment flow

SIWX proves a wallet identity for the allowance and service-payment flow. It is not ownership verification for the analyzed transactions, Agent identity, intent or execution authorization. Never provide private keys. A client wallet signs identity/payment messages independently under its own authority; DLL does not sign or submit an execution transaction.

1. Submit the bounded request with `Idempotency-Key`. Without valid identity proof, expect HTTP 402 with an x402 V2 challenge in `PAYMENT-REQUIRED`, including the `sign-in-with-x` extension. An identity-only challenge can have `accepts: []`: it is **not yet a demand to pay**.
2. Decode the challenge with a compatible x402/SIWX client. Validate its domain, URI, chain, nonce and expiry against the intended service. Produce the requested SIWX proof using a separately authorized wallet, and send the encoded proof in `SIGN-IN-WITH-X` with the same key/body. Follow the challenge's encoding rather than inventing a signature format.
3. The first **three valid analyses per verified wallet** are free. If the remaining request requires paid analyses, the server returns a payment challenge describing x402 V2 `upto`, USDC and the supported payment network. Inspect live metadata and challenge terms before authorizing anything.
4. A payment-capable client may submit the encoded authorization in `PAYMENT-SIGNATURE`, along with valid SIWX proof and the same key/body. The authorization is a maximum, not the final charge. Use the official [x402 protocol/client documentation](https://github.com/coinbase/x402); do not hand-roll wallet/payment cryptography.
5. On a completed HTTP 200 response, inspect per-item results **and** `billing`. Paid completion uses `PAYMENT_SETTLED`; an entirely free completion uses `PAYMENT_NOT_REQUIRED`. Never infer completion solely from a prior authorization or network timeout.

Use a fresh SIWX proof when the server supplies a new challenge; do not assume a previously consumed nonce can be reused. Identity proof and the idempotency key are different concepts. Preflight and Verification need neither SIWX nor payment.

## Pricing and valid results

After the allowance, each successfully delivered valid analysis costs **$0.005**, settled as **5000 USDC atomic units** on the advertised network. It is not billing per HTTP request or per submitted hash. Failed, invalid, unavailable or undelivered analyses are not charged and do not consume the free allowance. The actual settlement may be lower than the authorized maximum.

A valid result is analyzed, has `benchmark_status="available"`, has no item error, and has not failed result delivery (`persistence_status="failed"` is not a valid result). Inspect the authoritative `billing` counts rather than implementing your own billing calculation from estimated request size.

## Response and interpretation

| Section                                         | Interpretation                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `requested_transactions`, `unique_transactions` | Decimal-string submitted/unique counts.                                                             |
| `results`                                       | One result per unique hash. Inspect every item; HTTP 200 can contain failures or insufficient data. |
| `metadata`                                      | Base Mainnet scope, read-only status, native ETH cost denomination and comparison methodology.      |
| `billing`                                       | Current public payment-path completion: valid/free/paid counts and actual service settlement.       |

Each result includes `transaction_hash`, `analysis_status`, `benchmark_status`, `persistence_status`, `coarse_transaction_type`, `gas_used_bucket`, `benchmark_window`, `cohort_sample_count`, `execution_cost_benchmark`, `total_cost_benchmark` and `error`.

- `analysis_status`: `analyzed`, `not_found`, `unavailable` or `invalid_response`. Not found is not provider unavailability or proof of permanent absence.
- `benchmark_status`: `available`, `insufficient_data` or `unavailable`. Insufficient comparable observations cannot support a percentile claim.
- `persistence_status`: `inserted`, `duplicate`, `failed` or `not_applicable`; it is not transaction execution or settlement status. No storage implementation knowledge is needed to integrate.
- Cost metrics, when present, contain `status`, `sample_count`, `p25_wei`, `p50_wei`, `p75_wei`, `p90_wei`, `percentile_position` and `deviation_from_p50_percent`. Use exact decimal strings; do not parse wei with floating-point arithmetic.
- `total_cost_benchmark` may be null or unavailable. Do not promote L2-only execution cost into total cost. Missing amounts are unknown, not zero. Transferred value and USDC DLL service payment are separate from ETH execution fees.

Full schema-valid illustrative responses are in [OpenAPI](https://execution.dll.io/openapi.json). This synthetic **billing fragment**, not a full response, shows one paid valid analysis:

```json
{
  "status": "settled",
  "payment_code": "PAYMENT_SETTLED",
  "payment_state": "settled",
  "valid_analysis_count": "1",
  "free_valid_analysis_count": "0",
  "paid_valid_analysis_count": "1",
  "unit_price_usdc_atomic": "5000",
  "actual_settled_usdc_atomic": "5000",
  "network": "eip155:8453",
  "settlement_reference": null
}
```

`billing.status` is `free` or `settled`; `payment_state` is `not_required` or `settled` on completion. Free completion has zero paid/settled amount. A null settlement reference is allowed and does not by itself invalidate the completed status.

## Reconciliation and errors

Non-200 API errors normally use `error.code`, `error.message`, `error.status_code`, with optional `retryable`, `retry_after_seconds`, `payment_state` and `idempotency_key`. A 402 protocol challenge is not an ordinary analysis result: inspect its headers/extensions. Guard against intermediary/non-JSON failures as well.

| HTTP / code                                                  | Safe handling                                                                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400 `INVALID_BENCHMARK_REQUEST` / `IDEMPOTENCY_KEY_REQUIRED` | Correct the input/header; no blind retry of malformed input.                                                                                                            |
| 402 identity/payment challenge                               | Fulfill only the requested, independently authorized identity/payment step. Empty accepts is identity-first, not a payment offer.                                       |
| 403 `PAYMENT_IDENTITY_MISMATCH`                              | Do not mix a payment identity with another SIWX identity. Correct the authorized identity context.                                                                      |
| 409 `IDEMPOTENCY_CONFLICT`                                   | Key/body conflict; do not change an unresolved request's body or rotate keys to force payment again.                                                                    |
| 503 `PAYMENT_PENDING`                                        | Keep the same key/body/identity. Retry only to reconcile, honoring guidance; **never submit a second settlement**. Escalate unresolved status rather than paying again. |
| 503 `PAYMENT_UNAVAILABLE` / `PAYMENT_FAILED_SAFE_TO_RETRY`   | Use bounded same-key retries according to returned guidance. Safe-to-retry is an explicit result, not an inference from timeout.                                        |
| 503 `BENCHMARK_UNAVAILABLE`                                  | Service availability failure. Inspect returned retry guidance and do not invent a paid success.                                                                         |
| 429 or other retryable availability error                    | Honor `Retry-After` / returned guidance and cap retries; never evade limits.                                                                                            |

Item-level `error.code` can indicate not-found, unavailable, timeout, rate-limited or malformed observations. Do not classify a provider failure as transaction absence. A client timeout or lost response does not prove no work or settlement happened. Reconcile the original operation before considering a new one; completed operations can replay the recorded result through the same-key flow.

## Public example: begin the challenge flow

This single request uses a fresh placeholder key; replace it with your own opaque key once, then retain it for this logical operation. It contains no signing or payment code and does not automatically retry:

```sh
curl --max-time 30 -i https://execution.dll.io/v1/benchmark/transactions \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: replace-with-one-new-opaque-request-key' \
  --data '{"transaction_hashes":["0x6e0d0dc8cb8ee700ff723784444d2c02c2e5c17aeaef9b34136613cfee9cb01d"],"window":"24h"}'
```

Expect the identity challenge, not an immediate authenticated result. Follow the protocol steps above with your compatible client; never paste wallet keys into scripts or substitute an execution transaction signature. The guide describes how to integrate, not permission for an Agent to spend funds.

## Limitations and discovery

Base Mainnet only. Historical comparison depends on supported observation availability and sufficient comparable samples. Percentiles do not predict future fees, prove finality, audit a contract, establish profitability or select an execution route. No broadcast, custody or execution authority is provided.

Discover Benchmark through [OpenAPI](https://execution.dll.io/openapi.json), [capabilities](https://execution.dll.io/capabilities) and [the x402 manifest](https://execution.dll.io/.well-known/x402). Benchmark is the current paid x402 resource; do not apply its payment flow to free Preflight or Verification. See [capability selection](CAPABILITY_SELECTION.md) and [Agent instructions](AGENTS.md).
