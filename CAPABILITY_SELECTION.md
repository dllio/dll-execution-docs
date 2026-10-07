# Choose a DLL Execution capability

DLL Execution is execution infrastructure for AI agents. It turns supported onchain observations into structured assessments, explicit uncertainty and evidence. It is API-first, read-only and non-custodial: DLL does not sign transactions, broadcast transactions or hold private keys.

Start at the [API origin](https://execution.dll.io), then consult [capabilities](https://execution.dll.io/capabilities) and the canonical [live OpenAPI](https://execution.dll.io/openapi.json). The [machine-readable index](https://execution.dll.io/llms.txt) links these public sources; it is not a separate contract.

## Selection

| Your input / question                                                                 | Choose           | Contract                                                  | Price / chain                                                                                                        |
| ------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| One unsigned candidate: what is likely to happen before I act?                        | **Preflight**    | `POST /v2/execution/preflight` · [guide](PREFLIGHT.md)    | Free; Base Mainnet (`8453`).                                                                                         |
| Already-broadcast transaction: what happened, and did it match explicit expectations? | **Verification** | `POST /v2/execution/verify` · [guide](VERIFICATION.md)    | Free; Base Mainnet (`8453`).                                                                                         |
| Observed transactions: how do their execution costs compare with historical context?  | **Benchmark**    | `POST /v1/benchmark/transactions` · [guide](BENCHMARK.md) | First three valid analyses per verified wallet free; further valid analyses $0.005 each via x402 USDC. Base Mainnet. |

Use the advertised operation, not an inferred capability. A prior DLL Preflight is not required for Verification or Benchmark. None of these APIs submits transactions. See [Quickstart](QUICKSTART.md) for requests and [Agent instructions](AGENTS.md) for integration rules.

## What the result does not prove

- Preflight judgment is not authorization, guaranteed success or complete future cost. It does not audit a contract or evaluate profitability.
- Verification `VERIFIED` covers only requested checks. Receipt success is checked only if explicitly requested. It does not establish finality, wallet ownership, actor identity, intent, causality or application-level success beyond those checks.
- Benchmark describes historical observations, not a route recommendation, profitability judgment or future fee guarantee.
- HTTP 200 means a response was returned, not that a transaction succeeded. Missing evidence is not success; unavailable cost is not zero.

## Agent FAQ

### What is DLL Execution, and why not use raw RPC data?

DLL supplies normalized, versioned product results: Preflight simulation/cost/constraints/judgment, Verification expectation checks, and Benchmark historical cost context. These include evidence and explicit unknown states, rather than requiring each agent to assemble and interpret raw observations. DLL is not an arbitrary RPC proxy, a cryptographic proof service or a substitute for independent checks outside its stated scope.

### When should I use Preflight, Verification or Benchmark?

Use [Preflight](PREFLIGHT.md) before acting on an unsigned candidate; use [Verification](VERIFICATION.md) after broadcast to check explicit expectations; use [Benchmark](BENCHMARK.md) to compare observed transaction costs with historical context. The selection table above gives the canonical paths.

### What chain is currently supported?

Base Mainnet, `chain_id="8453"`. Do not infer support for other chains from payment protocols or future possibilities. Follow live discovery for current availability.

### Is DLL custodial? Does it sign or broadcast transactions?

No. DLL never takes custody, holds your private keys, signs execution transactions or broadcasts them. Preflight and Verification need no wallet connection or signature. Benchmark uses wallet identity proof and, when applicable, a separately authorized service payment; neither is permission to execute an onchain candidate.

### What do PASS / CAUTION / BLOCK / INDETERMINATE mean?

Preflight `judgment.state` describes evaluated evidence: `PASS` means checks passed without an identified material unresolved issue; `CAUTION` means uncertainty or incomplete evidence; `BLOCK` means deterministic evidence against proceeding; `INDETERMINATE` means reliable judgment is unavailable. Ordinary successful Preflight currently remains CAUTION because total cost is incomplete. These are not execution predictions or authorizations. See [canonical judgment definitions](PREFLIGHT.md#judgment).

### What do VERIFIED / CONTRADICTED / INDETERMINATE mean?

Verification `verification.state` means requested checks are satisfied, deterministically contradicted, or insufficiently evidenced, respectively. Only `transaction_hash` is required; the default checks Base inclusion, **not receipt success**. Explicitly request `receipt_status: "success"` to check success. See [Verification](VERIFICATION.md).

### What does HTTP 200 mean and not mean?

A product response is available. Inspect Preflight `judgment` and `simulation`, Verification `verification.state` plus `outcome` and `observation_errors`, or Benchmark each `results` item plus `billing`. HTTP 200 is not authorization or a universal success label. Pending, not found and provider-unavailable observations are distinct; follow [Verification observation states](VERIFICATION.md#transaction-observation-states).

### What costs are known versus unavailable?

Preflight may estimate the L2 fee; its L1 and total transaction cost are unavailable. Verification computes realized L2 fee using exact gas-used × effective-gas-price arithmetic; L1 may be observed, but total remains unavailable. Benchmark cost percentiles are historical and availability-dependent. Keep ETH execution cost separate from USDC DLL service payment. A null/unavailable amount is not zero. See each capability's cost section.

### What is free versus paid?

Preflight and Verification are free and do not require SIWX or x402. Benchmark uses a verified-wallet allowance of three valid analyses, then $0.005 per valid analysis, not per submitted hash. Failed/invalid results do not consume that allowance or incur a charge. [Pricing](https://execution.dll.io/pricing) and [payment metadata](https://execution.dll.io/payment) are authoritative live terms; [Benchmark](BENCHMARK.md) explains the flow.

### How does an agent call each capability?

Read [OpenAPI](https://execution.dll.io/openapi.json), choose an advertised POST path, and send the guide's JSON request with `Content-Type: application/json`. [Quickstart](QUICKSTART.md) contains examples. Benchmark additionally requires `Idempotency-Key` and SIWX on the current public payment path; use its [complete integration guide](BENCHMARK.md) before authorizing payment.

### What public bounds and retry behavior should clients understand?

Keep requests bounded: one candidate per Preflight, one hash per Verification, and 1–100 hashes per Benchmark with `window` equal to `1h`, `24h` or `7d` (default `24h`). Preflight/Verification request bodies are bounded to 160 KiB, candidate calldata to 64 KiB. Consult schemas for all field bounds. Handle 400/413 by correcting input; honor `Retry-After` / returned retry guidance for 429 and retryable availability failures. Cap retries; never evade limits. Repeated Preflight/Verification calls may observe new evidence. Benchmark reconciliation must retain the same key, identity and body; `PAYMENT_PENDING` is not permission for a second settlement.

### What evidence can an agent rely on?

Use the observations, stable reason codes, response-local references, availability, versions and limitations actually returned. Evidence explains a scoped result; it is not an independent cryptographic proof, attestation or finality guarantee. Included, successful and canonical observations do not imply finalized state. Do not promote unavailable evidence into a stronger guarantee.

### What should an agent do before and after execution?

Before execution, obtain Preflight evidence and make its own separately authorized decision, resolving uncertainties relevant to the task. After independent broadcast, use Verification with explicit expectations. Use Benchmark only when historical cost context is useful. Matching outcomes do not prove causality or prediction accuracy. DLL never supplies signing or execution authority.
