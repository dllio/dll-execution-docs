# Execution Verification: public contract

Execution Verification observes an already-broadcast transaction and checks its factual outcome against narrow expectations. An AI Agent can use it even if DLL never performed the original Preflight.

`POST https://execution.dll.io/v2/execution/verify`

V0.1 supports **Base Mainnet only** (`chain_id="8453"`). It is free, read-only, `paid=false` and `x402_required=false`. No API key, SIWX proof, wallet connection or payment is required. DLL never signs, broadcasts, holds private keys, takes custody or modifies blockchain state.

**Preflight: before execution — evaluate what is likely to happen within the observed evidence. Verification: after execution — observe what actually happened and evaluate explicit expectations.** Neither capability authorizes execution or evaluates profitability.

Discover current operations through [OpenAPI](https://execution.dll.io/openapi.json) and [capabilities](https://execution.dll.io/capabilities). Those live sources and actual API responses are canonical. This guide explains the contract rather than duplicating the complete schema. The [x402 manifest](https://execution.dll.io/.well-known/x402) remains Benchmark-only; Verification is not a paid x402 resource.

## Request

Send `Content-Type: application/json`. Only `transaction_hash` is required: a `0x`-prefixed 32-byte hexadecimal hash. Unknown fields are rejected. Do not include credentials, signatures, RPC URLs, assessment references or execution instructions.

### A. Minimal inclusion verification

This example refers to a public historical Base ETH transfer, not a new transaction to submit:

```json
{
  "transaction_hash": "0x966ca06d5fd53a1d07ca7adb1f43b92958bab0c1f3cc0f86deacdf10a3738533"
}
```

The default expectation is `chain_id="8453"` and `inclusion="included"`. It asks whether the transaction is observed as included on Base Mainnet. It does **not** check receipt success, finality, authorization, ownership, causality or profitability.

### B. Inclusion and successful receipt

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

`receipt_status` is explicit because inclusion is not receipt success. A reverted transaction can be included. Supported receipt expectations are `"success"` and `"reverted"`; a reverted receipt can be VERIFIED when the explicit expectation is revert. Receipt success does not prove arbitrary application effects.

`expectation.inclusion` accepts `"included"` or `"pending"`. A pending expectation cannot be combined with a receipt-status expectation, because a pending transaction has not supplied an executed receipt. Omitted chain/inclusion fields use the defaults above.

### C. Candidate content verification

The following hash and addresses are **synthetic placeholders**, not a known matching onchain transaction. Replace the hash and all candidate fields with the transaction and content you actually expect; do not run this expecting VERIFIED.

```json
{
  "transaction_hash": "0x1212121212121212121212121212121212121212121212121212121212121212",
  "expectation": {
    "chain_id": "8453",
    "inclusion": "included",
    "receipt_status": "success",
    "candidate": {
      "chain_id": "8453",
      "from": "0x1111111111111111111111111111111111111111",
      "to": "0x2222222222222222222222222222222222222222",
      "value": "0",
      "data": "0x"
    }
  }
}
```

All five candidate fields are required when `candidate` is supplied. The chain is the string `"8453"`; `from` and `to` are valid EVM addresses; `value` is native ETH value in wei as a canonical unsigned decimal string; `data` is even-length `0x`-prefixed calldata. Empty calldata is `"0x"`; `to` cannot be null. Amounts must fit uint256. Addresses and hexadecimal content are normalized for comparison. See [candidate input rules](PREFLIGHT.md#request) and live OpenAPI for bounds.

This checks observed chain/from/to/value/data content against your candidate. It does not simulate or submit the candidate, prove control of the wallet, identify an Agent, authorize execution, infer intent or establish causality. No prior assessment or internal ID is needed. Preflight `constraints` are not supported here.

## Response model

HTTP 200 contains the following sections. Field spelling is significant: public outcome/check fields include camelCase, while the outer API and cost fields use snake_case.

| Section | Fields and interpretation |
| --- | --- |
| `chain` | `chain_id` and `name`: the supported public chain. |
| `transaction_hash` | The normalized hash being observed. |
| `expectation` | The normalized requested checks, with defaults; optional `candidate` and `receipt_status` only when supplied. |
| `outcome` | `version`, `id`, `observedAt`, `chain` (`family`, `id`), `transactionHash`, `inclusion`, `integrity`, `block` (`number`, `hash`), `canonicality`, `finality`, `transaction`, `receipt`, `realizedL2FeeWei`, `costCompleteness`, `totalExecutionCost`, `provenance`. |
| `verification` | `version`, `methodology`, `state`, `completeness`, `outcomeRef`, `checks`, `reasonCodes`, `evidence`. |
| `realized_cost` | Known receipt execution costs and explicit unavailable components; see below. |
| `observation_errors` | Bounded entries with `observation` and `error_code`; an empty array means no listed observation errors, not proof of finality. |
| `metadata` | `schema_version`, `methodology_version`, `observed_at`, `finality`, `executes_transaction=false`, `authorizes_transaction=false`. |

`outcome.transaction` reports `availability`, `from`, `to`, `toKnown`, `value`, `data`, `completeness`. `outcome.receipt` reports `availability`, `status`, `gasUsed`, `effectiveGasPrice`, `l1DataFeeWei`; unavailable fields are null. Block numbers, gas and wei quantities use decimal strings, not JSON numbers. Preserve them as strings or exact integers.

Each `verification.checks` entry has `id`, `dimension`, `state`, `reasonCode`, `evidenceRefs`. Each `verification.evidence` entry has `id`, `kind`, `availability`, `refs`. Resolve evidence references within the same response; they are not durable IDs, signatures, attestations or cryptographic proofs. Public `outcome.provenance` supplies observation availability and state-association context; it does not establish provider trust or finality.

Current metadata identifies `execution_verification_api_v0.1` and methodology `execution_verification_v1`. Follow the live schema for the complete nested representation; do not substitute invented fields such as `verified: true` or `total_fee`.

## Verification states

**HTTP 200 != VERIFIED. Always inspect `verification.state`.**

| State | Meaning |
| --- | --- |
| `VERIFIED` | Available evidence satisfies the explicit checks requested, including applicable defaults. |
| `CONTRADICTED` | Available deterministic evidence contradicts at least one requested check. Other checks can still be unavailable; inspect all checks. |
| `INDETERMINATE` | There is no established contradiction, but available evidence is insufficient to determine all requested checks. Missing evidence is never verification success. |

`verification.completeness` describes the evaluated checks, not total cost or finality. Machine consumers should use `reasonCodes` and per-check `reasonCode` rather than parse prose.

The following are **response excerpts**, not complete response objects or request bodies. They use real fields and illustrate how to read the result.

### D. VERIFIED interpretation

```json
{
  "verification": {
    "state": "VERIFIED",
    "reasonCodes": ["CHAIN_MATCH", "INCLUSION_MATCH", "RECEIPT_STATUS_MATCH"]
  }
}
```

For the explicit request in B, these reasons mean chain, inclusion and receipt-status checks matched. They do not verify wallet ownership, authorization, intent, profitability or finality.

### E. CONTRADICTED interpretation

```json
{
  "verification": {
    "state": "CONTRADICTED",
    "reasonCodes": ["CHAIN_MATCH", "INCLUSION_MATCH", "RECEIPT_STATUS_MISMATCH"]
  }
}
```

For B, an observed reverted receipt contradicts the success expectation. It is not a provider outage. Candidate-content mismatches have codes such as `CANDIDATE_FROM_MISMATCH`, `CANDIDATE_TO_MISMATCH`, `CANDIDATE_VALUE_MISMATCH` or `CANDIDATE_DATA_MISMATCH`.

### F. INDETERMINATE / unavailable-evidence interpretation

```json
{
  "verification": {
    "state": "INDETERMINATE",
    "reasonCodes": ["CHAIN_MATCH", "INCLUSION_MATCH", "RECEIPT_UNAVAILABLE"]
  },
  "observation_errors": [
    { "observation": "receipt", "error_code": "RPC_TIMEOUT" }
  ]
}
```

This illustrates missing evidence for the requested receipt-status check. A reliable receipt outcome has not been established; do not invent success, revert or transaction absence. A temporary error may justify a later bounded retry, not an immediate polling loop.

## Transaction observation states

| Observation | How to identify it | Interpretation |
| --- | --- | --- |
| Included | `outcome.inclusion="included"`; inspect `block`, `integrity` and receipt fields. | Observed inclusion, not finality or necessarily receipt success. |
| Pending/unconfirmed | `outcome.inclusion="pending"`; no included block or executed receipt. | An included expectation can be `CONTRADICTED` with `INCLUSION_MISMATCH` at this observation. It does not prove permanent failure. |
| Not found | `outcome.inclusion="not_found"`, transaction unavailable, without a transaction-observation failure. | Not observed by this lookup; normally `INCLUSION_UNAVAILABLE` for an included expectation. Not proof of permanent chain absence. |
| Provider unavailable | Relevant `observation_errors`, often with `outcome.inclusion="unknown"` if transaction state could not be established. | An observation failure, not evidence that the transaction does not exist. Other observations may still be usable. |
| Receipt unavailable | `outcome.receipt.availability="unavailable"`; inspect receipt errors. | A receipt-status expectation cannot verify without its evidence. Inclusion-only checks may still verify when their evidence is sufficient. |
| Canonicality uncertain | `outcome.canonicality="unknown"` or `"unavailable"`; inspect errors, integrity and checks. | `unknown` does not necessarily make every check indeterminate. `unavailable` canonicality or inconsistent observations prevent reliable verification; reasons include `CANONICALITY_UNAVAILABLE` or `OUTCOME_INCONSISTENT`. Neither state establishes finality. |

`observation_errors[].observation` is `chain`, `transaction`, `receipt`, `block` or `canonicality`. Supported public error codes are:

- `RPC_TIMEOUT`: observation timed out.
- `RPC_RATE_LIMITED`: observation was rate-limited.
- `RPC_UNAVAILABLE`: observation source unavailable, including service failure.
- `MALFORMED_PROVIDER_RESPONSE`: unusable observation format.
- `PREFLIGHT_CAPABILITY_UNAVAILABLE`: required observation capability unavailable.
- `PREFLIGHT_STATE_UNAVAILABLE`: required state association unavailable or inconsistent.

The last two literal code names also appear in Verification's live schema; do not rename them in clients or assume they indicate a separate Preflight request. Provider timeout, rate limiting and failure can be represented inside an HTTP 200 assessment with an indeterminate result. Inspect errors and checks together rather than infer transaction state from HTTP status alone.

## Finality and safety boundary

Included != finalized. Successful receipt != finalized. Canonical observation != finality guarantee.

`outcome.finality` and `metadata.finality` currently report `"unknown"` or `"unavailable"`; Verification does not provide a finalized-state guarantee. Even VERIFIED applies only to the explicit checks and currently available evidence. A later observation can differ.

Verification does not prove authorization, ownership, Agent identity, intent, causality, investment quality or economic correctness. Consistent content is not proof that DLL caused a transaction. DLL never signs, broadcasts, holds keys, takes custody or modifies blockchain state. Verify independently broadcast historical transactions without sending secrets or signing material.

## Realized execution cost

`realized_cost` uses ETH/wei and observed receipt data:

```text
realized_l2_execution_fee_wei = gas_used × effective_gas_price_wei
```

Use exact integer arithmetic, never floating-point financial arithmetic. A synthetic cost-only example (not a full response) is:

```json
{
  "gas_used": "21000",
  "effective_gas_price_wei": "1000000000",
  "realized_l2_execution_fee_wei": "21000000000000",
  "l1_data_fee_wei": null,
  "l1_data_fee_status": "unavailable",
  "total_execution_cost_wei": null,
  "total_execution_cost_status": "unavailable",
  "completeness": "partial",
  "currency": "ETH",
  "unit": "wei",
  "basis": "observed_receipt"
}
```

Gas, effective gas price and L2 fee can be null when unavailable. L1 data fee may be `available` when observed, otherwise `unavailable` with a null amount. Total execution cost currently remains null / unavailable **even if L1 is observed**. `completeness` is `partial` or `unavailable`; L2-only cost must never be called total cost. Unavailable is unknown, not zero. Transferred value and DLL service payment are separate from execution fees; Verification itself is free.

## HTTP errors and retries

Non-200 API errors use the JSON envelope `error.code`, `error.message`, `error.status_code`, with optional `error.retryable` and `error.retry_after_seconds`. Do not assume optional fields are present or infer retryability from their absence. Guard JSON parsing against intermediary/network failures.

| HTTP | Codes / integration handling |
| --- | --- |
| 400 | `INVALID_VERIFICATION_REQUEST`: correct malformed or unsupported input; do not repeat it unchanged. |
| 404 | Route unavailable, including `VERIFICATION_DISABLED` if public availability is withdrawn. This is not the current normal workflow and is not transaction-not-found. Check current discovery. |
| 413 | `VERIFICATION_BODY_TOO_LARGE` for the public oversized-body rejection; reduce the request. |
| 429 | `VERIFICATION_EDGE_RATE_LIMITED`, or admission codes `VERIFICATION_CLIENT_RATE_LIMITED`, `VERIFICATION_GLOBAL_RATE_LIMITED`, `VERIFICATION_CLIENT_DAILY_LIMITED`, `VERIFICATION_GLOBAL_DAILY_LIMITED`, `VERIFICATION_BUSY`. Honor the returned retry guidance, not an invented fixed retry loop. |
| 503 | Service/configuration/admission unavailable, including `RPC_UNAVAILABLE`, `VERIFICATION_ADMISSION_UNAVAILABLE` or `WRONG_CHAIN_ID`. Inspect the code and retry guidance. |
| 502 / 504 | Observation/response failure or timeout, including `MALFORMED_PROVIDER_RESPONSE`, `RPC_TIMEOUT`, `VERIFICATION_REQUEST_TIMEOUT` where returned at HTTP level. Use bounded retries only when appropriate. |

The public oversized-body JSON contract is:

```json
{
  "error": {
    "code": "VERIFICATION_BODY_TOO_LARGE",
    "message": "Verification request body exceeds the allowed limit.",
    "status_code": 413,
    "retryable": false
  }
}
```

The public edge rate-limit contract is HTTP 429, `Content-Type: application/json`, `Retry-After: 20`:

```json
{
  "error": {
    "code": "VERIFICATION_EDGE_RATE_LIMITED",
    "message": "Verification edge admission limit exceeded.",
    "status_code": 429,
    "retryable": true,
    "retry_after_seconds": 20
  }
}
```

The body limit is 160 KiB; the JSON 413 response also has `Content-Type: application/json` and `Cache-Control: no-store`. Keep requests small. Transaction not found, pending, receipt unavailable and provider-observation failures may instead appear inside an HTTP 200 assessment. Never send payment to resolve an admission error or evade limits by changing identities.

Repeated requests may observe changed evidence; there is no idempotent-result replay guarantee. Honor `Retry-After` or `error.retry_after_seconds` when supplied, cap retries, and retry only when useful. A client timeout does not establish that no assessment occurred.

## Runnable examples

Choose one: [curl](examples/verify-curl.sh), [JavaScript fetch](examples/verify-javascript.mjs), or [Python standard library](examples/verify-python.py). Each performs one inclusion/success assessment of the historical example, with no automatic retry, signer, wallet secret or payment. Do not run them in a rapid loop.

See [Quickstart](QUICKSTART.md#first-verification-request) and [Agent instructions](AGENTS.md#verification-integration-rules). Use the live OpenAPI for complete schemas; no schema or example grants permission to execute a transaction.
