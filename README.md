# DLL Execution — Base transaction simulation and verification for AI agents

Execution infrastructure for AI agents.

DLL is an independent, read-only Base Mainnet API and remote MCP service. Before signing, simulate an unsigned transaction, inspect call success or revert, and check explicit destination and L2 execution fee constraints. After independent broadcast, verify inclusion, requested receipt status and supported transaction-field expectations. Results include structured Judgment or Verification states, reason codes, evidence and explicit uncertainty; DLL never signs, broadcasts or takes custody.

## Who it is for

AI Agents with an unsigned transaction candidate or an already-broadcast transaction hash, and developers integrating those Agents. Before acting, an Agent needs to understand likely failure, known costs, explicit constraints and remaining uncertainty. Afterward, it needs to check observed outcomes against explicit expectations.

## Available now: Execution Preflight

`POST https://execution.dll.io/v2/execution/preflight`

V0.2.1 evaluates **one unsigned Base Mainnet transaction candidate** and returns read-only simulation, an estimated L2 execution fee, deterministic policy checks, structured judgment and supporting evidence. It is a limited free public trial; no wallet connection, signature or payment is needed for Preflight. Benchmark's separate payment/free-trial rules do not apply to this endpoint.

With complete supported EIP-1559 transaction context, [optional `fee_estimation`](PREFLIGHT.md#optional-network-fee-estimate) returns a separate conditional estimate of L1 data, L2 execution, applicable Operator Fee and Total Network Fee. Missing necessary components keep total unavailable, not zero. The estimate is not realized cost, a future spending guarantee or an automatic PASS.

```text
Agent has an unsigned transaction candidate
→ calls DLL Execution Preflight
→ receives simulation / cost / policy / judgment / evidence
→ Agent decides what to do next
```

| Judgment        | Meaning within the evaluated evidence                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PASS`          | Simulation and applicable checks passed, with no material unresolved issue identified. Not permission to execute.                   |
| `CAUTION`       | Execution may be technically possible, but important uncertainty or incomplete evidence remains.                                    |
| `BLOCK`         | Deterministic evidence, such as a simulation revert or explicit constraint rejection, indicates not to proceed with this candidate. |
| `INDETERMINATE` | Available evidence cannot support a reliable judgment. Do not treat it as success or a proven transaction failure.                  |

Ordinary successful Preflight currently returns `CAUTION` because legacy `cost_estimate` L1/total remain unavailable. A complete optional `network_fee_estimate` does not recompute legacy Judgment or the L2-only cost constraint. None of these states evaluates profitability, investment quality, strategic desirability or financial advice.

## Available now: Execution Verification

`POST https://execution.dll.io/v2/execution/verify`

Verification V0.1 observes an already-broadcast **Base Mainnet** transaction and evaluates narrow expectations about its chain, inclusion, receipt status and optional candidate content. It is free and read-only: no signature, wallet connection or payment is required, and DLL need not have performed the original Preflight.

- **Preflight — before execution:** evaluate what is likely to happen, within the recorded evidence.
- **Verification — after execution:** observe what actually happened and evaluate it against explicit expectations.

Only `transaction_hash` is required. The default checks Base inclusion; request `receipt_status: "success"` explicitly to check receipt success. Read `verification.state`, not just HTTP status: `VERIFIED` means the requested checks are satisfied, `CONTRADICTED` means at least one check is contradicted, and `INDETERMINATE` means evidence is insufficient. These states do not establish finality, authorization, ownership, causality or profitability.

## Available now: Execution-cost Benchmark

`POST https://execution.dll.io/v1/benchmark/transactions`

Benchmark compares observed Base Mainnet transaction costs with historical context. The public path uses SIWX wallet identity and x402 v2 `upto` USDC: the first three valid analyses per verified wallet are free, then $0.005 per delivered valid analysis. Anonymous nonempty payment quotes do not force free-eligible wallets to pay. A paid N-hash batch quotes a maximum of N × 5000 atomic USDC; actual settlement counts only valid paid items. HTTP 200 can contain unavailable items; inspect completed billing. Historical percentiles are not route recommendations, profitability judgments or future fee guarantees. See the [Benchmark guide](BENCHMARK.md) and [bounded SDK client reference](BENCHMARK_CLIENT.md).

## Start here

- [Remote MCP](MCP.md): two free read-only tools and standard client setup; no wallet or payment.
- [Capability selection and FAQ](CAPABILITY_SELECTION.md): choose Preflight, Verification or Benchmark and understand their boundaries.
- [Quickstart](QUICKSTART.md): make your first Preflight or Verification call.
- [Agent integration instructions](AGENTS.md): when to call and how to interpret results.
- [Preflight contract](PREFLIGHT.md): inputs, outputs, constraints and errors.
- [Verification contract](VERIFICATION.md): inclusion, receipt/content checks, realized costs, observation states and errors.
- [Benchmark contract](BENCHMARK.md): historical cost context, SIWX, allowance, x402 payment and safe reconciliation.
- [Benchmark client reference](BENCHMARK_CLIENT.md): stage-aware identity/payment negotiation with independent spending authorization, not a generic-client compatibility guarantee.
- Preflight examples: [curl](examples/curl.sh), [JavaScript](examples/javascript.mjs), [Python](examples/python.py).
- Verification examples: [curl](examples/verify-curl.sh), [JavaScript](examples/verify-javascript.mjs), [Python](examples/verify-python.py).

## Public discovery and canonical contract

- [API origin](https://execution.dll.io): compact capability selector and canonical integration links.
- [Machine-readable index](https://execution.dll.io/llms.txt): index of authoritative public surfaces, not a duplicate API contract.
- [Public sitemap](https://execution.dll.io/sitemap.xml) and [crawl hints](https://execution.dll.io/robots.txt): explicitly advertised public GET documents; not authentication or proof of indexing.
- [Live OpenAPI](https://execution.dll.io/openapi.json): canonical API schemas and available operations.
- [Capabilities](https://execution.dll.io/capabilities): currently available capabilities and their scope.
- [x402 discovery manifest](https://execution.dll.io/.well-known/x402): Benchmark paid resource discovery; neither Preflight nor Verification requires x402 payment.

This repository explains what DLL does and how to use it. **Live OpenAPI, well-known metadata and actual API responses are the canonical public contract.** It is not an implementation/source-code mirror.

Documentation checks run offline with `node --test test/*.test.mjs`: local links, JSON syntax and bounded client safety behavior. They create no real signatures, payments or blockchain requests. Full examples are additionally checked against canonical product schemas during release validation.

## Limitations and security boundary

Base Mainnet only. Preflight accepts unsigned candidates; Verification accepts already-broadcast transaction hashes. No signing, broadcasting, custody or autonomous execution. DLL does not prove ownership of the supplied `from` address or authorize a transaction.

Simulation describes observed chain state; it does not guarantee future inclusion, success or application-level outcomes. The default L2-only fee is **not total execution cost**; optional network fee completeness describes only the supported conditional model. An unavailable fee is unknown, not zero. DLL does not verify net asset changes, comprehensively scan malicious contracts or guarantee Swap economic results. Keep private keys, credentials and other secrets out of requests. The Agent remains responsible for any later action.

Verification checks only the supplied expectations. Included, successful and canonical observations are not finalized-state guarantees. Its realized L2 fee is not total cost; total execution cost currently remains unavailable even if an L1 fee is observed.
