# DLL Execution

Execution infrastructure for AI agents.

DLL helps AI Agents make better decisions before onchain execution, with evidence intended to reduce downstream friction, execution cost and avoidable failures.

> Any Agent that wants to get something done onchain can call DLL.

This is the north star, not a claim of universal chain support or autonomous execution today.

## Who it is for

AI Agents with an unsigned transaction candidate, and developers integrating those Agents. Before acting, an Agent needs to understand likely failure, known costs, explicit constraints and remaining uncertainty.

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

## Start here

- [Quickstart](QUICKSTART.md): make your first safe Preflight call.
- [Agent integration instructions](AGENTS.md): when to call and how to interpret results.
- [Preflight contract](PREFLIGHT.md): inputs, outputs, constraints and errors.
- [Examples](examples/curl.sh): [curl](examples/curl.sh), [JavaScript](examples/javascript.mjs), [Python](examples/python.py).

## Public discovery and canonical contract

- [API origin](https://execution.dll.io): the API base URL, not a documentation homepage; `/` may return 404.
- [Live OpenAPI](https://execution.dll.io/openapi.json): canonical API schemas and available operations.
- [x402 discovery manifest](https://execution.dll.io/.well-known/x402): existing paid resource discovery, not a declaration that Preflight requires payment.

This repository explains what DLL does and how to use it. **Live OpenAPI, well-known metadata and actual API responses are the canonical public contract.** It is not an implementation/source-code mirror.

## Limitations and security boundary

Base Mainnet only. Unsigned candidates only. No signing, broadcasting, custody or autonomous execution. DLL does not prove ownership of the supplied `from` address or authorize a transaction.

Simulation describes observed chain state; it does not guarantee future inclusion, success or application-level outcomes. The known L2 fee estimate is **not total execution cost**. An unavailable fee is unknown, not zero. Keep private keys, credentials and other secrets out of requests. The Agent remains responsible for any later action.
