// Reference orchestration only. Importing this module makes no request and signs nothing.
// Supply an official x402HTTPClient configured with UptoEvmScheme and the SIWX extension.
const endpoint = "https://execution.dll.io/v1/benchmark/transactions";
const usdc = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const address = /^0x[0-9a-fA-F]{40}$/;
const atomic = /^[1-9][0-9]*$/;

export async function benchmarkWithAuthorizedWallet({
  client,
  body,
  idempotencyKey,
  trustedPayTo,
  maxAuthorizationAtomic,
  authorizePayment,
  fetchImpl = fetch,
}) {
  const count = body?.transaction_hashes?.length;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    !body.transaction_hashes.every((hash) =>
      /^0x[0-9a-fA-F]{64}$/.test(hash),
    ) ||
    (body.window !== undefined && !["1h", "24h", "7d"].includes(body.window)) ||
    Object.keys(body).some(
      (key) => !["transaction_hashes", "window"].includes(key),
    ) ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 1 ||
    idempotencyKey.length > 128 ||
    !address.test(trustedPayTo) ||
    /^0x0{40}$/i.test(trustedPayTo) ||
    typeof maxAuthorizationAtomic !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(maxAuthorizationAtomic) ||
    BigInt(maxAuthorizationAtomic) > BigInt(count) * 5000n
  ) {
    throw new Error(
      "Invalid request or independently configured payment bounds.",
    );
  }
  // Capture once: the same body, key and payment envelope survive every negotiation request.
  const serialized = JSON.stringify(body);
  const headers = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  let paymentCreated = false;
  for (let round = 0; round < 6; round++) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { ...headers },
      body: serialized,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    // Includes PAYMENT_PENDING: return it for same-key reconciliation, never auto-pay again.
    if (response.status !== 402) return response;
    const required = client.getPaymentRequiredResponse((name) =>
      response.headers.get(name),
    );
    const stage = response.headers.get("X-DLL-Benchmark-Stage");
    if (
      !["identity", "payment"].includes(stage) ||
      required.x402Version !== 2 ||
      required.resource?.url !== endpoint ||
      !required.extensions?.["sign-in-with-x"] ||
      !required.extensions?.bazaar ||
      !Array.isArray(required.accepts) ||
      required.accepts.length !== 1
    ) {
      throw new Error("Unsupported identity/payment challenge.");
    }
    const offer = required.accepts[0];
    if (
      offer.scheme !== "upto" ||
      offer.network !== "eip155:8453" ||
      offer.asset?.toLowerCase() !== usdc ||
      offer.payTo?.toLowerCase() !== trustedPayTo.toLowerCase() ||
      typeof offer.amount !== "string" ||
      !atomic.test(offer.amount) ||
      BigInt(offer.amount) > BigInt(count) * 5000n ||
      !address.test(offer.extra?.facilitatorAddress) ||
      /^0x0{40}$/i.test(offer.extra.facilitatorAddress) ||
      !Number.isInteger(offer.maxTimeoutSeconds) ||
      offer.maxTimeoutSeconds < 1 ||
      offer.maxTimeoutSeconds > 300
    ) {
      throw new Error("Challenge differs from trusted resource/payment terms.");
    }
    if (stage === "payment") {
      if (
        paymentCreated ||
        BigInt(offer.amount) > BigInt(maxAuthorizationAtomic) ||
        typeof authorizePayment !== "function" ||
        (await authorizePayment(
          Object.freeze({ ...offer, extra: Object.freeze({ ...offer.extra }) }),
        )) !== true
      ) {
        throw new Error("A new payment authorization is not permitted.");
      }
      const payload = await client.createPaymentPayload(required);
      // Official SDK carries resource and Bazaar into the PaymentPayload; never drop them.
      if (
        payload.resource?.url !== endpoint ||
        JSON.stringify(payload.extensions?.bazaar) !==
          JSON.stringify(required.extensions?.bazaar)
      ) {
        throw new Error(
          "Payment resource/discovery metadata was not preserved.",
        );
      }
      const paymentHeaders = client.encodePaymentSignatureHeader(payload);
      if (typeof paymentHeaders["PAYMENT-SIGNATURE"] !== "string") {
        throw new Error("Missing official v2 payment encoding.");
      }
      headers["PAYMENT-SIGNATURE"] = paymentHeaders["PAYMENT-SIGNATURE"];
      paymentCreated = true;
    }
    // The official SIWX hook checks origin/domain and signs all declared resources.
    // An identity challenge after payment creation binds that SAME payment envelope.
    const proof = await client.handlePaymentRequired(required, endpoint);
    if (typeof proof?.["sign-in-with-x"] !== "string") {
      throw new Error("A configured SIWX signer is required.");
    }
    headers["SIGN-IN-WITH-X"] = proof["sign-in-with-x"];
  }
  throw new Error(
    "Negotiation limit reached; do not rotate keys or authorize another payment.",
  );
}
