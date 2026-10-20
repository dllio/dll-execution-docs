# DLL Execution: free Base transaction simulation and verification over remote MCP

DLL provides two free, read-only Base Mainnet tools over Streamable HTTP:

`https://execution.dll.io/mcp`

MCP adapter version: **0.1.0**. No API key, wallet connection, SIWX proof or payment is required. This is a standard tool adapter, not a new execution capability.

| Tool                    | When to select it                                                                | Canonical contract              |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| `preflight_transaction` | Before signing, simulate an unsigned Base candidate; inspect revert and destination/L2 fee constraints | [Preflight](PREFLIGHT.md)       |
| `verify_transaction`    | After independent broadcast, check Base inclusion, requested receipt status and optional candidate fields | [Verification](VERIFICATION.md) |

Input arguments are the JSON request bodies of the existing APIs. Use `tools/list` for the current input/output schemas. Tools follow public capability availability; an unavailable capability is not advertised. Benchmark and payment tools are not exposed through this MCP adapter.

The existing `preflight_transaction` tool also accepts the [optional network fee context](PREFLIGHT.md#optional-network-fee-estimate). It returns the same separate versioned `network_fee_estimate` as HTTP. This adds no tool, wallet/payment authority or spending guarantee, and does not recompute legacy Judgment. Default tool arguments and result interpretation are unchanged; do not invent missing fee fields.

Choose these tools for scoped transaction evidence, not wallet actions, net token-balance changes, comprehensive malicious-contract scanning or Swap economic-goal verification. Default Verification checks inclusion, not receipt success; request receipt status explicitly. A connected MCP server is not automatically selected by an Agent, and a directory listing does not grant a client permission to use external tools.

## Connect

For a remote-MCP-capable client, choose Streamable HTTP and the URL above. For example, xAI Responses API accepts this entry in its `tools` array:

```json
{
  "type": "mcp",
  "server_url": "https://execution.dll.io/mcp",
  "server_label": "dll_execution",
  "allowed_tools": ["preflight_transaction", "verify_transaction"]
}
```

This configuration follows [xAI's remote MCP contract](https://docs.x.ai/developers/tools/remote-mcp); it is not evidence that Grok Bot, Muse or any particular Agent has installed DLL. Clients must explicitly connect/enable the server. Registry listing does not imply automatic installation, selection or natural usage.

The adapter is stateless: there is no session cookie, session history, replay store or SSE subscription. POST responses use JSON. GET/DELETE return 405. Each POST contains one JSON-RPC message; batching is unsupported. Native non-browser clients may omit Origin; a supplied Origin must exactly match `https://execution.dll.io`. Cross-origin browser access is not enabled.

## Protocol sequence

POST these JSON-RPC messages to `/mcp`, sending `Content-Type: application/json` and `Accept: application/json, text/event-stream`.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {},
    "clientInfo": { "name": "my-agent", "version": "1.0.0" }
  }
}
```

Send `notifications/initialized` without an `id` after initialization. The server returns 202 without a body. Subsequent requests should send `MCP-Protocol-Version` with the negotiated version. An official MCP SDK handles this sequence for you.

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

A harmless Preflight example models a zero-value USDC `balanceOf` read; the synthetic sender is not a verified wallet identity:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "preflight_transaction",
    "arguments": {
      "candidate": {
        "chain_id": "8453",
        "from": "0x1111111111111111111111111111111111111111",
        "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "value": "0",
        "data": "0x70a082310000000000000000000000001111111111111111111111111111111111111111"
      }
    }
  }
}
```

Verification example: the hash below is illustrative, not a known included transaction. A not-found/INDETERMINATE assessment is expected if it is not observed. Substitute your independently broadcast transaction hash when useful.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "verify_transaction",
    "arguments": {
      "transaction_hash": "0x1212121212121212121212121212121212121212121212121212121212121212",
      "expectation": {
        "chain_id": "8453",
        "inclusion": "included",
        "receipt_status": "success"
      }
    }
  }
}
```

## Interpret the result

`result.structuredContent` contains:

- `http_status`: status returned by the existing business API.
- `response`: the exact business response shape, including its judgment, verification state or bounded API error.
- `retry_after_seconds`: present when the underlying HTTP API supplied Retry-After.

The same object is provided as JSON text in `result.content` for text-only clients. `result.isError=true` means an underlying HTTP error; false does **not** mean PASS, VERIFIED or transaction success. Inspect `response.judgment` or `response.verification` and the canonical guide. No outcome is promoted or reinterpreted by MCP.

Protocol/input failures can instead be JSON-RPC errors or MCP tool errors. Transport-level 400/403/413/429/503/504 can occur. Preserve the distinction between a tool failure, an unavailable observation and a deterministic contradiction. Do not blindly retry: honor supplied Retry-After and retryable flags. Repeated calls are new assessments, not idempotent replay.

REST and MCP share existing assessment admission. Different MCP sessions, tool names or forwarded/client-identity headers cannot create separate assessment allowances. Shared proxy/hosted-client exits may share admission; MCP does not establish distinct end-user identities. Request bodies are bounded to 160 KiB including the envelope. There is no waiting queue or automatic assessment retry.

## Security and discovery boundary

No signing, broadcasting, custody, arbitrary RPC, wallet or payment authority. Simulation is not authorization or guaranteed success. Verification covers explicit checks only; inclusion/canonicality is not finality. Missing fees/evidence remain unavailable. Keep credentials, private keys and proofs out of arguments.

[OpenAPI](https://execution.dll.io/openapi.json) exposes stable operation identifiers `preflightTransaction`, `verifyTransaction` and `benchmarkTransactions` for OpenAPI-aware clients. MCP advertises only the two free tools. [Capabilities](https://execution.dll.io/capabilities) and [the public index](https://execution.dll.io/llms.txt) report public availability.

Coinbase Bazaar is a separate discovery/payment channel for [Benchmark](BENCHMARK.md). This MCP endpoint neither establishes Bazaar indexing nor certifies the multi-stage SIWX/x402 client handshake. Official Registry publication and third-party Agent integration must be independently verified.
