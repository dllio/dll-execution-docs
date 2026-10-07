# DLL Execution: instructions for AI Agents

Use this guide to integrate the public API. It does not grant authority to sign, pay, broadcast or execute anything.

## When to call

Call Execution Preflight when you already have one unsigned Base Mainnet transaction candidate and need evidence about likely call success, estimated L2 execution cost, explicit destination/cost constraints and unresolved issues before acting.

Do not use it to generate an execution plan, route a swap or bridge, execute a transaction, verify wallet ownership, establish profitability, audit a contract or obtain a guaranteed total cost. Do not use it as an arbitrary RPC proxy.

Call [Execution Verification](VERIFICATION.md) after a transaction has been broadcast independently, when you need to inspect its observed Base Mainnet outcome against narrow expectations. You do not need a prior DLL Preflight. Do not use Verification to prove authorization, wallet ownership, Agent identity, intent, causality, finality or application-specific postconditions.

## Discover the current contract

1. Read [live OpenAPI](https://execution.dll.io/openapi.json).
2. Read [capabilities](https://execution.dll.io/capabilities) and select the advertised operation: `/v2/execution/preflight` before execution or `/v2/execution/verify` afterward, both with POST.
3. [Well-known x402 metadata](https://execution.dll.io/.well-known/x402) describes Benchmark paid resource discovery. Preflight and Verification are separate free read-only capabilities: no SIWX, payment signature, wallet connection or payment is required for either.

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

## Verification integration rules

1. Send `transaction_hash`, a `0x`-prefixed 32-byte hexadecimal hash, to `POST https://execution.dll.io/v2/execution/verify`.
2. Without `expectation`, the checks default to `chain_id="8453"` and `inclusion="included"`. This does **not** check receipt success. To check success, explicitly set `expectation.receipt_status="success"`; use `"reverted"` only when that is your intended expectation.
3. Optional `expectation.candidate` uses the same five candidate fields described above. Verification compares observed transaction content; it does not execute the candidate or prove ownership of `from`. Do not add Preflight `constraints` to a Verification request.
4. On HTTP 200, inspect `verification.state`, `verification.checks`, `verification.reasonCodes`, `outcome` and `observation_errors`. `VERIFIED` applies only to requested checks. `CONTRADICTED` identifies at least one deterministic mismatch. `INDETERMINATE` preserves insufficient evidence. A reverted receipt can satisfy an explicit reverted-status expectation.
5. Use `outcome.inclusion` to distinguish `included`, `pending`, `not_found` and `unknown`. A pending observation can contradict an included expectation. A not-found observation is not proof of permanent absence. Provider failures appear in `observation_errors`; never reinterpret them as transaction absence.
6. Inspect `outcome.receipt.availability` and `outcome.canonicality`. Missing receipt evidence prevents verifying a requested receipt-status check; it does not automatically invalidate a narrower inclusion-only assessment. Unknown canonicality does not establish finality or necessarily make every check indeterminate. See [observation states](VERIFICATION.md#transaction-observation-states).
7. Keep `realized_cost` decimal-string values as strings or exact integers. L2 fee equals gas used times effective gas price. L1 may be observed; total cost is currently unavailable. Never substitute L2 fee for total cost or infer zero from `null`.
8. Treat `outcome.finality` and `metadata.finality` as unknown/unavailable, not finalized. Do not infer permission, actor identity, causality, economic correctness or prediction accuracy from a result.
9. Repeat only when new evidence is useful, such as after a pending transaction may have been included or a temporary observation failure has resolved. Honor retry guidance, use bounded retries, and do not poll blindly. A new call may observe different chain state; there is no idempotent-result replay guarantee.

See [Verification](VERIFICATION.md) for copyable requests, state handling and exact error fields. Neither a Verification call nor an HTTP error requires a payment or wallet signature.
