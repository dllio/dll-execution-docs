# DLL Execution

Execution infrastructure for AI agents.

DLL helps AI Agents make better decisions before onchain execution and inspect observed outcomes afterward, with evidence intended to reduce downstream friction, execution cost and avoidable failures.

> Any Agent that wants to get something done onchain can call DLL.

This is the north star, not a claim of universal chain support or autonomous execution today.

## Who it is for

AI Agents with an unsigned transaction candidate or an already-broadcast transaction hash, and developers integrating those Agents. Before acting, an Agent needs to understand likely failure, known costs, explicit constraints and remaining uncertainty. Afterward, it needs to check observed outcomes against explicit expectations.

## Available now: Execution Preflight

`POST https://execution.dll.io/v2/execution/preflight`

V0.2.1 evaluates **one unsigned Base Mainnet transaction candidate** and returns read-only simulation, an estimated L2 execution fee, deterministic policy checks, structured judgment and supporting evidence. It is a limited free public trial; no wallet connection, signature or payment is needed for Preflight. Benchmark's separate payment/free-trial rules do not apply to this endpoint.

```text
Agent has an unsigned transaction candidate
→ calls DLL Execution Preflight
→ receives simulation / cost / policy / judgment / evidence
→ Agent decides what to do next
```

| Judgment | Meaning within the evaluated evidence |
| --- | --- |
| `PASS` | Simulation and applicable checks passed, with no material unresolved issue identified. Not permission to execute. |
| `CAUTION` | Execution may be technically possible, but important uncertainty or incomplete evidence remains. |
| `BLOCK` | Deterministic evidence, such as a simulation revert or explicit constraint rejection, indicates not to proceed with this candidate. |
| `INDETERMINATE` | Available evidence cannot support a reliable judgment. Do not treat it as success or a proven transaction failure. |

Ordinary successful Preflight currently returns `CAUTION`: L1 data fee and total transaction cost are unavailable. None of these states evaluates profitability, investment quality, strategic desirability or financial advice.

## Available now: Execution Verification

`POST https://execution.dll.io/v2/execution/verify`

Verification V0.1 observes an already-broadcast **Base Mainnet** transaction and evaluates narrow expectations about its chain, inclusion, receipt status and optional candidate content. It is free and read-only: no signature, wallet connection or payment is required, and DLL need not have performed the original Preflight.

- **Preflight — before execution:** evaluate what is likely to happen, within the recorded evidence.
- **Verification — after execution:** observe what actually happened and evaluate it against explicit expectations.

Only `transaction_hash` is required. The default checks Base inclusion; request `receipt_status: "success"` explicitly to check receipt success. Read `verification.state`, not just HTTP status: `VERIFIED` means the requested checks are satisfied, `CONTRADICTED` means at least one check is contradicted, and `INDETERMINATE` means evidence is insufficient. These states do not establish finality, authorization, ownership, causality or profitability.

## Start here

- [Quickstart](QUICKSTART.md): make your first Preflight or Verification call.
- [Agent integration instructions](AGENTS.md): when to call and how to interpret results.
- [Preflight contract](PREFLIGHT.md): inputs, outputs, constraints and errors.
- [Verification contract](VERIFICATION.md): inclusion, receipt/content checks, realized costs, observation states and errors.
- Preflight examples: [curl](examples/curl.sh), [JavaScript](examples/javascript.mjs), [Python](examples/python.py).
- Verification examples: [curl](examples/verify-curl.sh), [JavaScript](examples/verify-javascript.mjs), [Python](examples/verify-python.py).

## Public discovery and canonical contract

- [API origin](https://execution.dll.io): the API base URL, not a documentation homepage; `/` may return 404.
- [Live OpenAPI](https://execution.dll.io/openapi.json): canonical API schemas and available operations.
- [Capabilities](https://execution.dll.io/capabilities): currently available capabilities and their scope.
- [x402 discovery manifest](https://execution.dll.io/.well-known/x402): Benchmark paid resource discovery; neither Preflight nor Verification requires x402 payment.

This repository explains what DLL does and how to use it. **Live OpenAPI, well-known metadata and actual API responses are the canonical public contract.** It is not an implementation/source-code mirror.

## Limitations and security boundary

Base Mainnet only. Preflight accepts unsigned candidates; Verification accepts already-broadcast transaction hashes. No signing, broadcasting, custody or autonomous execution. DLL does not prove ownership of the supplied `from` address or authorize a transaction.

Simulation describes observed chain state; it does not guarantee future inclusion, success or application-level outcomes. The known L2 fee estimate is **not total execution cost**. An unavailable fee is unknown, not zero. Keep private keys, credentials and other secrets out of requests. The Agent remains responsible for any later action.

Verification checks only the supplied expectations. Included, successful and canonical observations are not finalized-state guarantees. Its realized L2 fee is not total cost; total execution cost currently remains unavailable even if an L1 fee is observed.
