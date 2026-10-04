# DLL Execution: instructions for AI Agents

Use this guide to integrate the public API. It does not grant authority to sign, pay, broadcast or execute anything.

## When to call

Call Execution Preflight when you already have one unsigned Base Mainnet transaction candidate and need evidence about likely call success, estimated L2 execution cost, explicit destination/cost constraints and unresolved issues before acting.

Do not use it to generate an execution plan, route a swap or bridge, execute a transaction, verify wallet ownership, establish profitability, audit a contract or obtain a guaranteed total cost. Do not use it as an arbitrary RPC proxy.

## Discover the current contract

1. Read [live OpenAPI](https://execution.dll.io/openapi.json).
2. Use `POST https://execution.dll.io/v2/execution/preflight` if the operation is advertised.
3. [Well-known x402 metadata](https://execution.dll.io/.well-known/x402) describes existing paid resource discovery. Preflight is a separate limited free trial: no SIWX, payment signature, wallet connection or payment is required.

If the live contract differs from these guides, follow the live contract. Never adapt a request by inserting credentials or signing material.

## Construct a request

Send JSON with a `candidate` containing all five fields:

- `chain_id`: the string `"8453"`.
- `from`: an EVM address used as the simulation sender, not a verified identity.
- `to`: the top-level destination EVM address.
- `value`: native ETH value in wei, as a canonical nonnegative decimal string; use `"0"` for no native value.
- `data`: even-length `0x`-prefixed calldata; use `"0x"` for empty calldata.

Optionally include `constraints.max_execution_cost_wei`, `constraints.allowed_to` or `constraints.denied_to`. The cost constraint covers **estimated L2 fee only**, not total cost or transferred value. Lists match the top-level destination only; deny wins over allow.

Do not include unknown fields, nonce, RPC URL, gas/fee overrides, private keys, signatures or wallet secrets. See [Quickstart](QUICKSTART.md) for a safe request and [Preflight](PREFLIGHT.md) for exact supported constraints.

## Interpret results, not just HTTP status

HTTP 200 means an assessment was returned. It does **not** mean simulation succeeded, policy passed, execution happened or the candidate is advisable.

| `judgment.state` | Agent handling |
| --- | --- |
| `PASS` | Evaluated checks passed without an identified material unresolved issue. Still inspect scope/limitations; DLL has not authorized execution. |
| `CAUTION` | Inspect `judgment.reasons` and evidence. Resolve uncertainty relevant to your task before deciding; do not automatically promote this to PASS. |
| `BLOCK` | Do not proceed with the unchanged candidate under the same constraints/evidence. Inspect the reason and correct the candidate or legitimate constraint. |
| `INDETERMINATE` | Do not infer success or a deterministic revert. Obtain reliable evidence before deciding whether another assessment is useful. |

Also read `simulation.status`, `policy.status`, each cost component's `status`, `judgment.reasons`, `evidence` and `metadata.limitations`. Use machine-readable reason codes rather than parsing explanation text. Evidence references resolve to IDs within that response only.

## Incomplete costs and judgment boundaries

- L2 execution fee may be available at `cost_estimate.execution_cost`.
- L1 data fee is currently unavailable at `cost_estimate.l1_data_cost`.
- Complete transaction cost is currently unavailable at `cost_estimate.total_transaction_cost`.
- Missing amounts are `null`, not zero. Never substitute the L2 estimate for a full-cost budget.
- Ordinary successful assessments currently remain `CAUTION` because total cost is incomplete.
- `judgment.economic_profitability` and `judgment.strategic_desirability` are `"not_evaluated"`. No state implies investment quality, financial advice or application-level economic value.

## Freshness and repeated calls

Inspect `metadata.observed_at` and `metadata.snapshot`. Simulation and gas-estimate observations relate to the reported snapshot; the fee quote has its own observation time and is not snapshot-bound. A later Preflight may use newer chain state and return a different result.

Repeat only when it adds value, such as after a material candidate/constraint change or when fresh evidence is needed. Do not poll blindly, rotate identities/IPs to evade admission limits or retry indefinitely. Preflight has no idempotent-result replay guarantee; repeating it may perform a new assessment.

For HTTP 429, honor `Retry-After` or `error.retry_after_seconds` when provided. For other errors, inspect `error.code` and `error.retryable`, use bounded retries only when appropriate, and retain the response for diagnosis. A 404 can indicate Preflight is unavailable; consult live OpenAPI rather than assuming it is usable.

## Safety

DLL does not sign, broadcast, hold assets, choose nonces, authorize or autonomously execute this candidate. It does not prove ownership of `from`, validate all application effects or guarantee future success. Keep all secrets out of the request. Any downstream execution requires your own separate authority, safety checks and tools.
