# Execution Preflight: public contract

Execution Preflight helps an AI Agent evaluate an existing unsigned transaction candidate before onchain execution. It returns execution evidence, not a transaction signature, execution authority or financial recommendation.

`POST https://execution.dll.io/v2/execution/preflight`

V0.2.1 supports one candidate on **Base Mainnet** (`chain_id="8453"`). It is a limited free public trial, separate from Benchmark billing: no SIWX verification, x402 payment, account or wallet connection is required for Preflight. Admission can be limited or unavailable; consult current responses and [live OpenAPI](https://execution.dll.io/openapi.json).

This guide explains the contract rather than duplicating the full schema. Live OpenAPI, [well-known metadata](https://execution.dll.io/.well-known/x402) and actual API responses are canonical. The x402 manifest currently describes the paid Benchmark resource, not Preflight payment.

## Request

Send `Content-Type: application/json`, with required `candidate` and optional `constraints`.

| Candidate field | Meaning |
| --- | --- |
| `chain_id` | Exactly the decimal string `"8453"`. |
| `from` | Valid EVM sender address for simulation; no ownership proof is made. |
| `to` | Valid top-level EVM destination address; required, not `null`. |
| `value` | Native ETH value in wei as a canonical nonnegative decimal string. `"0"` is valid. |
| `data` | Even-length `0x`-prefixed calldata; `"0x"` is valid. |

Addresses may be uniform-case or valid mixed-case checksum addresses; output addresses are lowercase. `value` and cost constraints must fit an unsigned 256-bit integer. Do not use hexadecimal or floating-point amounts, signs or leading zeros except the single string `"0"`. Chain ID, gas, wei and fee amounts use strings where the schema specifies strings; preserve them without floating-point conversion.

Decoded calldata is limited to 64 KiB; each destination list accepts at most 100 entries. These are input-schema bounds, not advice to submit large workloads. Unknown fields are rejected. No contract creation, nonce, caller-selected RPC URL, state overrides, signature or gas/fee override fields are supported. See [Quickstart](QUICKSTART.md) for a complete safe example.

## Constraints and policy

| Optional constraint | Evaluated meaning |
| --- | --- |
| `max_execution_cost_wei` | Estimated L2 execution fee must be less than or equal to this decimal-string wei threshold. If the fee is unavailable, the check is `unknown`. It is not a full-cost cap or an enforceable spending limit. |
| `allowed_to` | If present, `candidate.to` must appear in the list. An empty list allows no destination; omission imposes no allowlist restriction. |
| `denied_to` | A matching `candidate.to` is denied. A deny match overrides an allow match. |

`policy.status` is `allowed`, `denied`, `unknown` or `not_configured`. Individual `checks` report `rule`, `outcome`, `reason_code`, `observed`, `constraint` and `evidence_refs`.

These are only caller-supplied deterministic constraints. They do not inspect all internal calls, proxy targets, asset movements, token safety or application economics. A policy allowance is neither a security audit nor execution authorization.

## Simulation

`simulation.status` is:

- `success`: the read-only candidate call succeeded at the recorded snapshot, within the evaluated scope.
- `reverted`: a deterministic revert was identified at that snapshot, within the evaluated scope.
- `unavailable`: a reliable simulation outcome could not be obtained; this does not prove the candidate would fail.

`can_execute_at_snapshot` reports `likely_success`, `likely_failure` or `unknown`. These are scoped observations, not promises of onchain execution.

`return_data` may be present, with `truncated` indicating incomplete returned bytes. `revert` may contain safely available details such as `kind`, `selector`, `message` or `panic_code`; it may be `null`. Custom selectors are not an invented explanation of application behavior. Inspect `error_code`, evidence and `metadata.limitations` rather than assuming all error information is available.

No transaction is signed, submitted, included or mined by Preflight. Simulation does not establish wallet ownership, nonce readiness, future funding, signature validity, contract safety or success after chain state changes.

## Cost

`cost_estimate` explicitly separates knowledge:

| Field | Current meaning |
| --- | --- |
| `status` | `partial` when a known L2 estimate exists; otherwise `unavailable`. Never a complete-cost claim. |
| `estimated_gas` | Decimal-string gas estimate, or `null`. Not a chosen broadcast gas limit. |
| `execution_cost` | Estimated **L2 fee**: `status`, `estimated_fee_wei`, `estimated_fee_eth`, `gas_price_wei`, and evidence references. |
| `l1_data_cost` | Currently `unavailable`; `estimated_amount_wei` and `estimated_amount_eth` are `null`. |
| `total_transaction_cost` | Currently `unavailable`; complete transaction cost is not asserted. |

Known L2 fee is estimated gas multiplied by the observed gas-price quote. Both are estimates, not realized receipt fees or guaranteed future prices. The native fee representation is ETH/wei, not USD. `candidate.value` is transferred native value in the candidate, not an execution fee.

Unavailable components are **unknown, not zero**. Never label L2-only cost as total execution cost, and never treat `max_execution_cost_wei` passing as proof that a complete spending budget is satisfied. If the result is insufficient for your decision, obtain the missing evidence separately rather than inventing a fee.

## Judgment

| State | Meaning |
| --- | --- |
| `PASS` | Simulation succeeded, applicable deterministic checks passed, and no material unresolved issue was identified within DLL's evaluated evidence. |
| `CAUTION` | Execution may be technically possible, but material evidence is incomplete or important uncertainty remains. |
| `BLOCK` | Deterministic evidence indicates not to proceed with the candidate, such as a recognized simulation revert or explicit constraint rejection. |
| `INDETERMINATE` | Available evidence is insufficient to form a reliable judgment. |

Ordinary successful V0.2.1 assessments remain **CAUTION** because L1 and complete fee coverage are unavailable. A BLOCK can reflect caller policy, not only simulation failure. Read the reasons; do not interpret state alone as a full safety assessment.

`judgment.reasons` contains `code`, a concise `message` and `evidence_refs`. Public reason codes include `TOTAL_COST_INCOMPLETE`, `SIMULATION_REVERTED`, `SIMULATION_UNAVAILABLE`, `DESTINATION_DENIED`, `DESTINATION_NOT_ALLOWED`, `EXECUTION_ESTIMATE_EXCEEDS_LIMIT` and `POLICY_INPUT_UNAVAILABLE`. Inspect the returned codes and evidence; explanation text is not a parsing contract.

`judgment.economic_profitability` and `judgment.strategic_desirability` are `"not_evaluated"`. No state implies profitability, investment quality, strategic or financial advice, application-level economic value, or permission to execute. HTTP 200 can contain BLOCK or INDETERMINATE.

## Evidence, snapshots and freshness

`evidence` contains observations with response-local `id` and `kind`. Simulation, gas estimates, fee observations, cost coverage and policy checks can be linked from `evidence_refs`. Resolve references within the same response; they are not permanent records or independently verified cryptographic proofs.

`metadata` includes `observed_at`, `input_digest`, version labels, `snapshot`, read-only flags and `limitations`. A snapshot, when available, identifies a block number, hash and timestamp. Simulation and gas-estimate observations relate to that recorded chain snapshot. The fee quote is independently observed and is not bound to the snapshot. Do not assume all evidence describes one instant or future state.

A new assessment can observe a newer snapshot and different quote. `snapshot` may be `null` when reliable state evidence is unavailable. `input_digest` is a correlation identifier, not sender authentication, a signed authorization or an onchain transaction hash.

`historical_context.status` is currently `unavailable`: no defensible historical candidate comparison is asserted. Do not manufacture a comparison from unrelated transactions.

## Errors and retries

Non-200 responses normally use `error.code`, `error.message` and `error.status_code`; `retryable` and `retry_after_seconds` may also be present. See live OpenAPI for the complete response schemas.

| HTTP | Integration behavior |
| --- | --- |
| 400 | Invalid/unsupported input, commonly `INVALID_PREFLIGHT_REQUEST`. Correct the request; do not retry unchanged malformed input. |
| 404 | Preflight unavailable, including `PREFLIGHT_DISABLED`; check current advertised operations. |
| 413 | Request too large; reduce it within supported input bounds. |
| 429 | Admission/rate/budget/busy rejection. Honor `Retry-After` or response guidance when provided. Do not evade limits. |
| 502 / 503 / 504 | Availability, upstream, admission or timeout failure. Inspect the code and retryability; use bounded retries only when useful. |

Some evidence failures instead return HTTP 200 with unavailable observations and INDETERMINATE (or a separate deterministic policy BLOCK). Always inspect business fields. Never send payment to resolve a Preflight admission error. Preflight has no idempotent-result replay guarantee: a repeated request may create a new assessment, not return an identical snapshot.

## Safety boundary

No signing, broadcasting, custody, nonce management, autonomous execution, DEX/bridge-specific routing or profitability analysis. DLL does not prove ownership of `from`, authorize transactions or verify all application effects. Simulation is not a guarantee of inclusion or future success. Do not send private keys, credentials, signatures or other secrets. The Agent is responsible for independent downstream checks and any separately authorized execution.
