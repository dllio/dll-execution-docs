# Benchmark: stage-aware Agent client reference

Use this with [Benchmark's canonical flow, prices and errors](BENCHMARK.md), not as authority to spend. The [reference module](examples/benchmark-handshake.mjs) exports a bounded HTTP orchestration function. Importing it makes no request, signs nothing and never prepares or broadcasts an approval transaction. It creates at most one payment authorization per invocation and does not automatically retry a timeout or 503.

## Configure an independently authorized client

The reference uses the official `x402HTTPClient` interface. The SDK APIs were inspected/tested with `@x402/core`, `@x402/evm` and `@x402/extensions` 2.27.0. A signer must be supplied through your own safe wallet integration; do not put a private key in this repository, a URL, logs or DLL requests.

```js
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { UptoEvmScheme } from "@x402/evm/upto/client";
import { createSIWxClientExtension } from "@x402/extensions/sign-in-with-x";
import { benchmarkWithAuthorizedWallet } from "./examples/benchmark-handshake.mjs";

// signer is an independently supplied and authorized EOA wallet signer.
const sdk = new x402Client().register("eip155:8453", new UptoEvmScheme(signer));
sdk.registerExtension(createSIWxClientExtension({ signers: [signer] }));
const client = new x402HTTPClient(sdk);
// Call benchmarkWithAuthorizedWallet only after configuring request and spending policy.
```

Supply `client`, the canonical `body`, a nonempty opaque `idempotencyKey`, independently trusted `trustedPayTo`, and decimal-string `maxAuthorizationAtomic`. Verify the recipient using canonical HTTPS [payment metadata](https://execution.dll.io/payment), not an arbitrary challenge or forwarded URL. `authorizePayment(offer)` must return true only when your own policy explicitly permits the displayed network, recipient and amount. Omit it to prohibit paid authorization; free-eligible identity requests can still complete. No callback means no automatic spending.

The function always posts to the canonical HTTPS Benchmark path. It validates the Base USDC/network, recipient, finite amount and timeout; signs fresh SIWX challenges through the official hook; retains the exact serialized body/key/payment envelope; and returns the original Response. On 200, validate the full result against OpenAPI and inspect items and billing. On `PAYMENT_PENDING`, keep the original operation for bounded reconciliation; do not start this function again to generate a second authorization. A timeout is unknown, not no-charge.

## Wallet prerequisites and limits

For paid `upto`, use a compatible EOA, enough Base USDC to cover the signed maximum and a sufficient USDC allowance to canonical Permit2. The SDK's approval convenience helper can generate unlimited allowance: do not use it as a default for a tightly bounded test. Approval/funding/revocation require separate wallet authority and cost ETH gas when submitted directly; this module does none of them. DLL does not promise gas sponsorship. Identity proof alone authorizes neither those transactions nor service payment.

The reference is not a new protocol or a substitute for SDK signature validation. A generic one-retry wrapper, smart-contract wallet, or MCP payment proxy is not certified to support this multi-stage flow. Keep all signed SIWX resource entries; after the payment envelope is created a new identity challenge can be necessary. Never infer permission to create a fresh payment merely from another 402.

## What has actually been tested

The reference orchestration has deterministic offline tests. DLL's server path also has offline tests using official SIWX/Permit2 signatures and modeled facilitator/provider responses. These are not evidence of a real mainnet payment, actual settlement or directory indexing. Production real-money verification remains a separate explicitly approved exercise; this guide does not claim it has completed. See [capability selection](CAPABILITY_SELECTION.md) before choosing an endpoint.
